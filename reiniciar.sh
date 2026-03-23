#!/usr/bin/env bash
# Reinicio limpio: baja todo, quita imágenes locales del proyecto, rebuild sin cache y levanta prod.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

step() { printf '\033[0;36m[%s]\033[0m %s\n' "$1" "$2"; }
fail() { echo "$1" >&2; exit 1; }

step "1" "Comprobando Docker y Docker Compose..."
if ! docker info >/dev/null 2>&1; then
  fail "Docker no esta instalado o no esta en ejecucion."
fi
if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose V2 no esta disponible."
fi

echo ""
echo "  Reinicio limpio: contenedores abajo, imagenes locales del proyecto (--rmi local),"
echo "  rebuild prod sin cache, volumenes de datos NO se borran."
echo ""

step "2" "Bajando stack (todos los perfiles) y eliminando imagenes locales del proyecto..."
docker compose --profile "*" down --remove-orphans --rmi local

step "3" "Liberando cache de build no usada (docker builder prune -f)..."
docker builder prune -f

step "4" "Reconstruyendo imagenes del perfil prod (--pull --no-cache)..."
docker compose --profile prod build --pull --no-cache

step "5" "Levantando perfil prod..."
docker compose --profile prod up -d

sleep 2
step "6" "Listo."
echo ""
echo "  Stack prod en marcha. Frontend tipico: http://localhost:8080"
echo "  Si necesita bootstrap o admin one-shot, ejecute ./iniciar.sh"
echo ""
