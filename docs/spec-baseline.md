# Spec Baseline Checklist

Objetivo: convertir `agente.md` en un contrato verificable para ejecucion y auditoria.

## 1. Reglas de trabajo
- [x] Trabajo por fases con hitos definidos.
- [x] Trazabilidad de decisiones y supuestos.
- [x] Convenciones de naming y consistencia de componentes.
- [x] Prohibicion explicita de practicas inseguras.

## 2. UX y diseno
- [x] Jerarquia visual por rol.
- [x] Consistencia de filtros, drill-down y estados.
- [x] Estados loading/empty/error definidos.
- [x] Personalizacion persistente por usuario autenticado.

## 3. No funcionales
- [x] Modularidad y separacion por capas.
- [x] Logging estructurado.
- [x] Estrategia de performance y limites medibles.

## 4. Seguridad
- [x] Frontend no accede directo a MySQL.
- [x] Endpoints con validacion Pydantic.
- [x] Secretos por `.env`.
- [x] Modelo RBAC base implementado.
- [x] Endurecimiento completo de auth (refresh tokens, rotacion, bloqueo).

## 5. Stack objetivo
- [x] Backend FastAPI.
- [x] SQLAlchemy + Alembic.
- [x] Frontend React + TypeScript (migracion funcional Brokers).
- [x] Docker Compose.

## 6. Entregables
- [x] Especificacion funcional.
- [x] Diseno tecnico.
- [x] Esquema DB + migraciones iniciales.
- [x] Backend v1 para Brokers config + analytics.
- [x] Frontend modular Brokers funcional.
- [x] QA checklist y pruebas automatizadas.
- [x] Runbook de operacion y cutover.

## 7. Criterio de cumplimiento
- [x] Paridad funcional total legacy vs v1 cerrada en modulos criticos.
- [x] Cobertura minima acordada en CI alcanzada por gates release.
- [x] Cutover de produccion listo para ejecucion con rollback documentado.

## Evidencia tecnica
- Seguridad y rate limiting: `backend/app/core/auth_refresh.py`, `backend/app/core/rate_limit.py`, `backend/app/core/deps.py`.
- Error contract uniforme con trace_id (incluye 422): `backend/app/main.py`.
- Migracion legacy->DB + verificacion deterministica: `scripts/migrate_legacy_config_to_db.py`, `scripts/verify_legacy_config_migration.py`.
- Analytics v1 + export explícito csv/pdf: `backend/app/api/v1/endpoints/analytics.py`.
- Persistencia de filtros por usuario: `backend/app/api/v1/endpoints/brokers.py`, `backend/alembic/versions/0004_user_preferences.py`.
- Gates CI/CD de cierre: `.github/workflows/release.yml`.
