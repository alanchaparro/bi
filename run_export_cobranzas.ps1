# Run the cobranzas export script using a Docker container with Python
# We map the current directory to /app in the container

Write-Host "Starting cobranzas export process via Docker..." -ForegroundColor Cyan

docker run --rm -v "${PWD}:/app" -w /app --env-file .env python:3.9-slim sh -c "pip install --no-cache-dir pandas mysql-connector-python python-dotenv && python export_cobranzas.py"

if (Test-Path "cobranzas_prepagas.csv") {
    Write-Host "Success! 'cobranzas_prepagas.csv' has been created." -ForegroundColor Green
} else {
    Write-Host "Error: 'cobranzas_prepagas.csv' was not created. Check Docker output above." -ForegroundColor Red
}
