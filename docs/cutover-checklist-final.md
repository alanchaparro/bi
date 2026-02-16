# Cutover Checklist Final

Fecha objetivo de ejecucion: 2026-02-16
Owner release: Equipo Plataforma + Datos

## Pre-cutover
- [ ] Alembic en `head` (`0004_user_preferences`).
- [ ] Migracion legacy->DB ejecutada (`scripts/migrate_legacy_config_to_db.py`).
- [ ] Verificacion post-migracion en cero diff (`scripts/verify_legacy_config_migration.py`).
- [ ] CI release gates en verde (workflow `Release Gates`).
- [ ] OpenAPI y tipos TS actualizados (`scripts/export_openapi_v1.py`, `npm run generate:types`).

## Cutover
- [ ] Activar feature flag de modulos v1 Brokers.
- [ ] Monitorear p95/error rate 30-60 min (`/analytics/ops/metrics`).
- [ ] Validar KPIs criticos (Brokers/Mora) vs referencia legacy.
- [ ] Validar persistencia de filtros por usuario (cross-session/cross-browser).

## Post-cutover
- [ ] Confirmar paridad con golden datasets y parity script.
- [ ] Documentar incidentes (si aplica) en runbook.
- [ ] Programar desactivacion legacy por flag tras 2 ciclos estables.

## Criterio de apagado legacy
1. `parity_check_analytics_v1.py` pasa 2 ejecuciones consecutivas.
2. `perf_smoke_api_v1.py` cumple p95 por endpoint.
3. error_rate < 2% por 30 minutos continuos.

## Firma de salida
- Tech Lead Backend: __________________
- Tech Lead Frontend: __________________
- Operaciones: __________________
- QA: __________________
