$ErrorActionPreference = "Stop"

Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Host "[1/7] Levantando PostgreSQL..."
docker compose --profile prod up -d postgres

Write-Host "[2/7] Esperando readiness de PostgreSQL..."
$maxAttempts = 60
for ($i = 0; $i -lt $maxAttempts; $i++) {
  $ready = docker compose --profile prod exec -T postgres sh -lc "pg_isready -U $env:POSTGRES_USER -d $env:POSTGRES_DB" 2>$null
  if ($LASTEXITCODE -eq 0) {
    break
  }
  Start-Sleep -Seconds 2
}
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL no esta listo despues de esperar."
}

Write-Host "[3/7] Ejecutando migraciones..."
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && PYTHONPATH=/app/backend alembic -c backend/alembic.ini upgrade head"

Write-Host "[4/7] Bootstrap usuarios auth..."
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/bootstrap_auth_users.py"

Write-Host "[5/7] Migrando configuracion legacy..."
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/migrate_legacy_config_to_db.py"

Write-Host "[6/7] Verificando migracion de configuracion..."
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/verify_legacy_config_migration.py"

Write-Host "[7/7] Smoke de API (health + login)..."
docker compose --profile prod up -d api-v1
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python - <<'PY'\nimport json, urllib.request\nh = json.loads(urllib.request.urlopen('http://api-v1:8000/api/v1/health', timeout=15).read().decode('utf-8'))\nassert h.get('ok') is True, h\nprint('health_ok')\nPY"
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python - <<'PY'\nimport json, os, urllib.request\nusername = os.getenv('DEMO_ADMIN_USER', 'admin')\npassword = os.getenv('DEMO_ADMIN_PASSWORD', 'change_me_demo_admin_password')\npayload = json.dumps({'username': username, 'password': password}).encode('utf-8')\nreq = urllib.request.Request('http://api-v1:8000/api/v1/auth/login', data=payload, method='POST', headers={'Content-Type': 'application/json'})\nres = json.loads(urllib.request.urlopen(req, timeout=15).read().decode('utf-8'))\nassert res.get('access_token'), res\nprint('login_ok')\nPY"

Write-Host "Bootstrap from zero completado."
