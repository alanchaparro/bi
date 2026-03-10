#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ "${1:-}" != "--no-start" ]; then
  echo "[db-upgrade] Levantando servicios requeridos (postgres, api-v1)..."
  docker compose --profile dev up -d postgres api-v1
fi

echo "[db-upgrade] Ejecutando alembic upgrade head dentro de api-v1..."
docker compose exec api-v1 sh -lc "cd /app && PYTHONPATH=/app/backend python -m alembic -c backend/alembic.ini upgrade head"

echo "[db-upgrade] Verificando revision actual..."
docker compose exec api-v1 sh -lc "cd /app && PYTHONPATH=/app/backend python -m alembic -c backend/alembic.ini current"

echo "[db-upgrade] OK"

