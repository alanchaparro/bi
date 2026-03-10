# Analytics v2 Validation Report (2026-03-06)

## Entorno de validacion
- Stack `docker compose --profile dev` (api-v1, sync-worker, postgres, frontend-prod).
- DB: `cobranzas_prod` en `postgres:5432`.
- API base: `http://localhost:8000/api/v1`.

## Resultados clave

### 1) Integridad de UN
- `dim_negocio_un_map`:
  - `ODONTOLOGIA -> ODONTOLOGIA` activo.
  - `ODONTOLOGIA TTO -> ODONTOLOGIA TTO` activo.
- `analytics_rendimiento_agg` y `dim_negocio_contrato` incluyen 4 UN:
  - `MEDICINA ESTETICA`
  - `MEDICINA PREPAGA`
  - `ODONTOLOGIA`
  - `ODONTOLOGIA TTO`
- `POST /analytics/rendimiento-v2/options` devuelve ambas:
  - `ODONTOLOGIA` y `ODONTOLOGIA TTO`.

### 2) Frescura sin seq scan
- `EXPLAIN (ANALYZE, BUFFERS) SELECT updated_at FROM cartera_fact ORDER BY updated_at DESC LIMIT 1;`
  - Usa `Index Only Scan` sobre `ix_cartera_fact_updated_at_desc`.
  - Sin `Parallel Seq Scan`.
- `analytics_source_freshness` poblada:
  - 12 filas (facts/aggs/options principales).

### 3) Consistencia de `mv_options_*`
- Prueba de resiliencia:
  1. Se borraron filas de `mv_options_rendimiento` para `02/2026`.
  2. `GET /admin/analytics/options/consistency` => `ok=false`.
  3. `POST /admin/analytics/options/rebuild` (`scope=months`, `months=['02/2026']`) => reconstruccion OK.
  4. `GET /admin/analytics/options/consistency` => `ok=true`.

### 4) Rendimiento API (benchmark real)
- Script: `python scripts/benchmark_analytics_v2.py --rounds 8/10`.
- Corrida tras reinicio (representativa cold/warm):
  - `/analytics/rendimiento-v2/options`: warm p95 `68.6ms`.
  - `/analytics/rendimiento-v2/summary`: warm p95 `1274.63ms` (cumple `<1.5s`).
  - `/analytics/cobranzas-cohorte-v2/options`: warm p95 `366.74ms` en primera corrida tras restart, y `12.04ms` en corrida subsecuente caliente.

### 5) Paridad v1/v2
- Script: `python scripts/check_v1_v2_parity.py`.
- Resultado global: `ok=true`.
- Diferencias:
  - `rend.totalDebt`: `0.9909%` (dentro de `<=1%`).
  - `anuales.contracts.sum`: `0.3506%`.
  - Resto: `0%`.

## Conclusiones
- El diseño v2 y la integridad canónica de UN quedaron operativos.
- Frescura ya no depende de `MAX(updated_at)` con scan completo.
- `mv_options_*` tiene mecanismo operativo de detección y reconstrucción.
- Rendimiento warm cumple objetivo en endpoints críticos evaluados.

