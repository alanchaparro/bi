# SQL v2 rollout runbook (sync domains)

This runbook applies to Fase 1 SQL extraction domains:
- gestores
- contratos
- cobranzas
- cartera

## 1) Prerequisites

- API v1 reachable.
- MySQL source reachable from API runtime.
- Admin user with permissions:
  - `analytics:read`
  - `system:read`
  - sync execution permissions.

## 2) Deploy 1 (code only)

Keep all variants in `v1`:

- `SYNC_QUERY_VARIANT_GESTORES=v1`
- `SYNC_QUERY_VARIANT_CONTRATOS=v1`
- `SYNC_QUERY_VARIANT_COBRANZAS=v1`
- `SYNC_QUERY_VARIANT_CARTERA=v1`

## 3) Deploy 2 (progressive activation)

Activate one domain at a time in this order:

1. `gestores`
2. `contratos`
3. `cobranzas`
4. `cartera`

After each activation/restart, run rollout validator for the active subset.

Example (all domains already in v2):

```powershell
$env:ROLLOUT_API_BASE='http://localhost:8000/api/v1'
$env:ROLLOUT_USERNAME='admin'
$env:ROLLOUT_PASSWORD='change_me_demo_admin_password'
$env:ROLLOUT_DOMAINS='gestores,contratos,cobranzas,cartera'
python scripts/rollout_sync_sql_v2.py
```

Optional date scope for runs:

```powershell
$env:ROLLOUT_CLOSE_MONTH_FROM='01/2026'
$env:ROLLOUT_CLOSE_MONTH_TO='03/2026'
python scripts/rollout_sync_sql_v2.py
```

For heavy domains (especially `cartera`) you can skip preview:

```powershell
$env:ROLLOUT_SKIP_PREVIEW='1'
python scripts/rollout_sync_sql_v2.py
```

## 4) Acceptance checks

- Sync finishes without `error` for each domain.
- `current_query_file` contains expected `sql/v2/query_<domain>.sql`.
- Smoke endpoints return 200 with meta keys:
  - `source_table`
  - `data_freshness_at`
  - `cache_hit`
  - `pipeline_version`
- `GET /api/v1/admin/analytics/options/consistency` returns `ok=true`.

## 5) Rollback

Rollback is env-only. Set the affected domain variant back to `v1` and restart API.

Example rollback for `cartera`:

- `SYNC_QUERY_VARIANT_CARTERA=v1`

Then re-run a scoped sync and smoke checks.
