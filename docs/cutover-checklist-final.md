# Cutover Checklist Final

## Pre-cutover
- [ ] Alembic en `head`.
- [ ] Migración legacy->DB ejecutada.
- [ ] CI release gates en verde.
- [ ] OpenAPI y tipos TS actualizados.

## Cutover
- [ ] Activar feature flag de módulos v1.
- [ ] Monitorear p95/error rate 30 minutos.
- [ ] Validar KPIs críticos (Brokers/Mora).

## Post-cutover
- [ ] Confirmar paridad con golden datasets.
- [ ] Documentar incidentes.
- [ ] Programar desactivación legacy.
