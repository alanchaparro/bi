# Big-Bang 40GB Cutover Runbook (0-5 min)

## Objective
Switch to the incremental sync pipeline with watermark/chunk controls and staging support, with minimal downtime and immediate rollback path.

## Preconditions
1. Backend running with Alembic head that includes:
   - `0012_sync_incremental_controls`
   - `0013_sync_staging_rows`
2. Source MySQL hardened with incremental columns/indexes from `scripts/mysql_incremental_indexes.sql`.
3. `SYNC_MYSQL_INCREMENTAL_PUSHDOWN=true` in runtime env.
4. Release branch already validated in staging with:
   - `docker-test.ps1`
   - `scripts/perf_smoke_api_v1.py`
   - parity checks on KPIs.

## T-60 min (Preparation)
1. Freeze schema changes on source and target DBs.
2. Export baseline metrics:
   - p95 `/api/v1/analytics/portfolio/corte/summary`
   - p95 `/api/v1/analytics/cobranzas-cohorte/summary`
   - sync throughput rows/s by domain.
3. Confirm no long-running sync job:
   - `GET /api/v1/sync/status?domain=<domain>`
4. Snapshot critical tables:
   - `sync_runs`
   - `cartera_fact`, `cobranzas_fact`
   - `cartera_corte_agg`, `cobranzas_cohorte_agg`

## T-5 min (Freeze)
1. Pause new sync submissions from UI.
2. Wait current job to finish or cancel safely.
3. Run final delta sync in sequence:
   - `cobranzas`
   - `cartera`
   - `contratos`
   - `gestores`

## T-0 (Cutover)
1. Deploy app image.
2. Run migrations:
   - `PYTHONPATH=/app/backend alembic -c backend/alembic.ini upgrade head`
3. Restart API service.
4. Verify health:
   - `/docs`
   - `/api/v1/sync/status?domain=cobranzas`
   - `/api/v1/sync/watermarks`
5. Execute smoke sync (small scope).

## Validation (first 15 min)
1. Check watermark advancement:
   - `GET /api/v1/sync/watermarks?domain=<domain>`
2. Check chunk manifests and skip behavior:
   - `GET /api/v1/sync/chunks/{job_id}`
   - expect `skipped_unchanged_chunks > 0` on rerun with no source changes.
3. KPI reconciliation:
   - total cobrado
   - deberia cobrar
   - ticket transaccional
   - ticket contrato
4. UI responsiveness:
   - header sync indicator
   - no blocking during long sync.

## Rollback (immediate)
1. Disable submissions.
2. Revert app image to previous release.
3. Keep DB objects (non-breaking) and switch traffic back.
4. Re-run previous stable sync path.
5. Capture incident report with:
   - failing job id
   - chunk key
   - stage
   - SQL error and trace.

## Exit Criteria
1. No functional regressions in KPI dashboards.
2. Incremental rerun without source changes completes with chunk skips.
3. No duplicate business keys.
4. p95 response stable under sync load.
