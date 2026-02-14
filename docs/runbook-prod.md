# Runbook Producción

## Arranque
1. `docker compose --profile prod up -d --build`
2. Verificar salud:
   - `GET /api/v1/health`
   - `GET /api/check-files`

## Migraciones
1. `alembic -c backend/alembic.ini upgrade head`
2. `python scripts/migrate_legacy_config_to_db.py`

## Verificación funcional
1. Login + refresh + revoke en `/api/v1/auth/*`.
2. Config Brokers GET/POST.
3. Analytics v1 endpoints.

## Rollback
1. Snapshot DB previa.
2. `docker compose --profile prod down`
3. Restaurar snapshot.
4. Levantar versión anterior.

## Recuperación
- Si falla API v1 analytics, activar fallback legacy en dashboard.
