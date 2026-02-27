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
Write-Host "    Esperando que la API este lista (hasta 60s)..."
$waitOutFile = Join-Path $env:TEMP "wait_for_api_health.out.log"
$waitErrFile = Join-Path $env:TEMP "wait_for_api_health.err.log"
if (Test-Path $waitOutFile) { Remove-Item $waitOutFile -Force }
if (Test-Path $waitErrFile) { Remove-Item $waitErrFile -Force }
$waitProc = Start-Process -FilePath "docker" `
  -ArgumentList @("compose", "--profile", "prod", "run", "--rm", "api-v1", "python", "/app/scripts/wait_for_api_health.py", "60") `
  -NoNewWindow -PassThru -Wait `
  -RedirectStandardOutput $waitOutFile `
  -RedirectStandardError $waitErrFile
$waitExitCode = $waitProc.ExitCode
if ($waitExitCode -ne 0) {
  if (Test-Path $waitOutFile) { Get-Content $waitOutFile | Write-Host }
  if (Test-Path $waitErrFile) { Get-Content $waitErrFile | Write-Host }
  throw "La API no respondio en /health despues de 60s. Verifique que api-v1 este corriendo."
}
if (Test-Path $waitOutFile) { Remove-Item $waitOutFile -Force }
if (Test-Path $waitErrFile) { Remove-Item $waitErrFile -Force }
docker compose --profile prod run --rm api-v1 sh -lc "cd /app && python scripts/smoke_api_v1_health_login.py"

Write-Host "[8/8] Verificando conectividad MySQL (sync/import)..."
$mysqlOutFile = Join-Path $env:TEMP "verify_mysql_connectivity.out.log"
$mysqlErrFile = Join-Path $env:TEMP "verify_mysql_connectivity.err.log"
if (Test-Path $mysqlOutFile) { Remove-Item $mysqlOutFile -Force }
if (Test-Path $mysqlErrFile) { Remove-Item $mysqlErrFile -Force }
$mysqlProc = Start-Process -FilePath "docker" `
  -ArgumentList @("compose", "--profile", "prod", "run", "--rm", "api-v1", "sh", "-lc", "cd /app && python scripts/verify_mysql_connectivity.py") `
  -NoNewWindow -PassThru -Wait `
  -RedirectStandardOutput $mysqlOutFile `
  -RedirectStandardError $mysqlErrFile
$mysqlExitCode = $mysqlProc.ExitCode
$mysqlOut = if (Test-Path $mysqlOutFile) { Get-Content $mysqlOutFile -Raw } else { "" }
$mysqlErr = if (Test-Path $mysqlErrFile) { Get-Content $mysqlErrFile -Raw } else { "" }
$mysqlVerify = ($mysqlOut + "`n" + $mysqlErr).Trim()
if (Test-Path $mysqlOutFile) { Remove-Item $mysqlOutFile -Force }
if (Test-Path $mysqlErrFile) { Remove-Item $mysqlErrFile -Force }
if ($mysqlExitCode -eq 0) {
  Write-Host $mysqlVerify
  Write-Host "MySQL: OK. Listo para sync/import."
} else {
  Write-Host $mysqlVerify
  Write-Host "ADVERTENCIA: MySQL no disponible. Configure MYSQL_* en .env y ejecute: python scripts/verify_mysql_connectivity.py"
}

Write-Host "Bootstrap from zero completado."
