# Manual Regression Checklist

## Core
- [ ] App opens at `http://localhost:5000`.
- [ ] No recursive or stack overflow errors.
- [ ] Config tab sync works for available CSV files.
- [ ] Docker validation pipeline executed (`.\scripts\docker-validate.ps1`).
- [ ] Release finalize pipeline executed (`make docker-release-finalize` o `.\scripts\docker-release-finalize.ps1`).

## Navigation
- [ ] Sidebar opens/closes with menu button.
- [ ] Sidebar closes on overlay click.
- [ ] Sidebar closes after tab click.

## Filters
- [ ] Apply filters changes visuals.
- [ ] Reset filters restores default state.
- [ ] No tab crashes with empty selection combinations.

## Charts
- [ ] Charts render in each tab.
- [ ] Tooltips show formatted values.
- [ ] Compliance line and labels are visible.
- [ ] Movimiento cartera renders bars + `% sobre vigentes` from API/fallback.
- [ ] No severe overlap between bar labels and line labels in movimiento.

## Data Validation
- [ ] Missing required columns fail with clear error.
- [ ] Invalid rows produce warnings, not silent failures.

## Flags & Rollout
- [ ] Feature flags loaded (`data/feature-flags.js`) and expected defaults active.
- [ ] If stale assets appear, run hard refresh (`Ctrl+F5`) after deploy.
- [ ] Confirm fallback behavior when analytics API endpoint is unavailable.
- [ ] Validate frontend fallback-rate per tab in Config > Monitoreo API.
- [ ] Validate backend endpoint metrics in `/analytics/ops/metrics`:
  - [ ] `error_rate_pct <= 2.0%`
  - [ ] `p95_ms <= 1200ms`
  - [ ] cache-hit rate healthy after warmup
- [ ] If threshold breached, disable affected `FF_API_*` flag and retry rollout by slices.

## Cierre V1 Brokers
- [ ] `scripts/verify_legacy_config_migration.py` en verde (diff = 0).
- [ ] `scripts/e2e_brokers_critical.py` en verde.
- [ ] `scripts/parity_check_analytics_v1.py` en verde.
- [ ] `scripts/perf_smoke_api_v1.py` en verde.
- [ ] `scripts/smoke_deploy_v1.py` en verde.
- [ ] `docs/openapi-v1.json` regenerado.
- [ ] `frontend/src/shared/api-types.ts` regenerado.
