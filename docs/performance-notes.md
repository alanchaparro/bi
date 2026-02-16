# Performance Notes

## Current Hot Paths
- Full scans over `cartera` and `cobranzas` for each analytics recalculation.
- Rebuilding chart instances on every filter application.
- Cross-dataset map joins (`contract_id + month`) with large arrays.

## Implemented Improvements
- Validation sample cap (`5000`) to avoid expensive full-file prechecks.
- Graceful chart render errors to prevent UI lockups.
- Sidebar state and tab state centralized to reduce redundant UI churn.
- **Backend:** cache por firma de filtros en `POST /api/v1/analytics/brokers/summary` (in-memory, TTL 60 s). Ver `app/core/analytics_cache.py` y uso en `app/api/v1/endpoints/analytics.py`.

## Next Optimizations
- Extender cache a otros endpoints de analytics (portfolio, rendimiento, mora) si el patrón de uso lo justifica.
- Cache `contract_id + month` maps per dataset load.
- Split expensive analytics into incremental recompute paths.

## Recommended Client Limits
- Prefer <= 1.2M rows total loaded in browser.
- For larger volume, move heavy aggregations to backend endpoint.
