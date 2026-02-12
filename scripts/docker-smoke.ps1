$ErrorActionPreference = "Stop"

docker compose up -d
Start-Sleep -Seconds 3

$check = Invoke-RestMethod -Uri "http://localhost:5000/api/check-files" -Method Get
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

Assert-FilterRequired -Url "http://localhost:5000/analytics/movement/moroso-trend"
Assert-FilterRequired -Url "http://localhost:5000/analytics/anuales/summary"
