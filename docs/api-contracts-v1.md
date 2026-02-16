# API Contracts v1

Base path: `/api/v1`

## Health
### `GET /api/v1/health`
- **200**: Servicio y DB operativos.
  ```json
  { "ok": true, "service": "cobranzas-api-v1", "db_ok": true }
  ```
- **503**: Dependencia crítica (DB) no disponible.
  ```json
  { "ok": false, "service": "cobranzas-api-v1", "db_ok": false, "message": "Database unreachable" }
  ```

## Error contract estandar
```json
{ "error_code": "...", "message": "...", "details": null, "trace_id": "..." }
```

## Auth
### `POST /api/v1/auth/login`
```json
{ "username": "admin", "password": "admin123" }
```
Response:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "role": "admin",
  "permissions": ["brokers:read", "brokers:write_config", "analytics:read", "analytics:export"]
}
```

### `POST /api/v1/auth/refresh`
```json
{ "refresh_token": "..." }
```

### `POST /api/v1/auth/revoke`
```json
{ "refresh_token": "..." }
```

## Brokers config
- `GET/POST /api/v1/brokers/supervisors-scope`
- `GET/POST /api/v1/brokers/commissions`
- `GET/POST /api/v1/brokers/prizes`
- `GET/POST /api/v1/brokers/preferences` (persistencia de filtros server-side por usuario)

## Analytics v1
Todos reciben body `AnalyticsFilters` (POST):
```json
{
  "un": [],
  "anio": [],
  "gestion_month": [],
  "contract_month": [],
  "via_cobro": [],
  "via_pago": [],
  "categoria": [],
  "supervisor": [],
  "tramo": []
}
```

Endpoints:
- `POST /api/v1/analytics/portfolio/summary`
- `POST /api/v1/analytics/rendimiento/summary`
- `POST /api/v1/analytics/mora/summary`
- `POST /api/v1/analytics/brokers/summary` (calculo nativo API v1)
- `POST /api/v1/analytics/export/csv` (`endpoint`: `portfolio|rendimiento|mora|brokers`)
- `POST /api/v1/analytics/export/pdf` (`endpoint`: `portfolio|rendimiento|mora|brokers`)

Compatibilidad temporal:
- `POST /api/v1/analytics/export` (legacy alias)
