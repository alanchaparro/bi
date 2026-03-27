#Requires -Version 5.1
<#
.SYNOPSIS
  Comprueba requisitos para levantar el proyecto (Docker + Compose V2).
.DESCRIPTION
  Uso normal: solo verifica. Con -Install intenta instalar Docker Desktop via winget (puede pedir UAC).
.PARAMETER Install
  Intenta instalar Docker Desktop si falta (Windows 10/11 con winget).
.PARAMETER Quiet
  Menos salida (útil para CI); sigue devolviendo código de salida distinto de 0 si falla.
#>
param(
  [switch]$Install,
  [switch]$Quiet
)

$ErrorActionPreference = "Continue"
$script:PrereqFailed = $false

function Write-Ok($msg) {
  if (-not $Quiet) { Write-Host "[OK]   $msg" -ForegroundColor Green }
}
function Write-Bad($msg) {
  Write-Host "[FALTA] $msg" -ForegroundColor Red
  $script:PrereqFailed = $true
}
function Write-Info($msg) {
  if (-not $Quiet) { Write-Host "       $msg" -ForegroundColor DarkGray }
}

$ProjectRoot = Join-Path $PSScriptRoot ".."
Set-Location -Path $ProjectRoot

if (-not $Quiet) {
  Write-Host ""
  Write-Host "=== Requisitos del proyecto (EPEM BI / Docker) ===" -ForegroundColor Cyan
  Write-Host ""
}

# --- PowerShell ---
$ver = $PSVersionTable.PSVersion
if ($ver.Major -lt 5 -or ($ver.Major -eq 5 -and $ver.Minor -lt 1)) {
  Write-Bad "PowerShell 5.1+ requerido (tiene $($ver.ToString()))."
} else {
  Write-Ok "PowerShell $($ver.ToString())"
}

# --- Git (opcional pero recomendado) ---
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
  Write-Ok "Git disponible"
} else {
  if (-not $Quiet) {
    Write-Host "[AVISO] Git no esta en PATH (opcional para clonar/actualizar)." -ForegroundColor Yellow
  }
}

# --- Docker CLI ---
$dockerBin = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerBin) {
  Write-Bad "Docker CLI no encontrado en PATH."
  if ($Install) {
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
      Write-Info "Instale winget o Docker Desktop manualmente: https://docs.docker.com/desktop/install/windows-install/"
    } else {
      Write-Host ""
      Write-Host "Intentando instalar Docker Desktop con winget (puede aparecer UAC)..." -ForegroundColor Yellow
      try {
        $proc = Start-Process -FilePath "winget" -ArgumentList @(
          "install", "-e", "--id", "Docker.DockerDesktop",
          "--accept-package-agreements", "--accept-source-agreements"
        ) -Wait -PassThru -NoNewWindow
        if ($proc.ExitCode -ne 0) {
          Write-Bad "winget termino con codigo $($proc.ExitCode). Instale Docker Desktop manualmente."
        } else {
          Write-Ok "Docker Desktop instalado. REINICIE Windows o inicie Docker Desktop y vuelva a ejecutar este script."
          $script:PrereqFailed = $true
        }
      } catch {
        Write-Bad "No se pudo ejecutar winget: $_"
      }
    }
  } else {
    Write-Info "Ejecute de nuevo con -Install para intentar instalar Docker Desktop (winget), o instale desde https://docs.docker.com/desktop/"
  }
} else {
  Write-Ok "Docker CLI en PATH"
  $null = docker info 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Bad "El motor Docker no responde. Inicie Docker Desktop y espere a que quede en ejecucion."
  } else {
    Write-Ok "Motor Docker en ejecucion"
  }
}

# --- Docker Compose V2 ---
if (Get-Command docker -ErrorAction SilentlyContinue) {
  $null = docker compose version 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Bad "Docker Compose V2 no disponible (necesita 'docker compose version'). Actualice Docker Desktop."
  } else {
    $cv = (docker compose version 2>&1 | Select-Object -First 1)
    Write-Ok "Docker Compose: $cv"
  }
}

# --- Archivos del repo ---
$envEx = Join-Path $ProjectRoot ".env.example"
if (-not (Test-Path $envEx)) {
  Write-Bad "No se encuentra .env.example en la raiz del repositorio."
} else {
  Write-Ok ".env.example presente"
}

if (-not (Test-Path (Join-Path $ProjectRoot "docker-compose.yml"))) {
  Write-Bad "No se encuentra docker-compose.yml"
} else {
  Write-Ok "docker-compose.yml presente"
}

if (-not $Quiet) {
  Write-Host ""
  if ($script:PrereqFailed) {
    Write-Host "Resultado: corrija lo indicado arriba y vuelva a ejecutar." -ForegroundColor Yellow
    Write-Host "Luego use INICIAR.bat para levantar el stack completo." -ForegroundColor Yellow
  } else {
    Write-Host "Resultado: listo para INICIAR.bat o scripts\start_one_click.ps1" -ForegroundColor Green
  }
  Write-Host ""
}

exit $(if ($script:PrereqFailed) { 1 } else { 0 })
