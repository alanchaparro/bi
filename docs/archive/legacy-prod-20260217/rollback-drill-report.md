# Rollback Drill Report

Estado: pendiente por ejecutar en ventana estable (staging/prod).

## Metadatos
- Ambiente: staging (`prod` profile)
- Fecha: 2026-02-16 (preparacion local)
- Version candidata: `HEAD` local post-cierre plan 100%
- Responsable de ejecucion: Equipo Plataforma

## Objetivo
Validar rollback completo (< 15 min) sin perdida de configuracion ni degradacion funcional.

## Escenario ejecutado
1. Deploy de version candidata con API v1 + dashboard.
2. Simulacion de falla controlada en analytics.
3. Activacion de rollback operativo.

## Timeline real
- T0 deploy iniciado: N/A (no ejecutado aun en staging estable)
- T+X deteccion incidente: N/A
- T+Y rollback iniciado: N/A
- T+Z rollback finalizado: N/A
- Tiempo total rollback (min): N/A

## Verificaciones post-rollback
- [ ] `GET /api/v1/health` => ok.
- [ ] `GET/POST /api/v1/brokers/supervisors-scope` funcional.
- [ ] `GET/POST /api/v1/brokers/preferences` funcional.
- [ ] `GET /analytics/ops/metrics` estable.
- [ ] Configuracion sin perdida (comparacion pre/post).

## Evidencias adjuntas
- Logs deploy: `docs/evidence/release_finalize_cycle1_20260216_124855.log`, `docs/evidence/release_finalize_cycle2_20260216_125652.log`
- Logs rollback: pendiente
- Resultado `scripts/verify_legacy_config_migration.py`: OK (incluido en logs de release finalize)
- Resultado monitoreo cutover (`docs/evidence/cutover-window-metrics.jsonl`): parcial (24 muestras, 1 timeout transitorio)

## Resultado
- [ ] Aprobado
- [ ] Rechazado
- Motivo: pendiente ejecucion formal en staging con ventana estable y evidencia de tiempo total < 15 min.

## Firmas
- Operaciones: __________________
- QA: __________________
- Lider tecnico: __________________
