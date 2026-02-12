# Security Baseline

## Secrets
- No DB credentials hardcoded in Python export scripts.
- Runtime credentials loaded from `.env`.
- `.env.example` remains secret-free template.

## Query safety
- Browser never connects directly to MySQL.
- Dashboard frontend consumes local backend endpoints.

## Operational controls
- Rotate `MYSQL_PASSWORD` periodically.
- Keep `.env` out of source control.
- Restrict host access to local/trusted network.
