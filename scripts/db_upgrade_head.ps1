Param(
  [switch]$NoStart
)

$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if (-not $NoStart) {
  Write-Host "[db-upgrade] Levantando servicios requeridos (postgres, api-v1)..." -ForegroundColor Cyan
  docker compose --profile dev up -d postgres api-v1 | Out-Host
}

Write-Host "[db-upgrade] Ejecutando alembic upgrade head dentro de api-v1..." -ForegroundColor Cyan
docker compose exec api-v1 sh -lc "cd /app && PYTHONPATH=/app/backend python -m alembic -c backend/alembic.ini upgrade head" | Out-Host

Write-Host "[db-upgrade] Verificando revision actual..." -ForegroundColor Cyan
docker compose exec api-v1 sh -lc "cd /app && PYTHONPATH=/app/backend python -m alembic -c backend/alembic.ini current" | Out-Host

Write-Host "[db-upgrade] OK" -ForegroundColor Green

