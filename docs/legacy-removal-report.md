# Reporte de Retiro Legacy

- Fecha/hora: 2026-03-23
- Alcance: retiro de runtime legacy del flujo principal y limpieza de acoples técnicos

## Archivos retirados

- `start_dashboard.py`
- `dashboard.html`
- `dashboard.js`
- `dashboard.css`
- `served_dashboard.js`
- `served_raw.js`
- `tabs/*`
- `ui/*`
- `core/*`
- `data/*` legacy JS y DBs de prueba legacy
- `tests/test_dashboard_static.py`
- `tests/test_movement_endpoint_static.py`
- `scripts/parity_check_analytics_v1.py`
- `docs/verificacion-legacy-vs-8080.md` (movido a `docs/archive/legacy-retired/`)

## Variables/config retiradas

- `.env.example`: `DASHBOARD_PORT`, `ANALYTICS_LEGACY_BASE_URL`, `ANALYTICS_LEGACY_TIMEOUT_SECONDS`
- `backend/app/core/config.py`: `analytics_legacy_base_url`, timeout legacy
- `frontend/README.md`: `NEXT_PUBLIC_LEGACY_DASHBOARD_URL`

## CI y scripts ajustados

- `docker-compose.yml`: servicio `dashboard` eliminado.
- `Dockerfile`: runtime por defecto alineado a `api-v1`.
- Workflows CI/release migrados a `api-v1` para compile/tests/smokes.
- Scripts de validación y one-click migrados de `dashboard` a `api-v1`.
- `Makefile` actualizado para ejecutar smokes/tests sin runtime legacy.

## Impacto esperado

- El despliegue canónico usa solo stack nuevo (`frontend-prod`, `api-v1`, `postgres`).
- Menor superficie de mantenimiento y menor riesgo de regresión por rutas/proxies legacy.
- Se elimina dependencia operativa al puerto `5000`.

## Evidencia de verificación

- Barrido de referencias críticas legacy en runtime/código principal sin hallazgos activos fuera de documentación histórica.
- Checklist de `desacople.md` marcado completo.
- Validaciones de compilación y tests ejecutadas en stack nuevo.
