[CmdletBinding()]
param(
  [switch]$RepairAcl
)

$ErrorActionPreference = "Stop"

$repoRoot = Join-Path $PSScriptRoot ".."
Set-Location -Path $repoRoot

$allowedRoots = @(
  (Resolve-Path "sql/common").Path,
  (Resolve-Path "sql/v2").Path
)

$targets = @()
foreach ($root in $allowedRoots) {
  $targets += Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^tmp[a-z0-9_]+$' }
}

if (-not $targets -or $targets.Count -eq 0) {
  Write-Host "No se encontraron directorios tmp* en sql/common o sql/v2."
  exit 0
}

Write-Host "Intentando limpieza segura de directorios tmp* (sin borrado masivo):"
foreach ($dir in $targets) {
  $fullPath = $dir.FullName
  $isAllowed = $false
  foreach ($root in $allowedRoots) {
    if ($fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
      $isAllowed = $true
      break
    }
  }
  if (-not $isAllowed) {
    Write-Host "SKIP (fuera de allowlist): $fullPath" -ForegroundColor Yellow
    continue
  }

  try {
    if ($RepairAcl) {
      & takeown.exe /f $fullPath /r /d S | Out-Null
      & icacls.exe $fullPath /grant "$($env:USERNAME):(OI)(CI)F" /t /c | Out-Null
    }
    Remove-Item -LiteralPath $fullPath -Recurse -Force -ErrorAction Stop
    Write-Host "REMOVED: $fullPath" -ForegroundColor Green
  } catch {
    Write-Host "FAILED:  $fullPath :: $($_.Exception.Message)" -ForegroundColor Red
  }
}
