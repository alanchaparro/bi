#!/usr/bin/env bash
# Detiene todos los servicios Docker Compose de este repo (espejo de INICIAR / iniciar.sh).
# No elimina volúmenes (pgdata_prod u otros datos se conservan).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

step() { printf '\033[0;36m[%s]\033[0m %s\n' "$1" "$2"; }

step "1" "Comprobando Docker Compose..."
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose V2 no esta disponible." >&2
  exit 1
fi

# Todos los servicios del compose tienen `profiles`; sin --profile el grafo queda vacío y
# `down` puede no parar api/postgres/front.
step "2" "Deteniendo contenedores (docker compose --profile \"*\" down --remove-orphans)..."
docker compose --profile "*" down --remove-orphans

echo ""
echo "  Listo. Volúmenes de datos (p. ej. PostgreSQL) no se eliminaron."
echo "  Para borrar también volúmenes: docker compose down -v (destructivo)."
echo ""
