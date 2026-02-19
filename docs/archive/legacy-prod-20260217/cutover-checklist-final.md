# Cutover Checklist Final

Fecha objetivo de ejecucion: 2026-02-16
Owner release: Equipo Plataforma + Datos

## Evidencia de ejecucion local (2026-02-16)
- Script integral ejecutado: `scripts/docker-release-finalize.ps1` (exit code 0).
- Backend tests: 43/43 OK.
- Migracion legacy->DB + verificacion hash/count: OK.
- E2E Brokers critico: OK.
- OpenAPI export + generate types + frontend test/typecheck/build: OK.
- Alembic marcado en `head` para DB existente (`stamp head` -> `0004_user_preferences`).
- Smoke T0 registrado: `docs/evidence/cutover_t0_smoke.json`.
- Monitoreo ventana (parcial): `docs/evidence/cutover-window-metrics.jsonl` (24 muestras, 1 timeout transitorio), `docs/evidence/cutover-window-metrics-10m.jsonl` (30/30 ok).
- Ciclos release adicionales: `docs/evidence/release_finalize_cycle1_20260216_124855.log`, `docs/evidence/release_finalize_cycle2_20260216_125652.log`.

## Pre-cutover
- [x] Alembic en `head` (`0004_user_preferences`).
- [x] Migracion legacy->DB ejecutada (`scripts/migrate_legacy_config_to_db.py`).
- [x] Verificacion post-migracion en cero diff (`scripts/verify_legacy_config_migration.py`).
- [x] CI/release gates validados en ejecucion local equivalente (`scripts/docker-release-finalize.ps1`).
- [x] OpenAPI y tipos TS actualizados (`scripts/export_openapi_v1.py`, `npm run generate:types`).

## Cutover
- [ ] Activar feature flag de modulos v1 Brokers.
- [ ] Monitorear p95/error rate 30-60 min (`/analytics/ops/metrics`) con `python scripts/cutover_window_monitor.py`.
- [ ] Validar KPIs criticos (Brokers/Mora) vs referencia legacy (2 ciclos consecutivos sin fallos).
- [ ] Validar persistencia de filtros por usuario (cross-session/cross-browser).

## Post-cutover
- [ ] Confirmar paridad con golden datasets y parity script en ventana de salida.
- [ ] Documentar incidentes (si aplica) en runbook.
- [ ] Programar desactivacion legacy por flag tras 2 ciclos estables.

## Bloqueos actuales (2026-02-16)
- `dashboard` presenta reinicios intermitentes durante ejecuciones largas de monitoreo/perf.
- En condiciones de reinicio, los checks `perf/parity` no son deterministas (falla por conectividad transitoria y no por contrato funcional).
- Se requiere una ventana estable sin reinicios para completar el criterio de 2 ciclos consecutivos.

## Criterio de apagado legacy
1. `parity_check_analytics_v1.py` pasa 2 ejecuciones consecutivas.
2. `perf_smoke_api_v1.py` cumple p95 por endpoint.
3. error_rate < 2% por 30 minutos continuos.

## Firma de salida
- Tech Lead Backend: __________________
- Tech Lead Frontend: __________________
- Operaciones: __________________
- QA: __________________
