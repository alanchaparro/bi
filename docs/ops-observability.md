# Ops Observability

## Backend logs
Server prints JSON-line events:
- `data_cache_refreshed`
- `analytics_summary`
- `analytics_trend`
- `analytics_performance`
- `analytics_movement_moroso`
- `analytics_anuales_summary`

Each log includes timestamp and execution duration (`ms`) where applicable.
For analytics requests it also includes cache signature key and debug mode flag.
Additional structured fields now include:
- `filters` (count snapshot by filter key)
- output size indicators (`months`, `years`, `total_contracts`, etc.)
- `cutoff` where applicable

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
- Config tab card now renders fallback-rate summary per tab.

## Backend endpoint metrics
- `GET /analytics/ops/metrics` (no filters required)
- `GET /analytics/ops/reset` resets in-memory endpoint metrics
- Metrics include per endpoint:
  - `requests`, `errors`, `error_rate_pct`
  - `cache_hits`, `cache_hit_rate_pct`
  - `avg_ms`, `p95_ms`, `last_ms`, `last_ts`

## Recommended checks
- `docker compose logs dashboard --tail=200`
- Validate analytics endpoint latency under repeated requests (cache hit).
- Track fallback-rate in frontend (API errors that switch to local compute).
- Check `p95_ms` and `error_rate_pct` in `/analytics/ops/metrics` before/after rollout.
