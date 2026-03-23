param(
  [switch]$NoFetch,
  [string]$BranchName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Ensure-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "No se encontro el comando requerido: $name"
  }
}

Write-Step "Validando prerequisitos"
Ensure-Command "git"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "Este script debe ejecutarse en la raiz de un repositorio git."
}

$status = git status --porcelain
if ($status) {
  Write-Host "ATENCION: hay cambios locales sin commitear." -ForegroundColor Yellow
  Write-Host "Se recomienda guardar/stash antes de recovery." -ForegroundColor Yellow
  Write-Host ""
  git status --short
  throw "Abortado para evitar mezclar recuperacion con cambios locales."
}

Write-Step "Sincronizando referencias remotas"
if (-not $NoFetch) {
  git fetch --all --prune
} else {
  Write-Host "Omitiendo fetch por parametro -NoFetch"
}

Write-Step "Creando rama de recovery"
if ([string]::IsNullOrWhiteSpace($BranchName)) {
  $BranchName = "recovery/visual-ux-" + (Get-Date -Format "yyyyMMdd-HHmm")
}
git checkout -b $BranchName

Write-Step "Mostrando estado canonico de bugs visuales"
if (Test-Path "bugs_visual.md") {
  Write-Host "Archivo canonico detectado: bugs_visual.md"
  Write-Host "Resumen de IDs V-* en el registro:"
  Select-String -Path "bugs_visual.md" -Pattern "^\| V-\d+" | ForEach-Object {
    Write-Host ("  " + $_.Line.Trim())
  }
} else {
  throw "No existe bugs_visual.md en la raiz del repo."
}

Write-Step "Checklist de ejecucion para el dev"
$checklist = @(
  "[ ] 1) Confirmar estado inicial en bugs_visual.md (V-* cerrados/abiertos)",
  "[ ] 2) Verificar runtime de V-051..V-055 y registrar resultado",
  "[ ] 3) Si hay drift, corregir frontend y volver a validar",
  "[ ] 4) Actualizar bugs_visual.md sin contradicciones (checklist + estado final)",
  "[ ] 5) Ejecutar pruebas/smoke del frontend segun flujo del equipo",
  "[ ] 6) Commit + push de la rama de recovery",
  "[ ] 7) Abrir PR usando RECUPERACION_DEV_PLAN.md"
)

$outFile = Join-Path $repoRoot "RECOVERY_EXECUTION_CHECKLIST.txt"
$checklist | Set-Content -Path $outFile -Encoding UTF8
Write-Host "Checklist generado en: $outFile" -ForegroundColor Green

Write-Step "Comandos sugeridos a ejecutar luego de implementar"
Write-Host "git status --short --branch"
Write-Host "git add frontend/src/modules/config/ConfigView.tsx frontend/src/modules/brokersCommissions/BrokersCommissionsView.tsx frontend/src/modules/brokersPrizes/BrokersPrizesView.tsx bugs_visual.md"
Write-Host "git commit -m ""fix(frontend): recover visual ux audit state and validate runtime"""
Write-Host "git push -u origin $BranchName"

Write-Step "Recovery preparado"
Write-Host "Rama creada: $BranchName" -ForegroundColor Green
Write-Host "Plan detallado: RECUPERACION_DEV_PLAN.md" -ForegroundColor Green
