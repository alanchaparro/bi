# Run the export script using a Docker container with Python
# We map the current directory to /app in the container

Write-Host "Starting export process via Docker..." -ForegroundColor Cyan

docker run --rm -v "${PWD}:/app" -w /app --env-file .env python:3.9-slim sh -c "pip install --no-cache-dir pandas openpyxl mysql-connector-python python-dotenv && python export_to_excel.py"

if (Test-Path "cartera.csv") {
    Write-Host "Success! 'cartera.csv' has been created." -ForegroundColor Green
} else {
    Write-Host "Error: 'cartera.csv' was not created. Check Docker output above." -ForegroundColor Red
}
