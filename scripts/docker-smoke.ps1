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

docker compose --profile dev up -d dashboard api-v1
Start-Sleep -Seconds 3

$dashPort = if ($env:DASHBOARD_PORT) { $env:DASHBOARD_PORT } else { "5000" }
$base = "http://localhost:$dashPort"

$check = Invoke-RestMethod -Uri "$base/api/check-files" -Method Get
$check | ConvertTo-Json -Compress | Write-Output

function Assert-FilterRequired {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )
    try {
        Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing | Out-Null
        throw "Se esperaba HTTP 400 con FILTER_REQUIRED en $Url"
    } catch {
        $resp = $_.Exception.Response
        if (-not $resp) { throw }
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $body = $reader.ReadToEnd()
        $reader.Close()
        $json = $body | ConvertFrom-Json
        if ($json.error_code -ne "FILTER_REQUIRED") {
            throw "Respuesta inesperada en ${Url}: $body"
        }
        Write-Output "OK $Url -> FILTER_REQUIRED"
    }
}

Assert-FilterRequired -Url "$base/analytics/movement/moroso-trend"
Assert-FilterRequired -Url "$base/analytics/anuales/summary"
