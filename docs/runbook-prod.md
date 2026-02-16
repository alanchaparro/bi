# Runbook Produccion

## Arranque
1. `docker compose --profile prod up -d --build`
2. Verificar salud:
- `GET /api/v1/health`
- `GET /api/check-files`

## Migraciones
1. `alembic -c backend/alembic.ini upgrade head`
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

## Release gates de cierre
1. `python scripts/e2e_brokers_critical.py`
2. `python scripts/perf_smoke_api_v1.py`
3. `python scripts/parity_check_analytics_v1.py`
4. `python scripts/smoke_deploy_v1.py`

## Monitoreo cutover (30-60 min)
- Revisar `p95_ms`, `error_rate_pct`, `cache_hit_rate_pct` en `/analytics/ops/metrics`.
- Mantener dual-run habilitado hasta 2 ciclos de paridad/performance exitosos.

## Rollback
1. Tomar/confirmar snapshot DB previa.
2. `docker compose --profile prod down`
3. Restaurar snapshot DB.
4. Levantar version anterior.
5. Validar:
- `/api/v1/health`
- endpoints de brokers config
- consistencia de preferencias por usuario

## Recuperacion rapida
- Si falla analytics v1, desactivar flag de modulo afectado y mantener fallback legacy.
- Reintentar despliegue por slices cuando `error_rate_pct <= 2` y `p95_ms` dentro de umbral.
