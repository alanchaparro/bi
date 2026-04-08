<#
  Resuelve LAN_HTTP_PORT para perfil prod-lan: parámetro -LanPort, o pregunta interactiva,
  o lectura de .env si no hay TTY (CI / redirección).
  (Sin #Requires: este archivo se dot-source desde otros .ps1 que ya exigen 5.1;
  en algunos entornos #Requires aqui impide el dot-source y falla REINICIAR_LAN.)
#>

function Get-DotEnvKeyValue {
  param([string]$Path, [string]$Key)
  if (-not (Test-Path $Path)) { return $null }
  $line = Get-Content -Path $Path -Encoding UTF8 | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return (($line -split "=", 2)[1]).Trim()
}

function Set-DotEnvKeyValue {
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

function Test-ValidTcpPort {
  param([int]$P)
  return ($P -ge 1 -and $P -le 65535)
}

function Resolve-LanHttpPort {
  param(
    [Parameter(Mandatory = $true)][string]$EnvFilePath,
    [ValidateRange(0, 65535)]
    [int]$LanPort = 0
  )

  $current = [string](Get-DotEnvKeyValue -Path $EnvFilePath -Key "LAN_HTTP_PORT")
  if ([string]::IsNullOrWhiteSpace($current)) { $current = "80" }

  if (Test-ValidTcpPort -P $LanPort) {
    Set-DotEnvKeyValue -Path $EnvFilePath -Key "LAN_HTTP_PORT" -Value "$LanPort"
    Write-Host "    LAN_HTTP_PORT=$LanPort guardado en .env" -ForegroundColor DarkGreen
    return "$LanPort"
  }

  $canPrompt = $false
  try {
    $canPrompt = [Environment]::UserInteractive -and -not [Console]::IsInputRedirected
  } catch {
    $canPrompt = $false
  }

  if (-not $canPrompt) {
    Write-Host "    LAN_HTTP_PORT desde .env: $current (sin TTY, no se pregunta)" -ForegroundColor DarkGray
    return $current
  }

  Write-Host ""
  Write-Host "  Puerto HTTP en ESTA maquina para acceso LAN (nginx del compose)." -ForegroundColor Yellow
  Write-Host "  Ej.: 80 (por defecto), 8088 si el 80 esta ocupado (Apache/IIS)." -ForegroundColor DarkGray
  Write-Host ""

  while ($true) {
    $inp = Read-Host "  Puerto LAN_HTTP_PORT [Enter = mantener $current]"
    if ([string]::IsNullOrWhiteSpace($inp)) {
      return $current
    }
    if ($inp -match '^\d+$') {
      $n = [int]$inp
      if (Test-ValidTcpPort -P $n) {
        Set-DotEnvKeyValue -Path $EnvFilePath -Key "LAN_HTTP_PORT" -Value "$n"
        Write-Host "    LAN_HTTP_PORT=$n guardado en .env" -ForegroundColor DarkGreen
        return "$n"
      }
    }
    Write-Host "  Use un numero entre 1 y 65535, o Enter para mantener $current." -ForegroundColor Red
  }
}
