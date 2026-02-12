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

## GET /analytics/anuales/summary
Returns annual summary rows used by `Análisis Anuales`.

Response:
```json
{
  "rows": [
    {
      "year": "2025",
      "contracts": 0,
      "contractsVigentes": 0,
      "tkpContrato": 0,
      "tkpTransaccional": 0,
      "tkpPago": 0,
      "culminados": 0,
      "culminadosVigentes": 0,
      "tkpContratoCulminado": 0,
      "tkpPagoCulminado": 0,
      "tkpContratoCulminadoVigente": 0,
      "tkpPagoCulminadoVigente": 0,
      "ltvCulminadoVigente": 0
    }
  ],
  "cutoff": "02/2026",
  "meta": {
    "source": "api",
    "signature": "endpoint|stamp|filters"
  }
}
```

## Filters (query params)
- `un` (repeatable)
- `gestion_month` (repeatable)
- `contract_month` (repeatable, anuales endpoint)
- `via_cobro` (repeatable)
- `categoria` (repeatable)
- `supervisor` (repeatable)
- `anio` (repeatable, movement endpoint)
- `debug` (`1/true/yes/on`, optional)
