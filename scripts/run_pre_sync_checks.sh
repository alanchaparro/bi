#!/usr/bin/env bash
# Verificaciones antes de ejecutar sync/import.
# Uso: ./scripts/run_pre_sync_checks.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=== Verificaciones pre-sync ==="
echo ""

fail=0
echo "[1] MySQL..."
if ! python scripts/verify_mysql_connectivity.py; then
  echo "   Sugerencia: Si la app corre en Docker y MySQL en el host, use MYSQL_HOST=host.docker.internal en .env"
  fail=1
fi
echo ""

echo "[2] Diagnostico API + MySQL + .env..."
if ! python scripts/diagnose_sync_connectivity.py; then
  fail=1
fi
echo ""

if [ "$fail" -eq 1 ]; then
  echo "Algunas comprobaciones fallaron. Corrija .env y/o que API/MySQL esten en ejecucion antes de ejecutar la carga."
  exit 1
fi
echo "Verificaciones OK. Puede ejecutar la carga desde Config > Importaciones."
