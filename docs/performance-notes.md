# Performance Notes

## Current Hot Paths
- Full scans over `cartera` and `cobranzas` for each analytics recalculation.
- Rebuilding chart instances on every filter application.
- Cross-dataset map joins (`contract_id + month`) with large arrays.

## Implemented Improvements
- Validation sample cap (`5000`) to avoid expensive full-file prechecks.
- Graceful chart render errors to prevent UI lockups.
- Sidebar state and tab state centralized to reduce redundant UI churn.

## Next Optimizations
- Memoize aggregations by filter signature.
- Cache `contract_id + month` maps per dataset load.
- Split expensive analytics into incremental recompute paths.

## Recommended Client Limits
- Prefer <= 1.2M rows total loaded in browser.
- For larger volume, move heavy aggregations to backend endpoint.
