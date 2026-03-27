#Requires -Version 5.1
<#
.SYNOPSIS
  Levanta el stack con perfil Docker Compose "prod-lan": nginx + API + front + sync + Postgres.
  Pensado para acceder desde otras PCs en la LAN mediante la IP del servidor (una sola URL/puerto).

.NOTES
  - Detiene antes todos los servicios del proyecto (todos los perfiles) para evitar conflictos
    entre api-v1/prod y api-v1-lan, y puertos duplicados.
  - Los volúmenes (p. ej. PostgreSQL) no se eliminan.
  - Primera instalación: ejecutar antes scripts\start_one_click.ps1 (INICIAR.bat) o el bootstrap
    documentado, para tener BD y usuarios. Este script asume .env ya configurado.
#>
$ErrorActionPreference = "Stop"
$ProjectRoot = Join-Path $PSScriptRoot ".."
Set-Location -Path $ProjectRoot

function Write-Step { param($Message) Write-Host $Message -ForegroundColor Cyan }
function Write-Fail { param($Message) Write-Host $Message -ForegroundColor Red; exit 1 }

function Get-EnvValue {
  param([string]$Path, [string]$Key)
  if (-not (Test-Path $Path)) { return $null }
  $line = Get-Content -Path $Path -Encoding UTF8 | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return (($line -split "=", 2)[1]).Trim()
}

function Set-EnvValue {
  param([string]$Path, [string]$Key, [string]$Value)
  if (-not (Test-Path $Path)) { throw "No se encontro: $Path" }
  $raw = Get-Content -Path $Path -Raw -Encoding UTF8
  if ($raw -match "(?m)^\s*$Key\s*=") {
    $raw = $raw -replace "(?m)^\s*$Key\s*=.*$", "$Key=$Value"
  } else {
    if ($raw.Length -gt 0 -and -not $raw.EndsWith("`n")) { $raw += "`r`n" }
    $raw += "$Key=$Value`r`n"
  }
  Set-Content -Path $Path -Value $raw -NoNewline -Encoding UTF8
}

function New-RandomToken {
  param([int]$Length = 48)
  $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  $sb = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $Length; $i++) {
    [void]$sb.Append($chars[(Get-Random -Minimum 0 -Maximum $chars.Length)])
  }
  return $sb.ToString()
}

function Ensure-ProdSecrets {
  param([Parameter(Mandatory = $true)][string]$EnvPath)

  $jwtSecret = [string](Get-EnvValue -Path $EnvPath -Key "JWT_SECRET_KEY")
  if ([string]::IsNullOrWhiteSpace($jwtSecret) -or $jwtSecret.Trim().ToLowerInvariant().StartsWith("change_me")) {
    Set-EnvValue -Path $EnvPath -Key "JWT_SECRET_KEY" -Value (New-RandomToken -Length 64)
    Write-Host "    JWT_SECRET_KEY generado automaticamente." -ForegroundColor DarkYellow
  }

  $jwtRefresh = [string](Get-EnvValue -Path $EnvPath -Key "JWT_REFRESH_SECRET_KEY")
  if ([string]::IsNullOrWhiteSpace($jwtRefresh) -or $jwtRefresh.Trim().ToLowerInvariant().StartsWith("change_me")) {
    Set-EnvValue -Path $EnvPath -Key "JWT_REFRESH_SECRET_KEY" -Value (New-RandomToken -Length 64)
    Write-Host "    JWT_REFRESH_SECRET_KEY generado automaticamente." -ForegroundColor DarkYellow
  }

  $pgPassword = [string](Get-EnvValue -Path $EnvPath -Key "POSTGRES_PASSWORD")
  if ([string]::IsNullOrWhiteSpace($pgPassword) -or $pgPassword.Trim().ToLowerInvariant().StartsWith("change_me")) {
    $pgPassword = New-RandomToken -Length 32
    Set-EnvValue -Path $EnvPath -Key "POSTGRES_PASSWORD" -Value $pgPassword
    Write-Host "    POSTGRES_PASSWORD generado automaticamente." -ForegroundColor DarkYellow
  }

  $pgUser = [string](Get-EnvValue -Path $EnvPath -Key "POSTGRES_USER")
  if ([string]::IsNullOrWhiteSpace($pgUser)) {
    $pgUser = "cobranzas_user"
    Set-EnvValue -Path $EnvPath -Key "POSTGRES_USER" -Value $pgUser
  }

  $pgDb = [string](Get-EnvValue -Path $EnvPath -Key "POSTGRES_DB")
  if ([string]::IsNullOrWhiteSpace($pgDb)) {
    $pgDb = "cobranzas_prod"
    Set-EnvValue -Path $EnvPath -Key "POSTGRES_DB" -Value $pgDb
  }

  $databaseUrl = [string](Get-EnvValue -Path $EnvPath -Key "DATABASE_URL")
  if ([string]::IsNullOrWhiteSpace($databaseUrl) -or $databaseUrl.Trim().ToLowerInvariant().Contains("change_me")) {
    $databaseUrl = ("postgresql+psycopg2://{0}:{1}@postgres:5432/{2}" -f $pgUser, $pgPassword, $pgDb)
    Set-EnvValue -Path $EnvPath -Key "DATABASE_URL" -Value $databaseUrl
    Write-Host "    DATABASE_URL ajustado automaticamente." -ForegroundColor DarkYellow
  }
}

