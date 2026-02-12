# Frontend Modules

## Core
- `dashboard.js`: orchestrator and fallback local computations.

## Data
- `data/normalize.js`: date/via/month normalization helpers.
- `data/validator.js`: dataset validation rules.
- `data/api-client.js`: analytics API adapter.
- `data/feature-flags.js`: runtime feature flags + debug mode.

## UI
- `ui/navigation.js`: nav state helper.
- `ui/filters.js`: filter utility helpers.
- `ui/notifications.js`: toast-like notifications.

## Tabs
- `tabs/acaMovimiento.js`: movimiento mapper + resumen UI helpers.
- `tabs/acaAnuales.js`: render de tabla anual + resumen UI helpers.
- `tabs/analisisCartera-api.js`: API adapter for Analisis Cartera.
- `tabs/rendimiento-api.js`: API adapter for Rendimiento.
- `tabs/acaMovimiento-api.js`: API adapter for movimiento de cartera.
- `tabs/acaAnuales-api.js`: API adapter for Analisis Anuales.

## Charts
- `charts/renderers.js`: shared chart destruction helper.

## Core
- `core/filter-state.js`: filter signature helpers.
- `core/selection-summary.js`: summary formatting helper.
- `core/chart-label-layout.js`: shared overlap utility primitives.
