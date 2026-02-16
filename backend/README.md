# Backend v1 (FastAPI)

## Ejecutar local
```bash
uvicorn backend.app.main:app --reload --port 8000
```

## Endpoints
- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/revoke`
- `GET/POST /api/v1/brokers/supervisors-scope`
- `GET/POST /api/v1/brokers/commissions`
- `GET/POST /api/v1/brokers/prizes`
- `GET/POST /api/v1/brokers/preferences`
- `POST /api/v1/analytics/portfolio/summary`
- `POST /api/v1/analytics/rendimiento/summary`
- `POST /api/v1/analytics/mora/summary`
- `POST /api/v1/analytics/brokers/summary`
- `POST /api/v1/analytics/export/csv`
- `POST /api/v1/analytics/export/pdf`
- `GET /api/v1/openapi.json`

## Export OpenAPI (archivo versionado)
```bash
python scripts/export_openapi_v1.py
```
Genera `docs/openapi-v1.json` para sincronizar tipos de frontend.

## Seguridad
- JWT Bearer
- RBAC por permiso
- Rate limiting en auth y endpoints de escritura.

## Migraciones
```bash
alembic -c backend/alembic.ini upgrade head
```
