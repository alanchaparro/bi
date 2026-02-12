$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "git no esta disponible en PATH."
}

$blockedPatterns = @(
    '(^|/)\.env$',
    '(^|/)\.env\..+$',
    '\.csv$',
    '\.xlsx$',
    '(^|/)analytics_meta\.json$'
)

$tracked = git ls-files
$violations = @()

foreach ($file in $tracked) {
    if ($file -ieq ".env.example") { continue }
    foreach ($pattern in $blockedPatterns) {
        if ($file -match $pattern) {
            $violations += $file
            break
        }
    }
}

$violations = $violations | Sort-Object -Unique

if ($violations.Count -gt 0) {
    Write-Host "Se detectaron archivos sensibles/riesgosos trackeados:" -ForegroundColor Red
    $violations | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Sugerencia: des-trackearlos antes de push:" -ForegroundColor Yellow
    Write-Host "git rm --cached <archivo>" -ForegroundColor Yellow
    exit 1
}

Write-Host "Pre-push safety check OK: no se detectaron archivos sensibles trackeados." -ForegroundColor Green
