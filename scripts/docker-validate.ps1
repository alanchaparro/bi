$ErrorActionPreference = "Stop"

function Assert-DockerHealthy {
    $ok = $false
    for ($i = 0; $i -lt 20; $i++) {
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

docker compose --profile dev build --no-cache
docker compose --profile dev up -d dashboard api-v1
docker compose --profile dev run --rm dashboard python -m py_compile start_dashboard.py
docker compose --profile dev run --rm dashboard python -m unittest discover -s tests -p "test_*.py"
powershell -ExecutionPolicy Bypass -File .\scripts\docker-smoke.ps1
