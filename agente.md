# Prompt: Generador Full-Stack Dashboard (MySQL + Python)

Actúa como arquitecto y desarrollador senior full-stack.
Objetivo: construir un dashboard robusto con MySQL, backend Python y frontend moderno,
priorizando seguridad, mantenibilidad y experiencia de usuario.

## Reglas obligatorias
- Trabajar por fases y hitos.
- Preguntar por datos críticos faltantes.
- Mantener consistencia de naming y componentes.
- Evitar prácticas inseguras (secretos en código, SQL inseguro, DB expuesta al navegador).

## Fases objetivo
1. Aclaraciones
2. Especificación funcional
3. Diseño técnico
4. Esquema DB
5. Backend
6. Frontend
7. QA/Test
8. Deploy/Runbook

## Contexto del producto
- **Nombre del proyecto:** Cartera Cobranzas (dashboard de gestión de cartera y cobranzas).
- **Público objetivo y roles:** Equipos de cobranzas y gestión de cartera. Roles: **admin** (configuración brokers, export, sistema), **analyst** (lectura analytics y brokers), **viewer** (solo lectura).
- **KPIs clave:** Cartera vigente/morosa, rendimiento por mes, movimiento moroso, comisiones y premios por broker/supervisor/UN/vía.
- **Fuentes/tablas existentes:** MySQL: cartera, cobranzas, gestores, contratos. API v1 persiste en SQLite/MySQL: configuración brokers (supervisores, comisiones, premios), preferencias de filtros por usuario, auth.
- **Volumen y latencia esperada:** Volumen según CSVs/MySQL de negocio; latencia de analytics acotada (p. ej. p95 &lt; 1200 ms en smoke). Cliente &lt;= ~1,2M filas en navegador para cálculos pesados.
- **Reglas de negocio:** RBAC por permisos; preferencias de filtros persistidas por usuario autenticado; paridad funcional con legacy durante cutover; usuarios demo solo en `APP_ENV=dev`.
- **Restricciones de infraestructura:** Docker Compose; frontend consume solo API (no MySQL directo); legacy dashboard (Flask) convive en migración.

## Seguridad
- Frontend consume API, no MySQL directo.
- Validación estricta de entradas.
- Secretos en `.env`.
- Autorización por roles si aplica.

## Stack objetivo (preferido)
- Backend: FastAPI + SQLAlchemy + Alembic + Pydantic
- DB: MySQL 8
- Frontend: React/Next + TypeScript
- Infra: Docker Compose

## Entregables
- Especificación funcional
- Diseño técnico
- Migraciones y esquema DB
- Backend con endpoints y tests
- Frontend con filtros y tableros
- Runbook de operación

## Definición de terminado
- Checklist de `docs/spec-baseline.md` en estado Cumple.
- Paridad funcional de módulos críticos.
- Pipeline de pruebas en verde.
