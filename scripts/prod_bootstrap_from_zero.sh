#!/usr/bin/env bash
# Bootstrap del stack de produccion desde cero (Linux/Mac).
# Replica scripts/prod_bootstrap_from_zero.ps1 para mantener paridad Win/Linux.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/8] Levantando PostgreSQL..."
docker compose --profile prod up -d postgres

echo "[2/8] Esperando readiness de PostgreSQL..."
max_attempts=60
ready=0
for ((i=0; i<max_attempts; i++)); do
  if docker compose --profile prod exec -T postgres sh -lc "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  echo "PostgreSQL no esta listo despues de esperar." >&2
  exit 1
fi

echo "[3/8] Ejecutando migraciones..."
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && PYTHONPATH=/app/backend alembic -c backend/alembic.ini upgrade head"

echo "[4/8] Bootstrap de usuarios auth..."
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/bootstrap_auth_users.py"

echo "[5/8] Migrando configuracion legacy..."
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/migrate_legacy_config_to_db.py"

echo "[6/8] Verificando migracion de configuracion..."
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/verify_legacy_config_migration.py"

echo "[7/8] Smoke de API (health + login)..."
docker compose --profile prod up -d api-v1
docker compose --profile prod run --rm api-v1 python /app/scripts/wait_for_api_health.py 60
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/smoke_api_v1_health_login.py"

echo "[8/8] Verificando conectividad MySQL (sync/import)..."
if docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/verify_mysql_connectivity.py"; then
  echo "MySQL: OK. Listo para sync/import."
else
  echo "ADVERTENCIA: MySQL no disponible. Configure MYSQL_* en .env y reintente verify_mysql_connectivity.py" >&2
fi

echo "Bootstrap from zero completado."
