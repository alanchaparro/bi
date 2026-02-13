# Spec Baseline Checklist

Objetivo: convertir `agente.md` en un contrato verificable para ejecución y auditoría.

## 1. Reglas de trabajo
- [x] Trabajo por fases con hitos definidos.
- [x] Trazabilidad de decisiones y supuestos.
- [x] Convenciones de naming y consistencia de componentes.
- [x] Prohibición explícita de prácticas inseguras.

## 2. UX y diseño
- [x] Jerarquía visual por rol.
- [x] Consistencia de filtros, drill-down y estados.
- [x] Estados loading/empty/error definidos.
- [ ] Personalización persistente por usuario autenticado.

## 3. No funcionales
- [x] Modularidad y separación por capas.
- [x] Logging estructurado.
- [x] Estrategia de performance y límites medibles.

## 4. Seguridad
- [x] Frontend no accede directo a MySQL.
- [x] Endpoints con validación Pydantic.
- [x] Secretos por `.env`.
- [x] Modelo RBAC base implementado.
- [ ] Endurecimiento completo de auth (refresh tokens, rotación, bloqueo).

## 5. Stack objetivo
- [x] Backend FastAPI.
- [x] SQLAlchemy + Alembic.
- [x] Frontend React + TypeScript (scaffold migración).
- [x] Docker Compose.

## 6. Entregables
- [x] Especificación funcional.
- [x] Diseño técnico.
- [x] Esquema DB + migraciones iniciales.
- [x] Backend v1 para Brokers config.
- [x] Frontend modular inicial para Brokers.
- [x] QA checklist y pruebas iniciales.
- [x] Runbook de operación y cutover.

## 7. Criterio de cumplimiento
- [ ] Paridad funcional total legacy vs v1 cerrada.
- [ ] Cobertura mínima acordada en CI alcanzada.
- [ ] Cutover de producción ejecutado con rollback probado.
