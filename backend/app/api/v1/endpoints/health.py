from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.request_metrics import summary as request_metrics_summary
from app.db.session import SessionLocal

router = APIRouter()


@router.get('/health')
def health():
    """
    Health check. Returns 200 with db_ok true when DB is reachable.
    Returns 503 when DB is unreachable (dependencies down).
    """
    db_ok = False
    db = SessionLocal()
    try:
        db.execute(text('SELECT 1'))
        db_ok = True
    except Exception:
        pass
    finally:
        db.close()
    if not db_ok:
        return JSONResponse(
            status_code=503,
            content={
                'ok': False,
                'service': 'cobranzas-api-v1',
                'db_ok': False,
                'message': 'Database unreachable',
            },
        )
    return {
        'ok': True,
        'service': 'cobranzas-api-v1',
        'db_ok': True,
    }


@router.get('/health/perf')
def health_perf():
    db = SessionLocal()
    pg_stat_top: list[dict] = []
    try:
        # If extension is not enabled, this query will fail and we return empty block.
        rows = db.execute(
            text(
                """
                SELECT query,
                       calls,
                       total_exec_time AS total_time_ms,
                       mean_exec_time AS mean_time_ms,
                       rows
                FROM pg_stat_statements
                ORDER BY total_exec_time DESC
                LIMIT 10
                """
            )
        ).mappings().all()
        for r in rows:
            pg_stat_top.append(
                {
                    'query': str(r.get('query') or '')[:180],
                    'calls': int(r.get('calls') or 0),
                    'total_time_ms': round(float(r.get('total_time_ms') or 0.0), 2),
                    'mean_time_ms': round(float(r.get('mean_time_ms') or 0.0), 2),
                    'rows': int(r.get('rows') or 0),
                }
            )
    except Exception:
        pg_stat_top = []
    finally:
        db.close()
    return {
        'service': 'cobranzas-api-v1',
        'request_latency': request_metrics_summary(),
        'pg_stat_statements_top': pg_stat_top,
    }
