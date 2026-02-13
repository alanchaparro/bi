# KPI Definitions

## Brokers - Contratos
- Definición: cantidad de contratos únicos por `mes/anio`, `supervisor`, `UN`, `via`.
- Fuente: `contratos.csv` normalizado.

## Brokers - Monto Cuota
- Definición: suma de `monto_cuota` sobre contratos agrupados por misma granularidad de Contratos.

## Brokers - Comisiones
- Definición: suma de (`monto_cuota * factor`) para reglas coincidentes por supervisor/UN/via/mes.
- Si no hay regla aplicable: 0.

## Brokers - Premios
- Definición: premio fijo por escala alcanzada según `% = ventas/meta * 100`.
- Regla de escala: aplica la escala de mayor umbral cumplido.
- Unificación: `FVBROKEREAS` + `FVBROKEREASCDE` se consideran `FVBROKERS` para cálculo final.

## Brokers - Mora 3M
- Definición operativa vigente: contratos morosos (`tramo >= 4`) al mes de cierre filtrado,
  con antiguedad de 4 a 6 meses (`>3 && <=6`) respecto a fecha de contrato.
- Conteo: contrato único por grupo de salida.

## Mora Brokers
- Definición: tabla contrato a contrato con estado `vigente/moroso` por venta, cierre, supervisor, UN, via.
- Por defecto: vista morosos.

## KPIs Globales mínimos
- Total contratos.
- Total morosos.
- % mora.
- Monto total deuda.
- Monto total cobrado.

## Convenciones
- Fechas de mes: `MM/YYYY`.
- Moneda: PYG, sin decimales en montos mostrados.
- Supervisor/UN/Vía normalizados a mayúsculas consistentes.
