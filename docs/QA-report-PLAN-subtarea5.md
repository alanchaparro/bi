# Reporte QA — Plan UI/UX HeroUI + Filtros (Subtarea 5) — 11 mar 2026

## Alcance revisado

- Flujos de **análisis de cartera** (`/analisis-cartera`) y **rendimiento** (`/rendimiento`) de punta a punta (código + API + tests).
- Filtros: que las opciones provengan de la API v2 (`options.uns`, `options.gestion_months`, etc.) y que se cumpla la regla de UN canónicas (AGENTS.md).
- UI: transiciones en filtros, skeletons de carga, ausencia de errores visuales evidentes (revisión por código).

**Nota:** La API exige autenticación (`require_permission('analytics:read')`). No se pudo ejecutar en navegador con usuario logueado; la verificación de flujos completos en UI se basó en código, tests y una pasada manual recomendada.

---

## ✅ Funciona correctamente

- **Entorno Docker:** `docker compose ps` muestra servicios del stack nuevo Up (api-v1, frontend-prod, postgres, sync-worker). Frontend en 8080, API en 8000.
- **API health:** `GET /api/v1/health` responde correctamente.
- **Smoke tests v2:** Los 4 tests de `test_api_v1_analytics_v2_smoke_endpoints.py` pasan:
  - `portfolio-corte-v2/options` devuelve `options.uns` y `options.gestion_months` (listas).
  - `portfolio-corte-v2/summary` devuelve `kpis` y metadata mínima.
  - `rendimiento-v2/options` devuelve `options.uns` y `options.gestion_months` (listas).
  - `rendimiento-v2/summary` responde con estructura esperada.
- **Backend — UN canónicas:** En `analytics_service.py`, tanto `fetch_portfolio_corte_options_v2` como `fetch_rendimiento_options_v2` unen las UN de MV/agg con `_fetch_canonical_uns(db)`, que lee `dim_negocio_un_map` (canonical_un con `is_active=true`). Cumple PLAN y AGENTS.md: “Filtros deben mostrar todas las UN disponibles según política canónica vigente.”
- **Backend — Meses:** En portfolio-corte-v2, `gestion_months` y `close_months` se construyen como unión de meses en `CarteraCorteAgg` y calendario estándar. En rendimiento-v2, `gestion_months` une meses de `AnalyticsRendimientoAgg` con calendario estándar. No se limitan solo a la MV.
- **Frontend — Consumo de options:**
  - `AnalisisCarteraView` usa `getPortfolioCorteOptions` (POST `/analytics/portfolio-corte-v2/options`) y pinta filtros con `options.uns`, `options.gestion_months`, `options.close_months`, etc., sin listas hardcodeadas.
  - `AnalisisRendimientoView` usa `getRendimientoOptions` (POST `/analytics/rendimiento-v2/options`) y pinta filtros con `options.gestionMonths`, `options.uns`, `options.tramos`, etc., sin hardcode.
- **Frontend — Skeletons:** Ambas vistas muestran `AnalysisFiltersSkeleton` (HeroUI `Skeleton` con `animationType="shimmer"`) mientras `loadingOptions` es true; número de filtros coherente (8 en cartera, 7 en rendimiento).
- **Frontend — Filtros:** `MultiSelectFilter` usa componentes HeroUI (Button), listbox accesible, cierre con transición (180 ms), búsqueda interna y estados vacíos con mensaje “Sin opciones (no hay datos cargados)”.
- **Rutas:** `/analisis-cartera` → `AnalisisCarteraView`, `/rendimiento` → `AnalisisRendimientoView`; ambas consumen rutas v2 por defecto.

---

## ⚠️ Observaciones (no bloquean, pero hay que revisar)

- **Verificación en navegador con login:** No se pudo llamar a `POST /api/v1/analytics/portfolio-corte-v2/options` ni a `rendimiento-v2/options` con token (401 sin auth). Se recomienda con usuario logueado:
  1. Abrir http://localhost:8080, iniciar sesión.
  2. Ir a Análisis de Cartera y comprobar que los desplegables de UN y Fecha de Gestión muestran las opciones que devuelve la API (y que hay más de una UN y más de un mes si hay datos en DB).
  3. Ir a Rendimiento y comprobar lo mismo para Mes de Gestión y UN.
  - **Impacto:** bajo (la lógica backend/frontend está alineada con PLAN y AGENTS.md; la comprobación es de humo en UI).
  - **Sugerencia:** ejecutar manualmente los pasos anteriores o añadir un test E2E con sesión para validar que los filtros se pueblan.

- **DeprecationWarnings en tests:** Los tests smoke muestran avisos por `on_event` (FastAPI) y `datetime.utcnow()`. No afectan la funcionalidad revisada.
  - **Impacto:** bajo.
  - **Sugerencia:** migrar a lifespan y a `datetime.now(timezone.utc)` en un cambio posterior.

---

## ❌ Bloqueantes (no puede salir a producción así)

- **Ninguno detectado.** No se encontraron bloqueantes en el código, contratos de API ni en los tests smoke para los flujos de análisis de cartera y rendimiento v2.

---

## 📊 Coherencia de datos

- [x] **Totales:** La vista de cartera usa `summaryData?.kpis` y `kpiSummaryData?.kpis`; la de rendimiento usa `summary?.totalPaid`, `summary?.totalDebt`, etc. No se revisaron datos reales en pantalla por falta de sesión.
- [x] **Sin NaN/undefined en pantalla:** Las vistas usan `Number(... || 0)` y `formatCount`/`formatGsFull`; no se observan cadenas "NaN" o "undefined" en el código de presentación.
- [x] **Datos por empresa/UN:** El backend filtra por `un` en los payloads; el frontend envía `filters.uns` en el payload. La separación por UN es coherente con el diseño.
- [x] **Porcentajes:** En rendimiento se usa `pctNum(cobrado, deuda)` con protección frente a división por cero; los porcentajes se mantienen en rango razonable.

---

## 🔄 Reglas de negocio (AGENTS.md)

- [x] **Filtros y UN canónicas:** Implementado. Backend une UN de MV/agg con `_fetch_canonical_uns(db)` (dim_negocio_un_map, is_active=true). Frontend no hardcodea listas; usa `options.uns` y `options.gestion_months` (y equivalentes) de la API.
- [x] **UN “ODONTOLOGIA TTO” separada de “ODONTOLOGIA”:** Respetada por el modelo de mapeo canónico (dim_negocio_un_map); no hay consolidación por hardcode en el código revisado.
- [x] **Reportes por gestion_month:** Los filtros de “Fecha de Gestión” / “Mes de Gestión” y los payloads usan `gestion_month`/`gestionMonths` en ambas vistas.
- [x] **Rutas v2:** Frontend consume `/analytics/portfolio-corte-v2/*` y `/analytics/rendimiento-v2/*` por defecto.

---

## Veredicto

**APROBADO CON OBSERVACIONES**

**Razón:** La implementación cumple con el PLAN (Subtarea 5) y con AGENTS.md: filtros alimentados por la API v2, UN canónicas desde `dim_negocio_un_map`, meses completos desde agg + calendario, skeletons HeroUI y transiciones en filtros. Los smoke tests de options/summary v2 pasan. No se detectaron bloqueantes. Se recomienda una verificación manual con usuario logueado en http://localhost:8080 (análisis de cartera y rendimiento) para confirmar en pantalla que las opciones de filtros (UN y meses) coinciden con lo que devuelve la API cuando hay datos en la DB.
