# DB Migration Playbook

> Estado 2026-02-17: el flujo productivo vigente es `runbook-prod.md` (from zero con PostgreSQL + `/api/v1/sync/*`).
> Las referencias a `sync_analytics_to_snapshot.py` y `run_sync_incremental.ps1` quedan solo como historico legacy.

## Objetivo
Migrar configuración legacy (`data/*.json`) a tablas versionadas (`alembic`) de forma idempotente.

## Pre-requisitos
- Variables de entorno válidas (`DATABASE_URL`).
- Migraciones aplicadas:
```bash
alembic -c backend/alembic.ini upgrade head
```

## Migración de config legacy -> DB
```bash
python scripts/migrate_legacy_config_to_db.py
```

Salida esperada:
```json
{"ok": true, "supervisors": N, "commissions": N, "prizes": N}
```

## Seeds QA
- `backend/seeds/seed_minimal.sql`
- `backend/seeds/seed_golden.sql`

Aplicación ejemplo:
```bash
sqlite3 data/app_v1.db < backend/seeds/seed_minimal.sql
```

## Verificación post-migración
- `GET /api/v1/brokers/supervisors-scope`
- `GET /api/v1/brokers/commissions`
- `GET /api/v1/brokers/prizes`

## Rollback
1. Restaurar backup DB previo.
2. Reaplicar migraciones.
3. Reejecutar script de migración.

## Sync incremental de analytics snapshot (legacy MySQL -> API v1 DB)
Default recomendado:
```bash
ANALYTICS_SYNC_MODE=incremental ANALYTICS_SYNC_WINDOW_MONTHS=3 python scripts/sync_analytics_to_snapshot.py
```

Notas:
- `incremental`: reemplaza solo los ultimos N meses detectados en el dataset origen.
- `full`: recarga completa (usar solo ante correcciones masivas).

Ejemplo full:
```bash
ANALYTICS_SYNC_MODE=full python scripts/sync_analytics_to_snapshot.py
```
