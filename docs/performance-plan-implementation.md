# Plan Maestro de Rendimiento - Implementacion

Fecha: 2026-02-23

## Alcance implementado

1. Cola persistente de sincronizacion en DB (`sync_jobs`) y worker dedicado en el mismo contenedor.
2. Trazabilidad por etapas (`sync_job_steps`) y estado de ejecucion en `sync_runs`.
3. Campos opcionales de performance en `/sync/status`:
   - `eta_seconds`
   - `throughput_rows_per_sec`
   - `current_query_file`
   - `job_step`
4. Endpoint tecnico `/sync/perf/summary`.
5. Endpoint tecnico `/health/perf` con:
   - p50/p95/p99 por endpoint (ventana en memoria)
   - top SQL desde `pg_stat_statements` (si extension habilitada)
6. Guardrails de volumen:
   - endpoint `/sync/preview`
   - hard-limit global y por dominio (`SYNC_MAX_ROWS_*`)
7. Recalculo incremental de agregados:
   - `cartera_corte_agg`
   - `cobranzas_cohorte_agg` (nuevo preagregado orientado a UI)
8. `ANALYZE` post-sync y tuning de autovacuum en tablas fact/agg.
9. Frontend:
   - header global con progreso/ETA/query/step
   - backoff en polling de estado
   - preview de volumen antes de encolar sync

## Cambios de esquema

Migraciones nuevas:

- `0009_sync_jobs_queue.py`
- `0010_pgstats_and_cohorte_agg.py`
- `0011_fact_autovacuum_tuning.py`

## Variables de entorno nuevas

- `SYNC_MAX_ROWS_ANALYTICS`
- `SYNC_MAX_ROWS_CARTERA`
- `SYNC_MAX_ROWS_COBRANZAS`
- `SYNC_MAX_ROWS_CONTRATOS`
- `SYNC_MAX_ROWS_GESTORES`
- `SYNC_PREVIEW_ENABLED`
- `SYNC_WORKER_IDLE_SLEEP_SECONDS`

## Operacion

1. Levantar stack:

```bash
docker compose --profile prod up -d --build postgres api-v1 frontend-prod
```

2. Migrar:

```bash
docker compose --profile prod exec api-v1 sh -lc "PYTHONPATH=/app/backend alembic -c backend/alembic.ini upgrade head"
```

3. Verificar:

- `GET /api/v1/health`
- `GET /api/v1/health/perf`
- `GET /api/v1/sync/perf/summary`
