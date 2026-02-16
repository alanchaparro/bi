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

Assert-DockerHealthy

docker compose --profile dev up -d --build dashboard api-v1
docker compose --profile dev run --rm dashboard python -m py_compile start_dashboard.py backend/app/main.py
docker compose --profile dev run --rm dashboard python -m unittest discover -s tests -p "test_*.py"
docker compose --profile dev run --rm dashboard python scripts/bootstrap_auth_users.py
docker compose --profile dev run --rm dashboard python scripts/migrate_legacy_config_to_db.py
docker compose --profile dev run --rm dashboard python scripts/verify_legacy_config_migration.py
docker compose --profile dev run --rm -e E2E_API_BASE=http://api-v1:8000/api/v1 dashboard python scripts/e2e_brokers_critical.py
docker compose --profile dev run --rm -e PERF_API_BASE=http://api-v1:8000/api/v1 -e PERF_ANALYTICS_P95_BUDGET_MS=1200 dashboard python scripts/perf_smoke_api_v1.py
docker compose --profile dev run --rm -e PARITY_API_V1_BASE=http://api-v1:8000/api/v1 -e PARITY_LEGACY_BASE=http://dashboard:5000 dashboard python scripts/parity_check_analytics_v1.py
docker compose --profile dev run --rm -e SMOKE_API_V1_BASE=http://api-v1:8000/api/v1 -e SMOKE_LEGACY_BASE=http://dashboard:5000 dashboard python scripts/smoke_deploy_v1.py
docker compose --profile dev run --rm dashboard python scripts/export_openapi_v1.py
docker run --rm -v "${PWD}:/work" -w /work/frontend node:20-alpine sh -lc "npm ci && npm run generate:types && npm run test && npm run typecheck && npm run build"

Write-Output "Release finalize completed."
