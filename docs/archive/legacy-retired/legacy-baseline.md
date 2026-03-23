# Baseline de Legacy Retirado

- Fecha de retiro: 2026-03-23
- Responsable: equipo dev recovery
- Estado: retirado del flujo principal

## Componentes legacy retirados

- Runtime: `start_dashboard.py`
- UI estática: `dashboard.html`, `dashboard.js`, `dashboard.css`
- Artefactos legacy: `served_dashboard.js`, `served_raw.js`
- Módulos JS legacy: `tabs/*`, `ui/*`, `core/*`, `data/*` (incluyendo DBs de prueba locales legacy)

## Endpoints legacy retirados

- Proxy legacy `v1proxy` en runtime legacy:
  - `/api/v1proxy/commissions`
  - `/api/v1proxy/prizes`
  - `/api/v1proxy/brokers-supervisors`

## Variables legacy retiradas del camino canónico

- `DASHBOARD_PORT`
- `ANALYTICS_LEGACY_BASE_URL`
- `ANALYTICS_LEGACY_TIMEOUT_SECONDS`
- `NEXT_PUBLIC_LEGACY_DASHBOARD_URL`
- `LEGACY_DASHBOARD_URL`
- `analytics_legacy_base_url` (config backend)

## Notas de migración

- El stack canónico queda en `frontend-prod` (8080) + `api-v1` (8000) + `postgres`.
- La documentación histórica de comparación legacy queda archivada en esta carpeta.
