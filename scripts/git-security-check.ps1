param(
    [ValidateSet("pre-commit", "pre-push")]
    [string]$Phase = "pre-commit"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "git no esta disponible en PATH."
}

$repoRoot = git rev-parse --show-toplevel
if (-not $repoRoot) {
    Write-Error "No se pudo resolver la raiz del repositorio."
}
Set-Location $repoRoot

$blockedPatterns = @(
    '(^|/)\.env$',
    '(^|/)\.env\..+$',
    '(^|/)secrets(/|$)',
    '\.csv$',
    '\.xlsx$',
    '(^|/)analytics_meta\.json$',
    '\.db$',
    '(^|/)docs/archive/.+/evidence-old/.+$',
    '\.pem$',
    '\.key$',
    '\.p12$',
    '\.pfx$',
    '\.jks$',
    '\.keystore$',
    '(^|/)id_rsa$',
    '(^|/)id_ed25519$',
    '(^|/)credentials\.json$'
)

$tracked = @(git ls-files)
$staged = @(git diff --cached --name-only)
$candidates = @($tracked + $staged | Where-Object { $_ -and $_.Trim().Length -gt 0 } | Sort-Object -Unique)
$violations = @()

foreach ($file in $candidates) {
    if ($file -ieq ".env.example") { continue }
    foreach ($pattern in $blockedPatterns) {
        if ($file -match $pattern) {
            $violations += $file
            break
        }
    }
}

$violations = @($violations | Sort-Object -Unique)
if ($violations.Count -gt 0) {
    Write-Host "[$Phase] Se detectaron archivos sensibles/riesgosos en tracked o staged:" -ForegroundColor Red
    $violations | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Accion sugerida:" -ForegroundColor Yellow
    Write-Host " - Remueva del commit o des-trackee: git rm --cached <archivo>" -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command gitleaks -ErrorAction SilentlyContinue)) {
    Write-Host "[$Phase] gitleaks no esta instalado. Bloqueando commit/push por politica de seguridad." -ForegroundColor Red
    Write-Host "Instalacion: https://github.com/gitleaks/gitleaks#installing" -ForegroundColor Yellow
    exit 1
}

$gitleaksArgs = @(
    "detect",
    "--source", ".",
    "--no-git",
    "--redact",
    "--exit-code", "1",
    "--config", ".gitleaks.toml"
)

& gitleaks @gitleaksArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[$Phase] gitleaks detecto posibles secretos. Commit/push bloqueado." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "[$Phase] Git security check OK." -ForegroundColor Green
