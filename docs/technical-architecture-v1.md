# Arquitectura Técnica Objetivo

## Capas
- `api`: routers y contratos HTTP.
- `services`: reglas de negocio.
- `repositories`: acceso a datos.
- `models`: entidades SQLAlchemy.
- `schemas`: validación/serialización Pydantic.
- `core`: config, seguridad, dependencias.

## Flujo
Frontend -> API v1 -> Service -> Repository -> DB

## Compatibilidad
- Legacy (`start_dashboard.py`) permanece operativo durante migración.
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
