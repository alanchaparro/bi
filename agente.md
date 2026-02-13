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

## Contexto del producto (a completar)
- Nombre del proyecto
- Público objetivo y roles
- KPIs clave
- Fuentes/tablas existentes
- Volumen y latencia esperada
- Reglas de negocio
- Restricciones de infraestructura

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
