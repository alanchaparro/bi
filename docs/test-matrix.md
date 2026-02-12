# Test Matrix

## API
- [x] `/analytics/portfolio/summary` returns payload with `meta` standard (`source/signature/cutoff/filters`).
- [x] `/analytics/portfolio/trend` returns grouped months + standard `meta`.
- [x] `/analytics/performance/by-management-month` returns performance payload + standard `meta`.
- [x] `/analytics/movement/moroso-trend` returns labels, transitions, vigente base, percent and `meta.cutoff`.
- [x] `/analytics/anuales/summary` returns yearly rows + cutoff + `meta`.
- [x] Invalid `gestion_month`/`contract_month`/`anio` returns `INVALID_FILTER`.

## Frontend
- [x] `USE_ANALYTICS_API=true` uses API in Analisis Cartera and Rendimiento.
- [x] `FF_API_MOVIMIENTO=true` uses movement endpoint and keeps local fallback.
- [x] API error triggers local fallback computation.
- [x] Sidebar navigation remains functional (static regression checks).
- [x] `?debug=1` enables debug traces without breaking UI behavior.

## Data quality
- [x] Missing required columns trigger fatal validation.
- [x] Invalid dates/amounts trigger warnings.

## Automated business rules (implemented)
- [x] TKP pago en anuales: promedio por contrato-mes con pago.
- [x] Culminados vigentes: cuenta por tramo en mes de culminacion hasta corte.
- [x] LTV culminado vigente: validado sobre dataset controlado en tests.
- [x] Movimiento moroso: meses completos en serie y `% = transiciones / vigentes`.
- [x] Movimiento moroso: `avg_cuota` solo de contratos que transicionan.
- [x] Movimiento moroso: meses filtrados sin datos se devuelven con cero para continuidad visual.
- [x] Anuales: paridad de filtros combinados (`UN + anio + contract_month`) con referencia de negocio en `tkpPago`.
- [x] Tolerancias de paridad formalizadas: `±1 contrato` y `±0.5%` en KPIs clave.
- [x] Golden datasets versionados para KPI Anuales y Movimiento.
- [x] Regresion UI minima: presencia de series/campos clave y entrypoints modulares.
