# Runbook Particionado (`cartera_fact`, `sync_records`)

## Prechecks
1. Backup reciente validado.
2. Ventana de mantenimiento definida.
3. Sin sync masivo corriendo.
4. Verificar tamaño y locks esperados.

## Secuencia recomendada
1. Crear shadow tables particionadas:
   - `scripts/partitioning/01_create_shadow_partitioned_tables.sql`
2. Backfill inicial:
   - `scripts/partitioning/02_backfill_shadow_partitioned_tables.sql`
3. Activar dual-write temporal:
   - `scripts/partitioning/03_enable_dual_write_triggers.sql`
4. Verificar paridad:
   - `count(*)` por tabla base vs shadow.
   - checks por mes (`gestion_month`) y muestra por `contract_id`.
5. Cutover:
   - `scripts/partitioning/04_cutover_swap_to_partitioned.sql`
6. Smoke funcional:
   - sync incremental.
   - options/summary de analytics v2.
7. Cierre:
   - `scripts/partitioning/06_cleanup_after_cutover.sql`

## Rollback
- Ejecutar:
  - `scripts/partitioning/05_rollback_swap_to_legacy.sql`

## Benchmarks sugeridos
- Ejecutar:
  - `python scripts/benchmark_analytics_v2.py --base-url http://localhost:8000/api/v1 --token <JWT>`
- Revisar:
  - warm p95 options `< 250ms`
  - warm p95 summary `< 1.5s`

