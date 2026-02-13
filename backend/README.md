# Backend v1 (FastAPI)

## Ejecutar local
```bash
uvicorn backend.app.main:app --reload --port 8000
```

## Endpoints
- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `GET/POST /api/v1/brokers/supervisors-scope`
- `GET/POST /api/v1/brokers/commissions`
- `GET/POST /api/v1/brokers/prizes`
- `GET /api/v1/openapi.json`

## Export OpenAPI (archivo versionado)
```bash
python scripts/export_openapi_v1.py
```
Genera `docs/openapi-v1.json` para sincronizar tipos de frontend.

## Seguridad
- JWT Bearer
- RBAC por permiso

## Migraciones
```bash
alembic -c backend/alembic.ini upgrade head
```
