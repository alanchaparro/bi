#Requires -Version 5.1
<#
.SYNOPSIS
  Launcher un solo clic: comprueba Docker, crea .env si falta, pregunta opcionalmente
  usuario/contraseña admin, ejecuta bootstrap, activa admin y levanta el stack prod.
#>
$ErrorActionPreference = "Stop"
$ProjectRoot = Join-Path $PSScriptRoot ".."
Set-Location -Path $ProjectRoot

function Write-Step { param($Message) Write-Host $Message -ForegroundColor Cyan }
function Write-Fail { param($Message) Write-Host $Message -ForegroundColor Red; exit 1 }

# --- 1) Comprobar Docker y Docker Compose ---
Write-Step "[1] Comprobando Docker y Docker Compose..."
try {
  $null = docker info 2>&1
  if ($LASTEXITCODE -ne 0) { throw "docker info fallo" }
} catch {
  Write-Fail "Docker no esta instalado o no esta en ejecucion. Instale Docker Desktop y asegurese de que este corriendo."
}
try {
  $null = docker compose version 2>&1
  if ($LASTEXITCODE -ne 0) { throw "docker compose fallo" }
} catch {
  Write-Fail "Docker Compose no esta disponible. Instale Docker Desktop (incluye Compose) o Docker Compose V2."
}

# --- 2) Crear .env desde .env.example si no existe ---
Write-Step "[2] Configuracion .env..."
$envExample = Join-Path $ProjectRoot ".env.example"
$envFile = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envFile)) {
  if (-not (Test-Path $envExample)) { Write-Fail "No se encuentra .env.example en la raiz del proyecto." }
  Copy-Item -Path $envExample -Destination $envFile
  Write-Host "    Creado .env desde .env.example."
} else {
  Write-Host "    .env ya existe."
}

# --- 3) Pregunta opcional: configurar usuario y contraseña admin ---
$adminUser = $null
$adminPassword = $null
Write-Host ""
$resp = Read-Host "¿Desea configurar ahora el usuario y contraseña del administrador? (s/N)"
if ($resp -match '^[sS]') {
  $adminUser = Read-Host "Usuario (Enter = admin)"
  if ([string]::IsNullOrWhiteSpace($adminUser)) { $adminUser = "admin" }
  $adminPassword = Read-Host "Contraseña" -AsSecureString
  $adminPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPassword))
  # Actualizar .env para que bootstrap_auth_users y first_run usen estos valores
  $content = Get-Content -Path $envFile -Raw -Encoding UTF8
  $content = $content -replace '(?m)^DEMO_ADMIN_USER=.*', "DEMO_ADMIN_USER=$adminUser"
  $content = $content -replace '(?m)^DEMO_ADMIN_PASSWORD=.*', "DEMO_ADMIN_PASSWORD=$adminPasswordPlain"
  Set-Content -Path $envFile -Value $content -NoNewline -Encoding UTF8
  $adminPassword = $adminPasswordPlain
  Write-Host "    Configuracion guardada en .env."
} else {
  # Leer valores actuales del .env para pasarlos a first_run_enable_admin_once
  $content = Get-Content -Path $envFile -Encoding UTF8
  foreach ($line in $content) {
    if ($line -match '^\s*DEMO_ADMIN_USER=(.+)$') { $adminUser = $matches[1].Trim() }
    if ($line -match '^\s*DEMO_ADMIN_PASSWORD=(.+)$') { $adminPassword = $matches[1].Trim() }
  }
  if (-not $adminUser) { $adminUser = "admin" }
  if (-not $adminPassword) { $adminPassword = "change_me_demo_admin_password" }
}

# --- 4) Ejecutar bootstrap from zero ---
Write-Step "[3] Ejecutando bootstrap (PostgreSQL, migraciones, usuarios, verificacion)..."
& (Join-Path $PSScriptRoot "prod_bootstrap_from_zero.ps1")

# --- 5) Activar admin one-shot ---
Write-Step "[4] Activando usuario administrador..."
& docker compose --profile prod run --rm dashboard python scripts/first_run_enable_admin_once.py --admin-user $adminUser --admin-password $adminPassword
if ($LASTEXITCODE -eq 3) {
  Write-Host "    One-shot ya ejecutado previamente; se continua sin error."
} elseif ($LASTEXITCODE -ne 0) {
  Write-Fail "Error al activar usuario admin."
}

# --- 6) Levantar stack prod (postgres, api-v1, frontend-prod) ---
Write-Step "[5] Levantando todos los servicios (API y frontend)..."
docker compose --profile prod up -d
if ($LASTEXITCODE -ne 0) { Write-Fail "Error al levantar servicios." }

# Esperar un poco a que el frontend este listo
Start-Sleep -Seconds 3

# --- 7) Abrir navegador y resumen ---
$url = "http://localhost:8080"
Write-Step "[6] Listo."
Write-Host ""
Write-Host "  URL:       $url" -ForegroundColor Green
Write-Host "  Usuario:   $adminUser"
Write-Host "  Contrasena: (la que configuro)"
Write-Host ""
Write-Host "  Abriendo el navegador..."
try {
  Start-Process $url
} catch {
  Write-Host "  No se pudo abrir el navegador. Abra manualmente: $url"
}
Write-Host ""
Write-Host "  Presione Enter en la ventana siguiente para cerrar."
