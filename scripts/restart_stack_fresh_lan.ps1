#Requires -Version 5.1
<#
.SYNOPSIS
  Reinicio limpio del stack Docker para perfil prod-lan: baja todos los perfiles,
  elimina imágenes locales del compose, rebuild sin cache y levanta prod-lan.

.NOTES
  - Equivale a rebuild forzado + up prod-lan (LAN: nginx + API + front en un puerto).
  - Los volúmenes (p. ej. PostgreSQL) NO se borran.
  - Primera instalación: como mínimo bootstrap con start_one_click / INICIAR según docs.
#>
$ErrorActionPreference = "Stop"
$ProjectRoot = Join-Path $PSScriptRoot ".."
Set-Location -Path $ProjectRoot

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
Write-Host "  Reinicio limpio LAN: se detendran contenedores, se quitaran imagenes locales" -ForegroundColor Yellow
Write-Host "  de este proyecto (--rmi local), se reconstruira el perfil prod-lan sin cache y" -ForegroundColor Yellow
Write-Host "  se levantara de nuevo. Los volumenes (p. ej. PostgreSQL) NO se borran." -ForegroundColor Yellow
Write-Host ""

Write-Step "[2] Bajando stack (todos los perfiles) y eliminando imagenes locales del proyecto..."
docker compose --profile "*" down --remove-orphans --rmi local
if ($LASTEXITCODE -ne 0) { Write-Fail "Error: docker compose down fallo (codigo $LASTEXITCODE)." }

Write-Step "[3] Liberando cache de build no usada (docker builder prune -f)..."
docker builder prune -f
if ($LASTEXITCODE -ne 0) { Write-Fail "Error: docker builder prune fallo (codigo $LASTEXITCODE)." }

Write-Step "[4] Reconstruyendo imagenes del perfil prod-lan (--pull --no-cache)..."
docker compose --profile prod-lan build --pull --no-cache
if ($LASTEXITCODE -ne 0) { Write-Fail "Error: docker compose build fallo (codigo $LASTEXITCODE)." }

Write-Step "[5] Levantando perfil prod-lan..."
docker compose --profile prod-lan up -d
if ($LASTEXITCODE -ne 0) { Write-Fail "Error: docker compose up fallo (codigo $LASTEXITCODE)." }

Start-Sleep -Seconds 2
Write-Step "[6] Listo."
Write-Host ""

$lanPort = "80"
$envPath = Join-Path $ProjectRoot ".env"
if (Test-Path $envPath) {
  $line = Get-Content -Path $envPath -Encoding UTF8 | Where-Object { $_ -match '^\s*LAN_HTTP_PORT\s*=' } | Select-Object -First 1
  if ($line) {
    $v = (($line -split "=", 2)[1]).Trim()
    if ($v) { $lanPort = $v }
  }
}

if ($lanPort -eq "80") {
  Write-Host "  En este equipo: http://localhost/" -ForegroundColor Green
  Write-Host "  Health:         http://localhost/api/v1/health" -ForegroundColor Green
} else {
  Write-Host "  En este equipo: http://localhost:${lanPort}/" -ForegroundColor Green
  Write-Host "  Health:         http://localhost:${lanPort}/api/v1/health" -ForegroundColor Green
}

try {
  $ips = @()
  if (Get-Command hostname -ErrorAction SilentlyContinue) {
    $raw = hostname -I 2>$null
    if ($raw) { $ips = $raw.Trim() -split "\s+" | Where-Object { $_ -and $_ -notmatch '^127\.' } }
  }
  if ($ips.Count -eq 0 -and (Get-Command ip -ErrorAction SilentlyContinue)) {
    $ips = ip -4 -o addr show scope global 2>$null | ForEach-Object {
      if ($_ -match '\s(\d+\.\d+\.\d+\.\d+)/') { $Matches[1] }
    } | Where-Object { $_ -notmatch '^127\.' }
  }
  foreach ($ip in $ips) {
    if (-not $ip) { continue }
    if ($lanPort -eq "80") {
      Write-Host "  Desde la LAN:   http://${ip}/" -ForegroundColor Green
    } else {
      Write-Host "  Desde la LAN:   http://${ip}:${lanPort}/" -ForegroundColor Green
    }
  }
  if ($ips.Count -eq 0) {
    $suffix = if ($lanPort -ne "80") { ":${lanPort}" } else { "" }
    Write-Host "  Desde la LAN:   http://<IP_DE_ESTA_MAQUINA>${suffix}/" -ForegroundColor DarkGray
  }
} catch {
  $suffix = if ($lanPort -ne "80") { ":${lanPort}" } else { "" }
  Write-Host "  Desde la LAN:   http://<IP_DE_ESTA_MAQUINA>${suffix}/" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  Si necesita bootstrap, ejecute INICIAR.bat / iniciar.sh o INICIAR_LAN segun corresponda." -ForegroundColor DarkGray
Write-Host "  Abra el puerto TCP ${lanPort} en el cortafuegos si otras PCs no llegan." -ForegroundColor DarkGray
Write-Host ""
