# DWH v2 Target Architecture (Analytics)

## Objetivo
- Integridad de filtros (UN completa, sin colapsos no deseados).
- Latencia baja en options/summary.
- Frescura sin scans completos en tablas fact grandes.
- Operación robusta de `mv_options_*`.

## Capas
- `facts` transaccionales: `cartera_fact`, `cobranzas_fact`.
- `semantic dims`: `dim_negocio_un_map`, `dim_negocio_contrato`, `dim_contract_month`, `dim_time`.
- `aggs`: `cartera_corte_agg`, `cobranzas_cohorte_agg`, `analytics_rendimiento_agg`, `analytics_anuales_agg`.
- `options catalog`: `mv_options_cartera`, `mv_options_cohorte`, `mv_options_rendimiento`, `mv_options_anuales`.
- `freshness tracker`: `analytics_source_freshness`.

## Reglas clave
- UN canónica se resuelve solo por `dim_negocio_un_map`.
- `ODONTOLOGIA TTO` y `ODONTOLOGIA` se mantienen separadas.
- Frontend analytics consume rutas v2.
- `meta.data_freshness_at` se lee de `analytics_source_freshness`.

## APIs operativas
- `GET /api/v1/admin/analytics/options/consistency`
- `POST /api/v1/admin/analytics/options/rebuild`
- `GET /api/v1/admin/analytics/freshness`

## Mantenimiento
- Post-sync:
  - refresh incremental aggs/dims/options.
  - check de consistencia de `mv_options_*`.
  - autorebuild full si hay parcialidad.
  - update de `analytics_source_freshness`.
- Rebuild manual:
  - full o por meses (`scope=full|months`).

