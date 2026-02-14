from __future__ import annotations

import csv
import io
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.schemas.analytics import AnalyticsFilters


def _filters_to_query(filters: AnalyticsFilters) -> str:
    items: list[tuple[str, str]] = []
    for key, values in filters.model_dump().items():
        if not isinstance(values, list):
            continue
        for v in values:
            vv = str(v).strip()
            if vv:
                items.append((key, vv))
    return urlencode(items)


class AnalyticsService:
    @staticmethod
    def fetch_legacy(endpoint: str, filters: AnalyticsFilters) -> dict:
        base = settings.analytics_legacy_base_url.rstrip('/')
        query = _filters_to_query(filters)
        url = f'{base}{endpoint}'
        if query:
            url = f'{url}?{query}'
        with httpx.Client(timeout=30.0) as client:
            res = client.get(url)
            res.raise_for_status()
            return res.json()

    @staticmethod
    def export_csv(payload: dict) -> str:
        rows = []
        if isinstance(payload, dict):
            if isinstance(payload.get('rows'), list):
                rows = payload.get('rows') or []
            elif isinstance(payload.get('byGestion'), dict):
                for k, v in (payload.get('byGestion') or {}).items():
                    row = {'gestion_month': k}
                    if isinstance(v, dict):
                        row.update(v)
                    rows.append(row)
            else:
                rows = [payload]

        if not rows:
            rows = [{'message': 'no data'}]

        headers = sorted({k for r in rows if isinstance(r, dict) for k in r.keys()})
        out = io.StringIO()
        w = csv.DictWriter(out, fieldnames=headers)
        w.writeheader()
        for r in rows:
            if isinstance(r, dict):
                w.writerow(r)
        return out.getvalue()
