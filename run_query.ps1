param(
    [Parameter(Mandatory=$true)]
    [string]$Query
)

if (!(Test-Path ".env")) {
    Write-Host "Error: .env no encontrado. Crea el archivo desde .env.example." -ForegroundColor Red
    exit 1
}

$tmpSql = ".tmp_query.sql"

try {
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $tmpSql), $Query, [System.Text.Encoding]::UTF8)

    # Run query inside temporary Alpine container using mysql-client and .env variables
    docker run --rm --env-file .env -v "${PWD}:/work" -w /work alpine sh -c 'apk add --no-cache mysql-client >/dev/null 2>&1 && mariadb -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" --skip-ssl "$MYSQL_DATABASE" < "/work/.tmp_query.sql"'
}
finally {
    if (Test-Path $tmpSql) {
        Remove-Item $tmpSql -Force
    }
}
