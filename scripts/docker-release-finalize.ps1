$ErrorActionPreference = "Stop"

function Assert-DockerHealthy {
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            docker info | Out-Null
            $ok = $true
            break
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    if (-not $ok) {
        throw "Docker daemon no esta saludable. Abre Docker Desktop y reintenta."
    }
}

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )
    Write-Output "==> $Name"
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

function Get-ComposeContainerId {
    param([string]$Service)
    $id = (docker compose --profile dev ps -q $Service | Select-Object -First 1).Trim()
    if ([string]::IsNullOrWhiteSpace($id)) {
        throw "No se encontro container activo para servicio '$Service'"
    }
    return $id
}

Assert-DockerHealthy

Invoke-Step "Compose up (dashboard + api-v1)" { docker compose --profile dev up -d --build dashboard api-v1 }

$dashboardId = Get-ComposeContainerId "dashboard"

Invoke-Step "Backend compile check" { docker exec $dashboardId python -m py_compile /app/start_dashboard.py /app/backend/app/main.py }
Invoke-Step "Backend unit tests" { docker exec $dashboardId python -m unittest discover -s /app/tests -p "test_*.py" }
Invoke-Step "Bootstrap auth users" { docker exec $dashboardId python /app/scripts/bootstrap_auth_users.py }
Invoke-Step "Migrate legacy config to DB" { docker exec $dashboardId python /app/scripts/migrate_legacy_config_to_db.py }
Invoke-Step "Verify legacy config migration" { docker exec $dashboardId python /app/scripts/verify_legacy_config_migration.py }
Invoke-Step "E2E brokers critical" { docker exec $dashboardId sh -lc "E2E_API_BASE=http://api-v1:8000/api/v1 python /app/scripts/e2e_brokers_critical.py" }
Invoke-Step "Perf smoke analytics v1" { docker exec $dashboardId sh -lc "PERF_API_BASE=http://api-v1:8000/api/v1 PERF_ANALYTICS_P95_BUDGET_MS=1200 python /app/scripts/perf_smoke_api_v1.py" }
Invoke-Step "Parity analytics v1 vs legacy" { docker exec $dashboardId sh -lc "PARITY_API_V1_BASE=http://api-v1:8000/api/v1 PARITY_LEGACY_BASE=http://localhost:5000 python /app/scripts/parity_check_analytics_v1.py" }
Invoke-Step "Smoke deploy v1" { docker exec $dashboardId sh -lc "SMOKE_API_V1_BASE=http://api-v1:8000/api/v1 SMOKE_LEGACY_BASE=http://localhost:5000 python /app/scripts/smoke_deploy_v1.py" }
Invoke-Step "Export OpenAPI v1" { docker exec $dashboardId python /app/scripts/export_openapi_v1.py }
Invoke-Step "Frontend ci/test/build" { docker run --rm -v "${PWD}:/work" -w /work/frontend node:20-alpine sh -lc "npm ci && npm run generate:types && npm run test && npm run typecheck && npm run build" }

Write-Output "Release finalize completed."
