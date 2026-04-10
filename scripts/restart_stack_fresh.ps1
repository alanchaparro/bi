#Requires -Version 5.1
<#
.SYNOPSIS
  Reinicio limpio del stack Docker: baja todos los perfiles, elimina imágenes locales
  generadas por este compose y vuelve a construir y levantar el perfil prod.

.NOTES
  - Equivale a DETENER + rebuild forzado + up prod, sin bootstrap ni first_run.
  - down:  docker compose --profile "*" down --remove-orphans --rmi local
  - build: docker compose --profile prod build --pull --no-cache
  - up:    docker compose --profile prod up -d
#>
$ErrorActionPreference = "Stop"
$ProjectRoot = Join-Path $PSScriptRoot ".."
Set-Location -Path $ProjectRoot

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Key
  )
  if (-not (Test-Path $Path)) { return $null }
  $line = Get-Content -Path $Path -Encoding UTF8 | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return (($line -split "=", 2)[1]).Trim()
}

function Write-Step { param($Message) Write-Host $Message -ForegroundColor Cyan }
function Write-Fail { param($Message) Write-Host $Message -ForegroundColor Red; exit 1 }

Write-Step "[1] Comprobando Docker y Docker Compose..."
try {
  $null = docker info 2>&1
  if ($LASTEXITCODE -ne 0) { throw "docker info fallo" }
} catch {
  Write-Fail "Docker no esta instalado o no esta en ejecucion."
}
try {
  $null = docker compose version 2>&1
  if ($LASTEXITCODE -ne 0) { throw "docker compose fallo" }
} catch {
  Write-Fail "Docker Compose V2 no esta disponible."
}

Write-Host ""
Write-Host "  Reinicio limpio: se detendran contenedores, se quitaran imagenes locales" -ForegroundColor Yellow
Write-Host "  de este proyecto (--rmi local), se reconstruira el perfil prod sin cache y" -ForegroundColor Yellow
Write-Host "  se levantara de nuevo. Los volumenes (p. ej. PostgreSQL) NO se borran." -ForegroundColor Yellow
Write-Host ""

Write-Step "[2] Bajando stack (todos los perfiles) y eliminando imagenes locales del proyecto..."
docker compose --profile "*" down --remove-orphans --rmi local
if ($LASTEXITCODE -ne 0) { Write-Fail "Error: docker compose down fallo (codigo $LASTEXITCODE)." }

Write-Step "[3] Liberando cache de build no usada (docker builder prune -f)..."
docker builder prune -f
if ($LASTEXITCODE -ne 0) { Write-Fail "Error: docker builder prune fallo (codigo $LASTEXITCODE)." }

Write-Step "[4] Reconstruyendo imagenes del perfil prod (--pull --no-cache)..."
docker compose --profile prod build --pull --no-cache
if ($LASTEXITCODE -ne 0) { Write-Fail "Error: docker compose build fallo (codigo $LASTEXITCODE)." }

Write-Step "[5] Levantando perfil prod..."
docker compose --profile prod up -d
if ($LASTEXITCODE -ne 0) { Write-Fail "Error: docker compose up fallo (codigo $LASTEXITCODE)." }

Write-Step "[6] Sincronizando version de migraciones y aplicando pendientes..."
# Fix known migration version mismatch: 0026_auth_role_nav_contratos -> 0026_auth_nav_config_subsections
$envFile = Join-Path $ProjectRoot ".env"
$pgUser = Get-EnvValue -Path $envFile -Key "POSTGRES_USER"
$pgDb = Get-EnvValue -Path $envFile -Key "POSTGRES_DB"
if ([string]::IsNullOrWhiteSpace($pgUser)) { $pgUser = "cobranzas_user" }
if ([string]::IsNullOrWhiteSpace($pgDb)) { $pgDb = "cobranzas_prod" }

$fixMigrationSql = "UPDATE alembic_version SET version_num = '0026_auth_nav_config_subsections' WHERE version_num = '0026_auth_role_nav_contratos';"
docker compose --profile prod exec -T postgres psql -U $pgUser -d $pgDb -c $fixMigrationSql

Write-Host "Ejecutando migraciones (alembic upgrade head)..."
docker compose --profile prod run --rm -w /app/backend -e PYTHONPATH=/app/backend api-v1 alembic upgrade head
if ($LASTEXITCODE -ne 0) { Write-Fail "Error: alembic upgrade head fallo (codigo $LASTEXITCODE)." }

Start-Sleep -Seconds 2
Write-Step "[7] Listo."
Write-Host ""
Write-Host "  Stack prod en marcha y migraciones aplicadas. Frontend tipico: http://localhost:8080" -ForegroundColor Green
Write-Host "  Si necesita bootstrap o admin one-shot, ejecute INICIAR.bat / iniciar.sh." -ForegroundColor DarkGray
Write-Host ""
