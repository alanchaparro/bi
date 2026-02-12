# Test Matrix

## API
- [ ] `/analytics/portfolio/summary` returns 200 with no filters.
- [ ] `/analytics/portfolio/trend` returns grouped months.
- [ ] `/analytics/performance/by-management-month` returns performance payload.
- [ ] `/analytics/movement/moroso-trend` returns labels, transitions, vigente base and percent.
- [ ] `/analytics/anuales/summary` returns yearly rows + cutoff.
- [ ] Invalid `gestion_month` returns `INVALID_FILTER`.

## Frontend
- [ ] `USE_ANALYTICS_API=true` uses API in Analisis Cartera and Rendimiento.
- [ ] `FF_API_MOVIMIENTO=true` uses movement endpoint and falls back to local if API fails.
- [ ] API error triggers fallback local computation.
- [ ] Sidebar navigation remains functional.
- [ ] `?debug=1` enables debug traces without breaking UI.

## Data quality
- [ ] Missing required columns trigger fatal validation.
- [ ] Invalid dates/amounts trigger warnings.

## Automated business rules (implemented)
- [x] TKP pago en anuales: promedio por contrato-mes con pago.
- [x] Culminados vigentes: cuenta por tramo en mes de culminacion hasta corte.
- [x] LTV culminado vigente: validado sobre dataset controlado en tests.
- [x] Movimiento moroso: meses completos en serie y `% = transiciones / vigentes`.
- [x] Movimiento moroso: `avg_cuota` solo de contratos que transicionan.
