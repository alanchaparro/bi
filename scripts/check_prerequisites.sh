#!/usr/bin/env bash
# Comprueba requisitos (Docker + Compose V2).
# Por defecto en Linux: si falta Docker o Compose V2, intenta instalarlos con apt/dnf/pacman (sudo).
#   --no-install   Solo comprobar, no instalar nada.
#   --install      Igual que el comportamiento por defecto (compatibilidad).
#   --quiet        Menos salida.

set -euo pipefail

NO_INSTALL=false
QUIET=false
for arg in "$@"; do
  case "$arg" in
    --install) ;; # compat: ya es el comportamiento por defecto
    --no-install) NO_INSTALL=true ;;
    --quiet) QUIET=true ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

FAILED=0
ok() { [[ "$QUIET" == true ]] || printf '\033[0;32m[OK]\033[0m   %s\n' "$1"; }
bad() { printf '\033[0;31m[FALTA]\033[0m %s\n' "$1"; FAILED=1; }
info() { [[ "$QUIET" == true ]] || printf '       %s\n' "$1"; }

try_install_message() {
  [[ "$QUIET" == true ]] || echo -e "\033[0;36m[INFO]\033[0m Intentando instalar Docker con el gestor de paquetes del sistema (sudo)..."
}

have_sudo() { command -v sudo >/dev/null 2>&1; }

ensure_docker_apt() {
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-plugin 2>/dev/null \
    || sudo apt-get install -y docker.io
}

ensure_docker_dnf() {
  sudo dnf install -y docker docker-compose-plugin 2>/dev/null || sudo dnf install -y docker
}

ensure_docker_pacman() {
  sudo pacman -Sy --needed --noconfirm docker docker-compose 2>/dev/null \
    || sudo pacman -Sy --needed --noconfirm docker
}

start_docker_service() {
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable --now docker 2>/dev/null || true
  fi
}

add_user_docker_group() {
  sudo usermod -aG docker "$USER" 2>/dev/null || true
}

# Intenta instalar CLI + plugin compose; no aborta el script si un paso falla.
attempt_docker_install() {
  [[ "$NO_INSTALL" == true ]] && return 1
  have_sudo || return 1
  try_install_message
  set +e
  if command -v apt-get >/dev/null 2>&1; then
    ensure_docker_apt
  elif command -v dnf >/dev/null 2>&1; then
    ensure_docker_dnf
  elif command -v pacman >/dev/null 2>&1; then
    ensure_docker_pacman
  else
    set -e
    return 1
  fi
  start_docker_service
  add_user_docker_group
  hash -r 2>/dev/null || true
  set -e
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

attempt_compose_plugin_install() {
  [[ "$NO_INSTALL" == true ]] && return 1
  have_sudo || return 1
  set +e
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y
    sudo apt-get install -y docker-compose-plugin
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y docker-compose-plugin 2>/dev/null || true
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --needed --noconfirm docker-compose 2>/dev/null || true
  fi
  set -e
  return 0
}

[[ "$QUIET" == true ]] || {
  echo ""
  echo "=== Requisitos del proyecto (EPEM BI / Docker) ==="
  echo ""
}

if [[ "${BASH_VERSINFO[0]:-0}" -lt 4 ]]; then
  bad "Se recomienda Bash 4+ (tiene ${BASH_VERSION:-?})."
else
  ok "Bash ${BASH_VERSION}"
fi

if command -v git >/dev/null 2>&1; then
  ok "Git disponible"
else
  [[ "$QUIET" == true ]] || echo -e "\033[0;33m[AVISO]\033[0m Git no esta en PATH (opcional)."
fi

# --- Docker CLI ---
if ! command -v docker >/dev/null 2>&1; then
  if attempt_docker_install; then
    ok "Docker CLI instalado en este paso"
  else
    bad "Docker CLI no encontrado."
    info "Instale Docker: https://docs.docker.com/engine/install/  (o ejecute con sudo si falta)."
    info "Solo verificacion sin instalar: $0 --no-install"
  fi
else
  ok "Docker CLI en PATH"
fi

# --- Motor Docker ---
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    ok "Motor Docker en ejecucion"
  else
    if [[ "$NO_INSTALL" != true ]] && have_sudo && command -v systemctl >/dev/null 2>&1; then
      [[ "$QUIET" == true ]] || echo -e "\033[0;36m[INFO]\033[0m Intentando: sudo systemctl start docker"
      sudo systemctl start docker 2>/dev/null || true
    fi
    if docker info >/dev/null 2>&1; then
      ok "Motor Docker en ejecucion"
    else
      bad "El motor Docker no responde."
      info "Ejecute: sudo systemctl start docker   (o inicie el servicio en su distro)"
    fi
  fi
fi

# --- Docker Compose V2 ---
if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    ok "Docker Compose V2: $(docker compose version 2>&1 | head -1)"
  else
    attempt_compose_plugin_install || true
    if docker compose version >/dev/null 2>&1; then
      ok "Docker Compose V2: $(docker compose version 2>&1 | head -1)"
    else
      bad "Docker Compose V2 no disponible."
      info "Instale el paquete docker-compose-plugin (apt/dnf) o vea https://docs.docker.com/compose/install/linux/"
    fi
  fi
fi

if [[ -f "$ROOT/.env.example" ]]; then
  ok ".env.example presente"
else
  bad "No se encuentra .env.example"
fi

if [[ -f "$ROOT/docker-compose.yml" ]]; then
  ok "docker-compose.yml presente"
else
  bad "No se encuentra docker-compose.yml"
fi

[[ "$QUIET" == true ]] || {
  echo ""
  if [[ "$FAILED" -ne 0 ]]; then
    echo -e "\033[0;33mResultado: corrija lo indicado y vuelva a ejecutar.\033[0m"
    echo -e "\033[0;33mLuego: ./iniciar.sh\033[0m"
  else
    echo -e "\033[0;32mResultado: listo para ./iniciar.sh\033[0m"
    echo -e "\033[0;90m(Si acaba de unirse al grupo docker, cierre sesion o ejecute: newgrp docker)\033[0m"
  fi
  echo ""
}

exit "$FAILED"
