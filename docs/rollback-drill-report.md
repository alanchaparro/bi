# Rollback Drill Report

Estado: listo para ejecucion en staging/prod.

## Metadatos
- Ambiente: staging (`prod` profile)
- Fecha:
- Version candidata:
- Responsable de ejecucion:

## Objetivo
Validar rollback completo (< 15 min) sin perdida de configuracion ni degradacion funcional.

## Escenario ejecutado
1. Deploy de version candidata con API v1 + dashboard.
2. Simulacion de falla controlada en analytics.
3. Activacion de rollback operativo.

## Timeline real
- T0 deploy iniciado:
- T+X deteccion incidente:
- T+Y rollback iniciado:
- T+Z rollback finalizado:
- Tiempo total rollback (min):

## Verificaciones post-rollback
- [ ] `GET /api/v1/health` => ok.
- [ ] `GET/POST /api/v1/brokers/supervisors-scope` funcional.
- [ ] `GET/POST /api/v1/brokers/preferences` funcional.
- [ ] `GET /analytics/ops/metrics` estable.
- [ ] Configuracion sin perdida (comparacion pre/post).

## Evidencias adjuntas
- Logs deploy:
- Logs rollback:
- Resultado `scripts/verify_legacy_config_migration.py`:
- Resultado monitoreo cutover (`docs/evidence/cutover-window-metrics.jsonl`):

## Resultado
- [ ] Aprobado
- [ ] Rechazado
- Motivo:

## Firmas
- Operaciones: __________________
- QA: __________________
- Lider tecnico: __________________
