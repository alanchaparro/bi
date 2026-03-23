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

docker compose --profile dev up -d api-v1
Start-Sleep -Seconds 3

$apiPort = if ($env:API_V1_PORT) { $env:API_V1_PORT } else { "8000" }
$base = "http://localhost:$apiPort/api/v1"

$check = Invoke-RestMethod -Uri "$base/health" -Method Get
$check | ConvertTo-Json -Compress | Write-Output

function Assert-PostReturnsJson {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [Parameter(Mandatory = $true)]
        [string]$Payload
    )
    $response = Invoke-WebRequest -Uri $Url -Method Post -Body $Payload -ContentType "application/json" -UseBasicParsing
    if (-not $response.Content) {
        throw "Respuesta vacia en ${Url}"
    }
    $null = $response.Content | ConvertFrom-Json
    Write-Output "OK $Url"
}

Assert-PostReturnsJson -Url "$base/analytics/portfolio-corte-v2/options" -Payload "{}"
Assert-PostReturnsJson -Url "$base/analytics/rendimiento-v2/options" -Payload "{}"