Write-Step "[1] Comprobando Docker..."
try {
  $null = docker info 2>&1
  if ($LASTEXITCODE -ne 0) { throw "docker info fallo" }
} catch {
  Write-Fail "Docker no esta en ejecucion. Inicie Docker Desktop."
}
try {
  $null = docker compose version 2>&1
  if ($LASTEXITCODE -ne 0) { throw "compose fallo" }
} catch {
  Write-Fail "Docker Compose no disponible."
}

Write-Step "[2] Archivo .env..."
$envExample = Join-Path $ProjectRoot ".env.example"
$envFile = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envFile)) {
  if (-not (Test-Path $envExample)) { Write-Fail "Falta .env.example en la raiz." }
  Copy-Item -Path $envExample -Destination $envFile
  Write-Host "    Creado .env desde .env.example; configure MYSQL_* y credenciales." -ForegroundColor Yellow
}

$appEnv = [string](Get-EnvValue -Path $envFile -Key "APP_ENV")
if ([string]::IsNullOrWhiteSpace($appEnv) -or $appEnv.Trim().ToLowerInvariant() -ne "prod") {
  Set-EnvValue -Path $envFile -Key "APP_ENV" -Value "prod"
  Write-Host "    APP_ENV=prod (requerido para chequeos de produccion)." -ForegroundColor DarkYellow
}

Ensure-ProdSecrets -EnvPath $envFile

$httpPort = [string](Get-EnvValue -Path $envFile -Key "LAN_HTTP_PORT")
if ([string]::IsNullOrWhiteSpace($httpPort)) { $httpPort = "80" }

Write-Step "[3] Deteniendo servicios previos del proyecto (evita conflicto prod vs prod-lan)..."
docker compose --profile "*" down --remove-orphans
if ($LASTEXITCODE -ne 0) {
  Write-Fail "docker compose down fallo (codigo $LASTEXITCODE)."
}

Write-Step "[4] Levantando perfil prod-lan (build incluido)..."
docker compose --profile prod-lan up -d --build
if ($LASTEXITCODE -ne 0) {
  Write-Fail "docker compose prod-lan fallo (codigo $LASTEXITCODE)."
}

Start-Sleep -Seconds 2

Write-Step "[5] Listo — acceso en red (ejemplos)"
Write-Host ""
$localUrl = if ($httpPort -eq "80") { "http://localhost/" } else { "http://localhost:$httpPort/" }
Write-Host "  En este equipo: $localUrl" -ForegroundColor Green

$ips = @()
try {
  $ips = @(
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -and
        $_.IPAddress -notmatch '^127\.' -and
        $_.PrefixOrigin -ne 'WellKnown'
      } |
      Select-Object -ExpandProperty IPAddress -Unique
  )
} catch {
  $ips = @()
}

if ($ips.Count -gt 0) {
  foreach ($ip in $ips) {
    $u = if ($httpPort -eq "80") { "http://$ip/" } else { "http://${ip}:$httpPort/" }
    Write-Host "  Desde la LAN:   $u" -ForegroundColor Green
  }
} else {
  Write-Host "  Desde la LAN:   http://<IP_DE_ESTA_PC>$(if ($httpPort -ne "80") { ":$httpPort" })/" -ForegroundColor Yellow
  Write-Host "                 (No se pudieron listar IPv4 automaticamente; use ipconfig.)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "  Health API: $($localUrl -replace '/$','')/api/v1/health" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Si el puerto $httpPort no abre desde otra PC, abra el firewall de Windows para TCP $httpPort en la red privada." -ForegroundColor DarkYellow
Write-Host ""
