# Runbook v1 Local

## Objetivo
Ejecutar en paralelo:
- Legacy dashboard (`start_dashboard.py`) en `:5000`
- API v1 FastAPI en `:8000`
- Frontend React v1 en `:5173`

## Requisitos
- Docker + Docker Compose

## Arranque (dev)
```bash
docker compose --profile dev up -d --build
```

## Verificaciones
```bash
curl http://localhost:5000/
curl http://localhost:8000/api/v1/health
curl http://localhost:5173/
```

## Login API v1
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## Migraciones Alembic (opcional en local)
```bash
docker compose --profile dev exec api-v1 alembic -c backend/alembic.ini upgrade head
```

## Rollback
```bash
docker compose --profile dev down
```

## Notas
- Base por defecto: SQLite (`data/app_v1.db`).
- Para MySQL, setear `DATABASE_URL` en `.env`.
