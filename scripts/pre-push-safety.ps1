$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$checkScript = Join-Path $scriptDir "git-security-check.ps1"

if (-not (Test-Path $checkScript)) {
    Write-Error "No se encuentra $checkScript"
}

& $checkScript -Phase "pre-push"
exit $LASTEXITCODE
