# API Draft (Future Backend)

## GET /analytics/portfolio/summary
Returns KPI cards for current filter set.

Response:
```json
{
  "total_contracts": 0,
  "total_debt": 0,
  "total_paid": 0,
  "compliance_pct": 0
}
```

## GET /analytics/portfolio/trend
Returns month series for debt/paid/compliance.

Response:
```json
{
  "series": [
    {"month": "02/2025", "debt": 0, "paid": 0, "compliance_pct": 0}
  ]
}
```

## GET /analytics/performance/by-management-month
Returns grouped performance by management month.

Response:
```json
{
  "rows": [
    {
      "gestion_month": "02/2025",
      "contracts": 0,
      "contracts_paid": 0,
      "debt": 0,
      "paid": 0,
      "coverage_pct": 0
    }
  ]
}
```

## GET /analytics/movement/moroso-trend
Returns movement series for contracts that moved from `tramo <= 3` to `tramo > 3`
plus active vigente base per month.

Response:
```json
{
  "labels": ["03/2025"],
  "moroso_transition_count": [281],
  "vigente_base_count": [9350],
  "moroso_transition_pct": [3.005],
  "avg_cuota": [99635.0],
  "meta": {
    "source": "api",
    "signature": "endpoint|stamp|filters",
    "filters": {
      "un": ["MEDICINA ESTETICA"],
      "anio": ["2025"],
      "gestion_month": ["03/2025"],
      "via_cobro": ["COBRADOR", "DEBITO"],
      "categoria": ["MOROSO"],
      "supervisor": []
    }
  }
}
```

## Filters (query params)
- `un` (repeatable)
- `gestion_month` (repeatable)
- `via_cobro` (repeatable)
- `categoria` (repeatable)
- `supervisor` (repeatable)
- `anio` (repeatable, movement endpoint)
- `debug` (`1/true/yes/on`, optional)
