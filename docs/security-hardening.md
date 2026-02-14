# Security Hardening v1

## Objetivo
Endurecer autenticación/autorización para ambiente productivo manteniendo compatibilidad con flujo actual.

## Implementado
- Access token JWT (`/api/v1/auth/login`).
- Refresh token DB-backed (`/api/v1/auth/refresh`).
- Revocación de refresh token (`/api/v1/auth/revoke`).
- Bloqueo temporal por intentos fallidos.
- RBAC por permisos (`brokers:read`, `brokers:write_config`, `analytics:read`, `analytics:export`).

## Reglas
- No usar credenciales hardcodeadas fuera de `.env`.
- Todo endpoint protegido debe responder 401/403 con error contract estándar.
- Toda respuesta de error incluye `trace_id`.

## Pendiente recomendado
- Almacenar usuarios reales en DB.
- Rotación de claves JWT por versión.
- Auditoría de login/refresh/revoke por IP/user-agent.
