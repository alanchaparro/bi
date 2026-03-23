# Arquitectura Técnica Objetivo

## Capas
- `api`: routers y contratos HTTP.
- `services`: reglas de negocio.
- `domain`: reglas canónicas puras en Python (`gestion_month`, tramo/categoría, rendimiento, UN y exclusiones).
- `repositories`: acceso a datos.
- `models`: entidades SQLAlchemy.
- `schemas`: validación/serialización Pydantic.
- `core`: config, seguridad, dependencias.

## Flujo
Frontend -> API v1 -> Service -> Repository -> DB

## Fuente de Verdad de Reglas
- Reglas semánticas compartidas viven en `backend/app/domain/`.
- `sync_service.py` y `analytics_service.py` deben reutilizar esas funciones y no reimplementar reglas.
- SQL queda para extracción, joins pesados y agregados técnicos; no debe introducir nuevas reglas de negocio.

## Compatibilidad
- El runtime canónico es API v1 + frontend nuevo.
- v1 expone contratos versionados `/api/v1/*`.

## Errores
Formato estándar:
```json
{
  "error_code": "...",
  "message": "...",
  "details": null,
  "trace_id": "..."
}
```

## Seguridad
- JWT Bearer.
- RBAC por permisos.
- Validación de payload en todos los endpoints de escritura.

## Persistencia
- Tabla singleton por configuración (scope/comisiones/premios).
- Auditoría de cambios en `audit_log`.
