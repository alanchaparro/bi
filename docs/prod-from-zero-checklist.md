# Prod From Zero Checklist

Fecha base: 2026-02-17

## Cambio y freeze
- [ ] Ventana de cambio aprobada
- [ ] Inventario de jobs/schedulers completado
- [ ] War-room definido (Backend, Frontend, Ops, QA)

## Baja legacy
- [ ] Ejecutado `schtasks /Delete /TN "CobranzasSyncIncremental" /F`
- [ ] Verificado que no existen tareas remanentes de sync legacy
- [ ] Checklist de cron/systemd externos completado manualmente

## Bootstrap
- [ ] `.env` productivo validado
- [ ] `scripts/prod_bootstrap_from_zero.ps1` ejecutado con exito
- [ ] `alembic upgrade head` aplicado
- [ ] bootstrap auth ejecutado
- [ ] migracion y verificacion de config legacy ejecutadas

## Sync dual
- [ ] corrida full_all valida (sin year_from)
- [ ] corrida full_year valida (con year_from)
- [ ] estado en vivo y logs verificados
- [ ] sin duplicados por constraint UPSERT

## Frontend
- [ ] ConfigView muestra selector dominio + ano opcional
- [ ] barra de progreso y log en vivo funcionando
- [ ] CarteraView activo y sin placeholder
- [ ] filtros cartera persisten por usuario (`cartera_filters_v1`)

## Evidencias
- [ ] `docs/evidence/` contiene solo evidencia del ciclo nuevo
- [ ] reporte de limpieza completado en `docs/prod-reset-cleanup-report.md`

## Checklist manual externo (cron/systemd)
- [ ] host/servicio:
- [ ] scheduler detectado:
- [ ] accion de baja aplicada:
- [ ] evidencia (ticket/captura):
