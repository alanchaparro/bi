# Security Hardening v1

## Objetivo
Endurecer autenticacion/autorizacion para ambiente productivo manteniendo compatibilidad con flujo actual.

## Implementado
- Access token JWT (`/api/v1/auth/login`).
- Refresh token DB-backed (`/api/v1/auth/refresh`).
- Revocacion de refresh token (`/api/v1/auth/revoke`).
- Bloqueo temporal por intentos fallidos.
- RBAC por permisos (`brokers:read`, `brokers:write_config`, `analytics:read`, `analytics:export`).
- Usuarios autenticables en DB (`auth_users`) con hash `pbkdf2_sha256`.
- Bootstrap idempotente de usuarios (`scripts/bootstrap_auth_users.py`).

## Reglas
- No usar credenciales hardcodeadas fuera de `.env`.
- Todo endpoint protegido debe responder 401/403 con error contract estandar.
- Toda respuesta de error incluye `trace_id`.

## Pendiente recomendado
- Rotacion de claves JWT por version.
- Auditoria de login/refresh/revoke por IP/user-agent.
