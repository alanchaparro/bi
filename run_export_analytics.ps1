# Run the analytics export script using a Docker container with Python
# Generates analytics_monthly.csv + analytics_meta.json

Write-Host "Starting analytics export process via Docker..." -ForegroundColor Cyan

docker run --rm -v "${PWD}:/app" -w /app --env-file .env python:3.9-slim sh -c "pip install --no-cache-dir pandas mysql-connector-python python-dotenv && python export_analytics.py"

if ((Test-Path "analytics_monthly.csv") -and (Test-Path "analytics_meta.json")) {
    Write-Host "Success! 'analytics_monthly.csv' and 'analytics_meta.json' were created." -ForegroundColor Green
} else {
    Write-Host "Error: analytics output files were not created. Check Docker output above." -ForegroundColor Red
}
