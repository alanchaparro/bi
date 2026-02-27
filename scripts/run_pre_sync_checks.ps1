# Verificaciones antes de ejecutar sync/import.
# Uso: .\scripts\run_pre_sync_checks.ps1
$ErrorActionPreference = "Continue"
Set-Location -Path (Join-Path $PSScriptRoot "..")

Write-Host "=== Verificaciones pre-sync ===" -ForegroundColor Cyan
Write-Host ""

# 1. MySQL
Write-Host "[1] MySQL..." -ForegroundColor Yellow
$mysqlExit = 0
python scripts/verify_mysql_connectivity.py 2>&1 | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
  $mysqlExit = $LASTEXITCODE
  Write-Host "   Sugerencia: Si la app corre en Docker y MySQL en el host, use MYSQL_HOST=host.docker.internal en .env" -ForegroundColor DarkYellow
}
Write-Host ""

# 2. Diagnóstico completo (API + MySQL + env)
Write-Host "[2] Diagnostico API + MySQL + .env..." -ForegroundColor Yellow
python scripts/diagnose_sync_connectivity.py 2>&1 | ForEach-Object { Write-Host $_ }
$diagExit = $LASTEXITCODE
Write-Host ""

if ($mysqlExit -ne 0 -or $diagExit -ne 0) {
  Write-Host "Algunas comprobaciones fallaron. Corrija .env y/o que API/MySQL esten en ejecucion antes de ejecutar la carga." -ForegroundColor Red
  exit 1
}
Write-Host "Verificaciones OK. Puede ejecutar la carga desde Config > Importaciones." -ForegroundColor Green
exit 0
