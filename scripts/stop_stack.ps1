#Requires -Version 5.1
<#
.SYNOPSIS
  Detiene todos los contenedores de este proyecto creados con Docker Compose.

.NOTES
  - Ejecuta: docker compose --profile "*" down --remove-orphans
  - En este repo todos los servicios usan `profiles`; un `down` sin `--profile` puede no incluirlos.
  - No usa -v: los volúmenes (p. ej. pgdata_prod) se conservan.
#>
$ErrorActionPreference = "Stop"
$ProjectRoot = Join-Path $PSScriptRoot ".."
Set-Location -Path $ProjectRoot

Write-Host "[1] Deteniendo contenedores Docker del proyecto (todos los perfiles compose)..." -ForegroundColor Cyan
docker compose --profile "*" down --remove-orphans
if ($LASTEXITCODE -ne 0) {
  Write-Host "Error: docker compose down fallo (codigo $LASTEXITCODE)." -ForegroundColor Red
  exit $LASTEXITCODE
}
Write-Host "    Listo. Volúmenes de datos (p. ej. PostgreSQL) no se eliminaron." -ForegroundColor Green
