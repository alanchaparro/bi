# API Contracts v1

Base paths:
- Legacy analytics: `/analytics/*`
- New config API: `/api/v1/*`

## Common filters (repeatable query params)
- `un`
- `gestion_month` (`MM/YYYY`)
- `via_cobro` (`COBRADOR|DEBITO`)
- `categoria` (`VIGENTE|MOROSO`)
- `supervisor`
- `tramo`
- `via_pago`

## Error format (v1 estándar)
```json
{ "error_code": "INVALID_FILTER", "message": "...", "details": null, "trace_id": "..." }
```

## Auth
### POST /api/v1/auth/login
Request:
```json
{ "username": "admin", "password": "admin123" }
```
Response:
```json
{ "access_token": "...", "token_type": "bearer", "role": "admin", "permissions": ["brokers:read"] }
```

## Brokers config
### GET /api/v1/brokers/supervisors-scope
### POST /api/v1/brokers/supervisors-scope
```json
{ "supervisors": ["FVBROKEREAS", "FVBROKEREASCDE"] }
```

### GET /api/v1/brokers/commissions
### POST /api/v1/brokers/commissions
```json
{ "rules": [] }
```

### GET /api/v1/brokers/prizes
### POST /api/v1/brokers/prizes
```json
{ "rules": [] }
```

## GET /analytics/portfolio/summary
Response:
```json
{
  "total": 0,
  "vigente": 0,
  "moroso": 0,
  "cobrador": 0,
  "debito": 0,
  "totalDebt": 0.0,
  "totalPaid": 0.0
}
```

## GET /analytics/portfolio/trend
Response:
```json
{
  "byGestion": {
    "02/2025": {
      "total": 0,
      "vigente": 0,
      "moroso": 0,
      "cobrador": 0,
      "debito": 0,
      "debt": 0.0,
      "paid": 0.0,
      "paidContracts": 0
    }
  }
}
```

## GET /analytics/performance/by-management-month
Response mirrors `updatePerformanceUI` expected shape:
```json
{
  "totalDebt": 0.0,
  "totalPaid": 0.0,
  "totalContracts": 0,
  "totalContractsPaid": 0,
  "tramoStats": {},
  "unStats": {},
  "viaCStats": {},
  "gestorStats": {},
  "matrixStats": {},
  "trendStats": {}
}
```
