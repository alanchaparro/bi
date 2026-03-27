#!/usr/bin/env bash
# Levanta el perfil Docker Compose prod-lan (nginx + API + front para acceso LAN).
# Espejo de INICIAR_LAN.bat / scripts/start_lan.ps1 (sin autogenerar secretos: configure .env).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

step() { printf '\033[0;36m[%s]\033[0m %s\n' "$1" "$2"; }
fail() { echo "$1" >&2; exit 1; }

step "1" "Comprobando Docker..."
if ! docker info >/dev/null 2>&1; then
  fail "Docker no esta en ejecucion."
fi
if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose V2 no disponible."
fi

step "2" "Comprobando .env..."
if [[ ! -f .env ]]; then
  if [[ ! -f .env.example ]]; then
    fail "Falta .env y .env.example."
  fi
  cp .env.example .env
  echo "  Creado .env desde .env.example; edite MYSQL_* y credenciales." >&2
fi

LAN_PORT="80"
if [[ -f .env ]] && grep -qE '^[[:space:]]*LAN_HTTP_PORT=' .env; then
  LAN_PORT="$(grep -E '^[[:space:]]*LAN_HTTP_PORT=' .env | head -1 | cut -d= -f2- | tr -d ' \r')"
  [[ -z "${LAN_PORT:-}" ]] && LAN_PORT="80"
fi

step "3" "Deteniendo servicios previos del proyecto (evita conflicto prod vs prod-lan)..."
docker compose --profile "*" down --remove-orphans

step "4" "Levantando prod-lan (build)..."
docker compose --profile prod-lan up -d --build

sleep 2

step "5" "Listo"
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
