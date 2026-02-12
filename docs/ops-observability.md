# Ops Observability

## Backend logs
Server prints JSON-line events:
- `data_cache_refreshed`
- `analytics_summary`
- `analytics_trend`
- `analytics_performance`
- `analytics_movement_moroso`

Each log includes timestamp and execution duration (`ms`) where applicable.
For analytics requests it also includes cache signature key and debug mode flag.

## Debug mode
- Frontend: use `?debug=1` in URL to enable controlled console debug traces.
- Backend: pass `debug=1` query param to include debug marker in logs.

## Fallback-rate (frontend)
- Local metric key: `analytics_api_metrics_v1` (stored in browser `localStorage`).
- Tracks per tab:
  - `api_success`
  - `fallback_local`
- Tabs instrumented:
  - `analisisCartera`
  - `acaMovimiento`
  - `acaAnuales`
  - `rendimiento`

## Recommended checks
- `docker compose logs dashboard --tail=200`
- Validate analytics endpoint latency under repeated requests (cache hit).
- Track fallback-rate in frontend (API errors that switch to local compute).
