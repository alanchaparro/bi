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
- `analytics:export`: admin

## Menú lateral (`nav:<id>`)
- Además de los permisos anteriores, el JWT incluye permisos `nav:cartera`, `nav:analisisCartera`, etc., alineados con `frontend/src/config/routes.ts` (`NAV_ITEMS`).
- Valores por defecto: los tres roles ven todas las entradas hasta que existan filas en la tabla `auth_role_nav` para ese rol; entonces solo aplican los `nav_id` guardados.
- Edición: pestaña **Roles y menús** en `/config` (requiere `brokers:write_config`). Tras guardar, cada usuario obtiene la lista actualizada al **refrescar token** (`POST /auth/refresh`) o al volver a iniciar sesión.
- El rol `admin` siempre conserva `nav:config` en servidor (no se puede quitar).

## Reglas
- Endpoints `POST /api/v1/brokers/*` requieren `brokers:write_config`.
- `GET` y `PUT /api/v1/brokers/role-nav-matrix` requieren `brokers:write_config`.
- Endpoints `GET /api/v1/brokers/*` requieren `brokers:read`.
- Endpoint login entrega JWT con `sub`, `role`, `permissions`.

## Notas
- Implementación inicial con usuarios en variables de entorno.
- Migración futura: usuarios persistidos + refresh token + revocación.
