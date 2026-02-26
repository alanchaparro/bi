#!/usr/bin/env bash
# Launcher un solo clic (Linux/Mac): comprueba Docker, crea .env si falta,
# pregunta opcionalmente usuario/contraseña admin, ejecuta bootstrap y levanta el stack prod.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

step() { printf '\033[0;36m[%s]\033[0m %s\n' "$1" "$2"; }
fail() { echo "$1" >&2; exit 1; }

# --- 1) Comprobar Docker y Docker Compose ---
step "1" "Comprobando Docker y Docker Compose..."
if ! docker info &>/dev/null; then
  fail "Docker no esta instalado o no esta en ejecucion. Instale Docker (Desktop o engine) y asegurese de que este corriendo."
fi
if ! docker compose version &>/dev/null; then
  fail "Docker Compose no esta disponible. Instale Docker Compose V2 (incluido con Docker Desktop)."
fi

# --- 2) Crear .env desde .env.example si no existe ---
step "2" "Configuracion .env..."
if [[ ! -f .env ]]; then
  if [[ ! -f .env.example ]]; then
    fail "No se encuentra .env.example en la raiz del proyecto."
  fi
  cp .env.example .env
  echo "    Creado .env desde .env.example."
else
  echo "    .env ya existe."
fi

# --- 3) Pregunta opcional: configurar usuario y contraseña admin ---
admin_user=""
admin_password=""
echo ""
read -r -p "¿Desea configurar ahora el usuario y contraseña del administrador? (s/N): " resp
if [[ "$resp" =~ ^[sS] ]]; then
  read -r -p "Usuario (Enter = admin): " admin_user
  admin_user="${admin_user:-admin}"
  read -r -s -p "Contraseña: " admin_password
  echo ""
  # Actualizar .env reemplazando las dos lineas
  tmp_env=$(mktemp)
  while IFS= read -r line; do
    if [[ "$line" =~ ^DEMO_ADMIN_USER= ]]; then echo "DEMO_ADMIN_USER=$admin_user"; continue; fi
    if [[ "$line" =~ ^DEMO_ADMIN_PASSWORD= ]]; then echo "DEMO_ADMIN_PASSWORD=$admin_password"; continue; fi
    printf '%s\n' "$line"
  done < .env > "$tmp_env" && mv "$tmp_env" .env
  echo "    Configuracion guardada en .env."
else
  admin_user="admin"
  admin_password="change_me_demo_admin_password"
  while IFS= read -r line; do
    if [[ "$line" =~ ^DEMO_ADMIN_USER=(.+)$ ]]; then admin_user="${BASH_REMATCH[1]}" || true; fi
    if [[ "$line" =~ ^DEMO_ADMIN_PASSWORD=(.+)$ ]]; then admin_password="${BASH_REMATCH[1]}" || true; fi
  done < .env
fi

# --- 4) Bootstrap: Postgres, migraciones, usuarios, verificacion ---
step "3" "Ejecutando bootstrap (PostgreSQL, migraciones, usuarios, verificacion)..."
docker compose --profile prod up -d postgres

echo "    Esperando readiness de PostgreSQL..."
max_attempts=60
for ((i=0; i<max_attempts; i++)); do
  if docker compose --profile prod exec -T postgres sh -lc "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}" &>/dev/null; then
    break
  fi
  sleep 2
done
if ! docker compose --profile prod exec -T postgres sh -lc "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}" &>/dev/null; then
  fail "PostgreSQL no esta listo despues de esperar."
fi

docker compose --profile prod run --rm api-v1 sh -lc "cd /app && PYTHONPATH=/app/backend alembic -c backend/alembic.ini upgrade head"
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/bootstrap_auth_users.py"
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/migrate_legacy_config_to_db.py"
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/verify_legacy_config_migration.py"

docker compose --profile prod up -d api-v1
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python - <<'PY'
import json, urllib.request
h = json.loads(urllib.request.urlopen('http://api-v1:8000/api/v1/health', timeout=15).read().decode('utf-8'))
assert h.get('ok') is True, h
print('health_ok')
PY"
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python - <<PY
import json, os, urllib.request
username = os.getenv('DEMO_ADMIN_USER', 'admin')
password = os.getenv('DEMO_ADMIN_PASSWORD', 'change_me_demo_admin_password')
payload = json.dumps({'username': username, 'password': password}).encode('utf-8')
req = urllib.request.Request('http://api-v1:8000/api/v1/auth/login', data=payload, method='POST', headers={'Content-Type': 'application/json'})
res = json.loads(urllib.request.urlopen(req, timeout=15).read().decode('utf-8'))
assert res.get('access_token'), res
print('login_ok')
PY"

# --- 5) Activar admin one-shot ---
step "4" "Activando usuario administrador..."
if ! docker compose --profile prod run --rm dashboard python scripts/first_run_enable_admin_once.py --admin-user "$admin_user" --admin-password "$admin_password"; then
  exc=$?
  # Codigo 3 = one-shot ya ejecutado (re-ejecucion); continuamos
  [[ $exc -eq 3 ]] || exit $exc
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
echo "  Contraseña: (la que configuro)"
echo ""
if command -v xdg-open &>/dev/null; then
  xdg-open "$url" 2>/dev/null || true
elif command -v open &>/dev/null; then
  open "$url" 2>/dev/null || true
else
  echo "  Abra manualmente: $url"
fi
echo ""
read -r -p "Presione Enter para cerrar..."
