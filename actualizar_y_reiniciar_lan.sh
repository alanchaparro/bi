#!/usr/bin/env bash
# Actualiza codigo desde GitHub y reinicia el stack LAN completo.
# Uso: ./actualizar_y_reiniciar_lan.sh
# Copiar este archivo al servidor Linux, dar permiso: chmod +x actualizar_y_reiniciar_lan.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

step()  { printf '\033[0;36m[%s]\033[0m %s\n' "$1" "$2"; }
warn()  { printf '\033[0;33m[WARN]\033[0m %s\n' "$1"; }
fail()  { echo "$1" >&2; exit 1; }

# ---------- 0. Verificar Docker ----------
step "0" "Comprobando Docker y Docker Compose..."
if ! docker info >/dev/null 2>&1; then
  fail "Docker no esta instalado o no esta en ejecucion."
fi
if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose V2 no esta disponible."
fi

# ---------- 1. Verificar repositorio ----------
step "1" "Verificando repositorio Git..."
if [[ ! -d .git ]]; then
  fail "No se encontro .git en $SCRIPT_DIR. Asegurate de clonar el repo en el servidor."
fi

# ---------- 2. Git Pull ----------
step "2" "Haciendo git pull desde origin/master..."
GIT_OUTPUT=$(git pull origin master 2>&1) || true

if echo "$GIT_OUTPUT" | grep -qi "error"; then
  fail "git pull fallo:\n$GIT_OUTPUT"
fi

if echo "$GIT_OUTPUT" | grep -qi "already up to date"; then
  warn "El codigo ya esta actualizado. Reiniciando Docker de todas formas."
else
  echo "$GIT_OUTPUT"
  step "2b" "Codigo actualizado correctamente."
fi

# ---------- 3. Verificar .env ----------
if [[ ! -f .env ]]; then
  fail "Falta .env en la raiz. Copie .env.example o ejecute ./iniciar.sh primero."
fi

# ---------- 4. Puerto LAN ----------
step "3" "Puerto HTTP para acceso LAN (LAN_HTTP_PORT en .env)..."
# shellcheck source=scripts/lan_port_prompt.sh
source "$SCRIPT_DIR/scripts/lan_port_prompt.sh"
LAN_PORT="$(resolve_lan_http_port "$SCRIPT_DIR/.env")"

echo ""
echo "  Reinicio limpio LAN: contenedores abajo, imagenes locales del proyecto (--rmi local),"
echo "  rebuild prod-lan sin cache, volumenes de datos NO se borran."
echo ""

# ---------- 5. Bajar stack ----------
step "4" "Bajando stack (todos los perfiles) y eliminando imagenes locales del proyecto..."
docker compose --profile "*" down --remove-orphans --rmi local

# ---------- 6. Prune cache ----------
step "5" "Liberando cache de build no usada (docker builder prune -f)..."
docker builder prune -f

# ---------- 7. Rebuild ----------
step "6" "Reconstruyendo imagenes del perfil prod-lan (--pull --no-cache)..."
docker compose --profile prod-lan build --pull --no-cache

# ---------- 8. Levantar ----------
step "7" "Levantando perfil prod-lan..."
docker compose --profile prod-lan up -d

sleep 2
step "8" "Listo."
echo ""

if [[ "$LAN_PORT" == "80" ]]; then
  echo "  En este equipo: http://localhost/"
  echo "  Health:         http://localhost/api/v1/health"
else
  echo "  En este equipo: http://localhost:${LAN_PORT}/"
  echo "  Health:         http://localhost:${LAN_PORT}/api/v1/health"
fi

IPS=""
if command -v hostname >/dev/null 2>&1; then
  IPS="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -v '^$' | grep -v '^127\.' || true)"
fi
if [[ -z "$IPS" ]] && command -v ip >/dev/null 2>&1; then
  IPS="$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | grep -v '^127\.' || true)"
fi

if [[ -n "$IPS" ]]; then
  while read -r ip; do
    [[ -z "$ip" ]] && continue
    if [[ "$LAN_PORT" == "80" ]]; then
      echo "  Desde la LAN:   http://${ip}/"
    else
      echo "  Desde la LAN:   http://${ip}:${LAN_PORT}/"
    fi
  done <<< "$IPS"
else
  echo "  Desde la LAN:   http://<IP_DE_ESTA_MAQUINA>$( [[ "$LAN_PORT" != "80" ]] && echo ":${LAN_PORT}" )/"
fi

echo ""
echo "  Abra el puerto TCP ${LAN_PORT} en el cortafuegos si otras PCs no llegan."
echo ""
