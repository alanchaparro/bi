# API Contracts v1

Base path: `/api/v1`

## Error contract estándar
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

## Analytics v1 (dual-run via legacy backend)
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
- `POST /api/v1/analytics/brokers/summary`
- `POST /api/v1/analytics/export` (`format`: `csv|pdf`, `endpoint`: `portfolio|rendimiento|mora|brokers`)
