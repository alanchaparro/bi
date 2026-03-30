#requires -Version 5.1
<#
.SYNOPSIS
  Lee MYSQL_* desde .env (raíz del repo), ejecuta el cliente mysql en Docker y genera anexos en docs/archive/.

.DESCRIPTION
  - No escribe contraseñas en los archivos generados ni en la salida.
  - Pasa la clave a MySQL solo vía archivo temporal + docker --env-file (evita expansion de ! en PowerShell).
  - Salidas:
    - docs/archive/epem_mysql_verified_YYYY-MM-DD.md  (resumen + FKs de tablas núcleo v2)
    - docs/archive/epem_mysql_all_fks_YYYY-MM-DD.tsv (volcado completo TAB, sin secretos)

.PARAMETER EnvFile
  Ruta al .env (por defecto: .env en la raíz del repositorio).

.PARAMETER DateStamp
  Sufijo de fecha YYYY-MM-DD (por defecto: hoy en hora local).

.EXAMPLE
  .\scripts\dump_epem_fks.ps1
#>
param(
  [string]$EnvFile = "",
  [string]$DateStamp = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $EnvFile) { $EnvFile = Join-Path $RepoRoot ".env" }
if (-not $DateStamp) { $DateStamp = (Get-Date).ToString("yyyy-MM-dd") }

function Read-DotEnv {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "No se encuentra .env en: $Path"
  }
  $map = @{}
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^\s*#' -or $line -eq "") { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if ($val.Length -ge 2 -and $val.StartsWith('"') -and $val.EndsWith('"')) {
      $val = $val.Substring(1, $val.Length - 2) -replace '\\"', '"'
    }
    elseif ($val.Length -ge 2 -and $val.StartsWith("'") -and $val.EndsWith("'")) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  $map
}

function Test-DockerAvailable {
  & docker version 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker no está disponible o no responde. Instale/inicie Docker Desktop y reintente."
  }
}

function Convert-DockerMysqlOutput {
  param([object[]]$Lines)
  $list = New-Object System.Collections.Generic.List[string]
  foreach ($x in $Lines) {
    if ($null -eq $x) { continue }
    $s = if ($x -is [System.Management.Automation.ErrorRecord]) { $x.ToString() } else { "$x" }
    if ($s -match '^\s*$') { continue }
    if ($s -match 'mysql: \[Warning\]') { continue }
    [void]$list.Add($s)
  }
  ,$list.ToArray()
}

function Invoke-MysqlDocker {
  param(
    [string]$EnvFileForDocker,
    [string]$HostName,
    [int]$Port,
    [string]$User,
    [string]$Database,
    [string]$Sql
  )
  # --protocol=TCP evita que -h localhost use socket Unix dentro del contenedor (falla con ERROR 2002).
  $args = @(
    "run", "--rm",
    "--env-file", $EnvFileForDocker,
    "mysql:8", "mysql",
    "--protocol=TCP",
    "-h", $HostName,
    "-P", "$Port",
    "-u", $User,
    $Database,
    "--batch", "--raw",
    "-e", $Sql
  )
  $out = & docker @args 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo la consulta MySQL (docker mysql). Revise MYSQL_HOST (accesible desde Docker), usuario, clave y base.`n$($out -join "`n")"
  }
  $out
}

Test-DockerAvailable

$envMap = Read-DotEnv -Path $EnvFile
$mysqlHost = $envMap["MYSQL_HOST"]
$mysqlUser = $envMap["MYSQL_USER"]
$mysqlPassword = $envMap["MYSQL_PASSWORD"]
$mysqlDatabase = $envMap["MYSQL_DATABASE"]
if ([string]::IsNullOrWhiteSpace($mysqlDatabase)) { $mysqlDatabase = "epem" }
$mysqlPort = 3306
if ($envMap.ContainsKey("MYSQL_PORT") -and $envMap["MYSQL_PORT"] -match '^\d+$') {
  $mysqlPort = [int]$envMap["MYSQL_PORT"]
}

if ([string]::IsNullOrWhiteSpace($mysqlHost) -or [string]::IsNullOrWhiteSpace($mysqlUser) -or $null -eq $mysqlPassword) {
  throw "En .env faltan MYSQL_HOST, MYSQL_USER o MYSQL_PASSWORD."
}
if ($mysqlDatabase -notmatch '^[a-zA-Z0-9_]+$') {
  throw "MYSQL_DATABASE debe ser identificador seguro (solo letras, numeros y _): $mysqlDatabase"
}

$archiveDir = Join-Path $RepoRoot "docs\archive"
if (-not (Test-Path -LiteralPath $archiveDir)) {
  New-Item -ItemType Directory -Path $archiveDir | Out-Null
}

$outMd = Join-Path $archiveDir "epem_mysql_verified_$DateStamp.md"
$outTsv = Join-Path $archiveDir "epem_mysql_all_fks_$DateStamp.tsv"

