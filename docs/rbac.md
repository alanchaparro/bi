# RBAC

## Roles
- `admin`: lectura/escritura total (configuraciones, reglas, scope supervisores).
- `analyst`: lectura de analytics y brokers.
- `viewer`: solo lectura de tableros.

## Matriz de permisos
- `brokers:read`: admin, analyst, viewer
- `brokers:write_config`: admin
- `analytics:read`: admin, analyst, viewer
- `system:read`: admin, analyst

## Reglas
- Endpoints `POST /api/v1/brokers/*` requieren `brokers:write_config`.
- Endpoints `GET /api/v1/brokers/*` requieren `brokers:read`.
- Endpoint login entrega JWT con `sub`, `role`, `permissions`.

## Notas
- Implementación inicial con usuarios en variables de entorno.
- Migración futura: usuarios persistidos + refresh token + revocación.
