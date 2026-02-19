$ErrorActionPreference = "Stop"

Set-Location -Path (Join-Path $PSScriptRoot "..")

docker compose --profile prod exec -T api-v1 sh -lc "cd /app && ANALYTICS_SYNC_MODE=incremental ANALYTICS_SYNC_WINDOW_MONTHS=3 python scripts/sync_analytics_to_snapshot.py"
