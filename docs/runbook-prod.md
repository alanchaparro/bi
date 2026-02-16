# Runbook Produccion

## Arranque
1. `docker compose --profile prod up -d --build`
2. Verificar salud:
- `GET /api/v1/health`
- `GET /api/check-files`

## Migraciones
1. `PYTHONPATH=/app/backend alembic -c backend/alembic.ini stamp head` (solo si DB existente ya contiene tablas y no hay tabla alembic_version).
2. `python scripts/migrate_legacy_config_to_db.py`
3. `python scripts/verify_legacy_config_migration.py`

## Verificacion funcional minima
1. Auth: login + refresh + revoke en `/api/v1/auth/*`.
2. Brokers config: GET/POST supervisors, commissions, prizes.
3. Brokers preferences: GET/POST `/api/v1/brokers/preferences`.
4. Analytics v1:
- `/api/v1/analytics/portfolio/summary`
- `/api/v1/analytics/rendimiento/summary`
- `/api/v1/analytics/mora/summary`
- `/api/v1/analytics/brokers/summary`
- `/api/v1/analytics/export/csv`
- `/api/v1/analytics/export/pdf`

## Gates de cierre tecnico
1. `python scripts/e2e_brokers_critical.py`
2. `python scripts/perf_smoke_api_v1.py`
3. `python scripts/parity_check_analytics_v1.py`
4. `python scripts/smoke_deploy_v1.py`

Nota operativa Docker:
- Para ejecuciones largas en entorno containerizado, preferir `docker exec <container> ...` sobre `docker compose run --rm ...` para evitar reinicios/recreaciones del servicio durante el cutover.

## Ejecucion de cutover (minuto a minuto)
### T-15
1. Confirmar snapshot DB y backup de configuracion.
2. Confirmar flags listas para rollback rapido.
3. Confirmar responsables en war-room (Backend, Frontend, Ops, QA).

### T-5
1. Ejecutar `scripts/migrate_legacy_config_to_db.py` + `scripts/verify_legacy_config_migration.py`.
2. Validar `/api/v1/health` y `/api/check-files`.

### T0
1. Activar feature flag de modulos v1 Brokers.
2. Ejecutar smoke rapido:
- login
- brokers summary
- brokers preferences roundtrip

### T+0 a T+30
1. Ejecutar monitoreo continuo:
- `python scripts/cutover_window_monitor.py`
- Ejemplo recomendado en Compose: `docker exec <dashboard-container> sh -lc "CUTOVER_METRICS_URL=http://localhost:5000/analytics/ops/metrics CUTOVER_WINDOW_MINUTES=30 CUTOVER_INTERVAL_SECONDS=60 python /app/scripts/cutover_window_monitor.py"`
2. Umbrales de salida:
- `error_rate_pct <= 2.0`
- `p95_ms <= 1200`
3. Si se incumple umbral en endpoint critico, desactivar flag y pasar a rollback.

### T+30
1. Ejecutar `scripts/parity_check_analytics_v1.py`.
2. Ejecutar `scripts/perf_smoke_api_v1.py`.
3. Registrar evidencia en `docs/cutover-checklist-final.md`.

### T+60
1. Repetir paridad/perf (segundo ciclo estable).
2. Si cumple, programar apagado legacy por flag.

## Rollback
1. Tomar/confirmar snapshot DB previa.
2. Desactivar feature flag de modulos v1.
3. `docker compose --profile prod down`
4. Restaurar snapshot DB.
5. Levantar version anterior.
6. Validar:
- `/api/v1/health`
- endpoints de brokers config
- consistencia de preferencias por usuario

## Recuperacion rapida
- Si falla analytics v1, mantener fallback legacy y reintentar por slices cuando `error_rate_pct <= 2` y `p95_ms` en umbral.