$tempEnv = [System.IO.Path]::GetTempFileName()
try {
  $pwdLine = "MYSQL_PWD=$mysqlPassword"
  [System.IO.File]::WriteAllText($tempEnv, $pwdLine, [System.Text.UTF8Encoding]::new($false))

  $verLine = Convert-DockerMysqlOutput -Lines @(Invoke-MysqlDocker -EnvFileForDocker $tempEnv -HostName $mysqlHost -Port $mysqlPort -User $mysqlUser -Database $mysqlDatabase -Sql "SELECT VERSION();")
  $version = ($verLine | Where-Object { $_ -match '^\d+\.\d+' } | Select-Object -First 1)
  if (-not $version) { $version = ($verLine | Where-Object { $_ -and $_.Trim() -ne 'VERSION()' } | Select-Object -Last 1).Trim() }

  $tblLines = Convert-DockerMysqlOutput -Lines @(Invoke-MysqlDocker -EnvFileForDocker $tempEnv -HostName $mysqlHost -Port $mysqlPort -User $mysqlUser -Database $mysqlDatabase -Sql @"
SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$mysqlDatabase' AND TABLE_TYPE='BASE TABLE';
"@)
  $tblCount = ($tblLines | Where-Object { $_ -match '^\d+$' } | Select-Object -First 1).Trim()

  $fkCountLines = Convert-DockerMysqlOutput -Lines @(Invoke-MysqlDocker -EnvFileForDocker $tempEnv -HostName $mysqlHost -Port $mysqlPort -User $mysqlUser -Database $mysqlDatabase -Sql @"
SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE k
WHERE k.TABLE_SCHEMA='$mysqlDatabase' AND k.REFERENCED_TABLE_NAME IS NOT NULL;
"@)
  $fkCount = ($fkCountLines | Where-Object { $_ -match '^\d+$' } | Select-Object -First 1).Trim()

  $fkSql = @"
SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, k.CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE k
WHERE k.TABLE_SCHEMA = '$mysqlDatabase' AND k.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY k.TABLE_NAME, k.ORDINAL_POSITION;
"@
  $fkLines = Convert-DockerMysqlOutput -Lines @(Invoke-MysqlDocker -EnvFileForDocker $tempEnv -HostName $mysqlHost -Port $mysqlPort -User $mysqlUser -Database $mysqlDatabase -Sql $fkSql)
}
finally {
  Remove-Item -LiteralPath $tempEnv -Force -ErrorAction SilentlyContinue
}

$headerTsv = "TABLE_NAME`tCOLUMN_NAME`tREFERENCED_TABLE_NAME`tREFERENCED_COLUMN_NAME`tCONSTRAINT_NAME"
$tsvBody = $fkLines | Where-Object { $_ -match '\t' -and $_ -notmatch '^TABLE_NAME\t' }
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($outTsv, @($headerTsv) + $tsvBody, $utf8NoBom)

$coreTables = [ordered]@{
  "account_payment_ways"       = $true
  "branches"                   = $true
  "client_portfolios"          = $true
  "clients"                    = $true
  "contract_closed_dates"      = $true
  "contract_situations"        = $true
  "contracting_entities"       = $true
  "contracts"                  = $true
  "debit_entities"             = $true
  "detail_client_portfolios"   = $true
  "enterprises"                = $true
  "insurances"                 = $true
  "payment_methods"            = $true
  "payments"                   = $true
  "product_money_loans"        = $true
  "users"                      = $true
}

$filtered = New-Object System.Collections.Generic.List[string]
foreach ($line in $tsvBody) {
  $parts = $line -split "`t", 5
  if ($parts.Count -lt 5) { continue }
  $t = $parts[0].Trim()
  if ($coreTables.Contains($t)) { $filtered.Add($line) }
}

$byTable = @{}
foreach ($line in $filtered) {
  $parts = $line -split "`t", 5
  $t = $parts[0]
  if (-not $byTable.ContainsKey($t)) { $byTable[$t] = New-Object System.Collections.Generic.List[object] }
  $byTable[$t].Add(@{
    Col = $parts[1]; RefT = $parts[2]; RefC = $parts[3]; Cst = $parts[4]
  })
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# MySQL ``$mysqlDatabase`` - inventario verificado (solo metadatos)")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("**Fecha:** $DateStamp  ")
[void]$sb.AppendLine("**Motor:** MySQL ``$version``  ")
[void]$sb.AppendLine("**Esquema:** ``$mysqlDatabase``  ")
[void]$sb.AppendLine("**Generado por:** ``scripts/dump_epem_fks.ps1`` (credenciales solo desde ``.env`` local).  ")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Resumen del catalogo")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("| Metrica | Valor |")
[void]$sb.AppendLine("|--------|------:|")
[void]$sb.AppendLine("| Tablas ``BASE TABLE`` | $tblCount |")
[void]$sb.AppendLine("| Filas ``KEY_COLUMN_USAGE`` con FK | $fkCount |")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Volcado completo de FKs (TSV)")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("Archivo tab-separado (todo el esquema): ``epem_mysql_all_fks_$DateStamp.tsv`` (misma carpeta).")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## FK declaradas - tablas nucleo extraccion v2")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("Subconjunto alineado a ``docs/base.md`` (``sql/v2/*``). Orden fijo de tablas.")
[void]$sb.AppendLine("")

foreach ($tableName in $coreTables.Keys) {
  if (-not $byTable.ContainsKey($tableName)) { continue }
  $rows = $byTable[$tableName]
  [void]$sb.AppendLine("### ``$tableName``")
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine("| Columna | Ref tabla | Ref columna | Constraint |")
  [void]$sb.AppendLine("|---------|---------|-----------|------------|")
  foreach ($r in $rows) {
    $c = [string]$r.Col
    $rt = [string]$r.RefT
    $rc = [string]$r.RefC
    $cs = [string]$r.Cst
    [void]$sb.AppendLine("| ``$c`` | ``$rt`` | ``$rc`` | ``$cs`` |")
  }
  [void]$sb.AppendLine("")
}

[void]$sb.AppendLine("## Mantenimiento")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("Volver a ejecutar ``.\scripts\dump_epem_fks.ps1`` tras cambios de esquema en MySQL. Actualizar referencia en ``docs/base.md`` (seccion 7.4) si cambia la fecha del anexo canonico.")
[void]$sb.AppendLine("")

[System.IO.File]::WriteAllText($outMd, $sb.ToString(), $utf8NoBom)

Write-Host "OK - generado:" -ForegroundColor Green
Write-Host "  $outMd"
Write-Host "  $outTsv"
