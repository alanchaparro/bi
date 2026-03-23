# Verificación Histórica Legacy vs 8080 (Archivado)

Este documento queda archivado porque el runtime legacy fue retirado del flujo principal.

## Contexto histórico

- Legacy: `dashboard` en `:5000`.
- Nuevo: `frontend-prod` en `:8080`.
- API: `api-v1` en `:8000`.

## Estado actual

- El servicio `dashboard` ya no forma parte del compose canónico.
- Las verificaciones operativas activas deben ejecutarse sobre endpoints v2 vía `api-v1`.
- Para validaciones actuales, usar:
  - `scripts/smoke_analytics_v2.py`
  - `docs/runbook-local.md`
  - `desacople.md`
