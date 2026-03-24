#!/usr/bin/env bash
# Launcher un solo clic (Linux/Mac): valida Docker, prepara .env, configura
# admin opcional, ejecuta bootstrap compartido, activa one-shot y levanta prod.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

step() { printf '\033[0;36m[%s]\033[0m %s\n' "$1" "$2"; }
fail() { echo "$1" >&2; exit 1; }
random_token() {
  local len="${1:-48}"
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<PY
import secrets
print(secrets.token_urlsafe($len)[:$len])
PY
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$len"
    echo ""
  fi
}
set_env_value() {
  local key="$1"
  local value="$2"
  local tmp_env
  tmp_env="$(mktemp)"
  awk -F= -v key="$key" -v value="$value" '
    BEGIN { replaced=0 }
    $1 == key { print key "=" value; replaced=1; next }
    { print $0 }
    END { if (!replaced) print key "=" value }
  ' .env > "$tmp_env"
  mv "$tmp_env" .env
}

# --- 1) Comprobar Docker y Docker Compose ---
step "1" "Comprobando Docker y Docker Compose..."
if ! docker info >/dev/null 2>&1; then
  fail "Docker no esta instalado o no esta en ejecucion. Instale Docker y arranquelo."
fi
if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose V2 no esta disponible."
fi

# --- 2) Crear .env desde .env.example si no existe ---
step "2" "Configuracion .env..."
if [[ ! -f .env ]]; then
  if [[ ! -f .env.example ]]; then
    fail "No se encontro .env.example en la raiz del proyecto."
  fi
  cp .env.example .env
  echo "    Creado .env desde .env.example."
else
  echo "    .env ya existe."
fi

app_env="$(awk -F= '/^APP_ENV=/{print $2; exit}' .env 2>/dev/null || true)"
if [[ "${app_env:-}" != "prod" ]]; then
  set_env_value "APP_ENV" "prod"
  echo "    APP_ENV ajustado automaticamente a prod para launcher one-click."
fi
app_env="$(awk -F= '/^APP_ENV=/{print $2; exit}' .env 2>/dev/null || true)"
if [[ "${app_env:-}" != "prod" ]]; then
  fail "No se pudo dejar APP_ENV=prod en .env. Corrija permisos del archivo e intente nuevamente."
fi

jwt_secret="$(awk -F= '/^JWT_SECRET_KEY=/{print $2; exit}' .env 2>/dev/null || true)"
if [[ -z "${jwt_secret:-}" || "${jwt_secret}" == change_me* ]]; then
  set_env_value "JWT_SECRET_KEY" "$(random_token 64)"
  echo "    JWT_SECRET_KEY generado automaticamente para prod."
fi

jwt_refresh_secret="$(awk -F= '/^JWT_REFRESH_SECRET_KEY=/{print $2; exit}' .env 2>/dev/null || true)"
if [[ -z "${jwt_refresh_secret:-}" || "${jwt_refresh_secret}" == change_me* ]]; then
  set_env_value "JWT_REFRESH_SECRET_KEY" "$(random_token 64)"
  echo "    JWT_REFRESH_SECRET_KEY generado automaticamente para prod."
fi

pg_password="$(awk -F= '/^POSTGRES_PASSWORD=/{print $2; exit}' .env 2>/dev/null || true)"
if [[ -z "${pg_password:-}" || "${pg_password}" == change_me* ]]; then
  pg_password="$(random_token 32)"
  set_env_value "POSTGRES_PASSWORD" "$pg_password"
  echo "    POSTGRES_PASSWORD generado automaticamente para prod."
fi

pg_user="$(awk -F= '/^POSTGRES_USER=/{print $2; exit}' .env 2>/dev/null || true)"
if [[ -z "${pg_user:-}" ]]; then
  pg_user="cobranzas_user"
  set_env_value "POSTGRES_USER" "$pg_user"
fi

pg_db="$(awk -F= '/^POSTGRES_DB=/{print $2; exit}' .env 2>/dev/null || true)"
if [[ -z "${pg_db:-}" ]]; then
  pg_db="cobranzas_prod"
  set_env_value "POSTGRES_DB" "$pg_db"
fi

database_url="$(awk -F= '/^DATABASE_URL=/{print $2; exit}' .env 2>/dev/null || true)"
if [[ -z "${database_url:-}" || "${database_url}" == *change_me* ]]; then
  set_env_value "DATABASE_URL" "postgresql+psycopg2://${pg_user}:${pg_password}@postgres:5432/${pg_db}"
  echo "    DATABASE_URL ajustado automaticamente para prod."
fi

# --- 3) Configuracion opcional de credenciales admin ---
admin_user=""
admin_password=""
echo ""
read -r -p "Desea configurar ahora el usuario y contrasena del administrador? (s/N): " resp
if [[ "$resp" =~ ^[sS] ]]; then
  read -r -p "Usuario (Enter = admin): " admin_user
  admin_user="${admin_user:-admin}"
  read -r -s -p "Contrasena: " admin_password
  echo ""

  tmp_env="$(mktemp)"
  while IFS= read -r line; do
    if [[ "$line" =~ ^DEMO_ADMIN_USER= ]]; then
      echo "DEMO_ADMIN_USER=$admin_user"
      continue
    fi
    if [[ "$line" =~ ^DEMO_ADMIN_PASSWORD= ]]; then
      echo "DEMO_ADMIN_PASSWORD=$admin_password"
      continue
    fi
    printf '%s\n' "$line"
  done < .env > "$tmp_env"
  mv "$tmp_env" .env
  echo "    Configuracion guardada en .env."
else
  admin_user="admin"
  admin_password="change_me_demo_admin_password"
  while IFS= read -r line; do
    if [[ "$line" =~ ^DEMO_ADMIN_USER=(.+)$ ]]; then
      admin_user="${BASH_REMATCH[1]}"
    fi
    if [[ "$line" =~ ^DEMO_ADMIN_PASSWORD=(.+)$ ]]; then
      admin_password="${BASH_REMATCH[1]}"
    fi
  done < .env
fi

# --- 4) Bootstrap compartido: postgres, migraciones, usuarios, smoke ---
step "3" "Ejecutando bootstrap compartido..."
bash "$SCRIPT_DIR/scripts/prod_bootstrap_from_zero.sh"

# --- 5) Activar admin one-shot ---
step "4" "Activando usuario administrador..."
if docker compose --profile prod run --rm api-v1 python scripts/first_run_enable_admin_once.py --admin-user "$admin_user" --admin-password "$admin_password"; then
  :
else
  exit_code=$?
  # Codigo 3: one-shot ya consumido; continuar.
  [[ $exit_code -eq 3 ]] || exit "$exit_code"
fi

# --- 6) Levantar stack prod completo ---
step "5" "Levantando todos los servicios (API y frontend)..."
docker compose --profile prod up -d
sleep 3

# --- 7) Abrir navegador y resumen ---
url="http://localhost:8080"
step "6" "Listo."
echo ""
echo "  URL:       $url"
echo "  Usuario:   $admin_user"
echo "  Contrasena: (la que configuro)"
echo ""
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$url" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "$url" >/dev/null 2>&1 || true
else
  echo "  Abra manualmente: $url"
fi
echo ""
read -r -p "Presione Enter para cerrar..."
