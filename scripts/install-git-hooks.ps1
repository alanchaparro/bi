$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "git no esta disponible en PATH."
}

$repoRoot = git rev-parse --show-toplevel
if (-not $repoRoot) {
    Write-Error "No se pudo resolver la raiz del repositorio."
}

Set-Location $repoRoot
git config core.hooksPath githooks

Write-Host "Hooks Git instalados. hooksPath = githooks" -ForegroundColor Green
Write-Host "Verificacion: git config --get core.hooksPath" -ForegroundColor DarkGray
