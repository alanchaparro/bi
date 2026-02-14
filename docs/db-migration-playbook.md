# DB Migration Playbook

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
