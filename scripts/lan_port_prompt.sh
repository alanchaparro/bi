#!/usr/bin/env bash
# Pregunta el puerto LAN (prod-lan) y actualiza LAN_HTTP_PORT en .env.
# Uso: source scripts/lan_port_prompt.sh && LAN_PORT="$(resolve_lan_http_port /ruta/.env)"
# Salida solo el número de puerto por stdout; mensajes por stderr.

resolve_lan_http_port() {
  local envf="$1"
  local current="80"
  if [[ -f "$envf" ]] && grep -qE '^[[:space:]]*LAN_HTTP_PORT=' "$envf"; then
    current="$(grep -E '^[[:space:]]*LAN_HTTP_PORT=' "$envf" | head -1 | cut -d= -f2- | tr -d ' \r')"
    [[ -z "${current:-}" ]] && current="80"
  fi

  if [[ ! -t 0 ]]; then
    echo "$current"
    return 0
  fi

  echo "" >&2
  echo "  Puerto HTTP en esta maquina para acceso LAN (nginx del compose)." >&2
  echo "  Ejemplos: 80 (por defecto), 8088 si el 80 esta ocupado." >&2
  echo "" >&2

  local input=""
  while true; do
    read -r -p "  Puerto LAN_HTTP_PORT [Enter = mantener ${current}]: " input || true
    input="$(echo -n "${input:-}" | tr -d ' \r')"
    if [[ -z "$input" ]]; then
      echo "$current"
      return 0
    fi
    if [[ "$input" =~ ^[0-9]+$ ]] && (( input >= 1 && input <= 65535 )); then
      if grep -qE '^[[:space:]]*LAN_HTTP_PORT=' "$envf" 2>/dev/null; then
        sed -i "s/^[[:space:]]*LAN_HTTP_PORT=.*/LAN_HTTP_PORT=$input/" "$envf"
      else
        echo "LAN_HTTP_PORT=$input" >> "$envf"
      fi
      echo "    LAN_HTTP_PORT=$input guardado en .env" >&2
      echo "$input"
      return 0
    fi
    echo "  Use un numero entre 1 y 65535, o Enter para mantener ${current}." >&2
  done
}
