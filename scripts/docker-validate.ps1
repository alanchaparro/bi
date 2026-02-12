$ErrorActionPreference = "Stop"

docker compose build --no-cache
docker compose up -d
docker compose run --rm dashboard python -m py_compile start_dashboard.py
docker compose run --rm dashboard python -m unittest discover -s tests -p "test_*.py"
powershell -ExecutionPolicy Bypass -File .\scripts\docker-smoke.ps1
