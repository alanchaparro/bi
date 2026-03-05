import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.core.deps import require_permission, write_rate_limiter
from app.db.session import get_db
from app.models.brokers import FrontendPerfMetric
from app.schemas.telemetry import FrontendPerfIn

router = APIRouter()


def _to_naive_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    data = sorted(values)
    if len(data) == 1:
        return round(float(data[0]), 2)
    idx = (len(data) - 1) * p
    lo = int(idx)
    hi = min(lo + 1, len(data) - 1)
    frac = idx - lo
    value = data[lo] + (data[hi] - data[lo]) * frac
    return round(float(value), 2)


@router.post('/frontend-perf')
def frontend_perf_ingest(
    payload: FrontendPerfIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    _user=Depends(require_permission('analytics:read')),
):
    row = FrontendPerfMetric(
        route=str(payload.route),
        session_id=str(payload.session_id),
        trace_id=str(payload.trace_id or ''),
        ttfb_ms=float(payload.ttfb_ms) if payload.ttfb_ms is not None else None,
        fcp_ms=float(payload.fcp_ms) if payload.fcp_ms is not None else None,
        ready_ms=float(payload.ready_ms),
        api_calls_json=json.dumps([item.model_dump() for item in payload.api_calls], ensure_ascii=False),
        app_version=str(payload.app_version or 'dev'),
        event_at=_to_naive_utc(payload.timestamp_utc) or datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    return {'ok': True, 'id': int(row.id)}


@router.get('/frontend-perf/summary')
def frontend_perf_summary(
    route: str | None = Query(default=None),
    from_utc: datetime | None = Query(default=None),
    to_utc: datetime | None = Query(default=None),
    limit: int = Query(default=5000, ge=100, le=50000),
    db: Session = Depends(get_db),
    _user=Depends(require_permission('system:read')),
):
    q = db.query(FrontendPerfMetric)
    if route:
        q = q.filter(FrontendPerfMetric.route == str(route))
    from_v = _to_naive_utc(from_utc)
    to_v = _to_naive_utc(to_utc)
    conds = []
    if from_v is not None:
        conds.append(FrontendPerfMetric.event_at >= from_v)
    if to_v is not None:
        conds.append(FrontendPerfMetric.event_at <= to_v)
    if conds:
        q = q.filter(and_(*conds))
    rows = q.order_by(FrontendPerfMetric.event_at.desc()).limit(int(limit)).all()

    ttfb = [float(r.ttfb_ms) for r in rows if r.ttfb_ms is not None]
    fcp = [float(r.fcp_ms) for r in rows if r.fcp_ms is not None]
    ready = [float(r.ready_ms) for r in rows if r.ready_ms is not None]

    cold = 0
    warm = 0
    for r in rows:
        try:
            calls = json.loads(r.api_calls_json or '[]')
        except Exception:
            calls = []
        is_warm = any(bool(c.get('cache_hit')) for c in calls if isinstance(c, dict))
        if is_warm:
            warm += 1
        else:
            cold += 1

    by_route = (
        db.query(FrontendPerfMetric.route, func.count(FrontendPerfMetric.id))
        .group_by(FrontendPerfMetric.route)
        .all()
    )
    return {
        'sample_count': len(rows),
        'route': route,
        'window': {'from_utc': from_v.isoformat() if from_v else None, 'to_utc': to_v.isoformat() if to_v else None},
        'ttfb_ms': {'p50': _pct(ttfb, 0.5), 'p95': _pct(ttfb, 0.95), 'p99': _pct(ttfb, 0.99)},
        'fcp_ms': {'p50': _pct(fcp, 0.5), 'p95': _pct(fcp, 0.95), 'p99': _pct(fcp, 0.99)},
        'ready_ms': {'p50': _pct(ready, 0.5), 'p95': _pct(ready, 0.95), 'p99': _pct(ready, 0.99)},
        'breakdown': {'cold': cold, 'warm': warm},
        'counts_by_route': [{'route': str(r[0]), 'count': int(r[1] or 0)} for r in by_route],
    }
