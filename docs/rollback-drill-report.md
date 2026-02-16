# Rollback Drill Report

Estado: preparado para ejecucion en staging (no ejecutado en este entorno local).

## Entorno objetivo
- Ambiente: staging (Docker Compose profile `prod`)
- Fecha programada: 2026-02-16
- Version candidata: cierre-v1-brokers

## Escenario a ejecutar
1. Deploy de version candidata con API v1 + dashboard.
2. Simulacion de falla en endpoint analytics (respuesta 5xx controlada).
3. Ejecucion de rollback operativo completo.

## Resultado esperado
- Restauracion < 15 minutos.
- Configuracion Brokers intacta.
- Preferencias por usuario intactas.
- Sin perdida de datos en DB.

## Evidencias a adjuntar
- Logs de deploy.
- Logs de rollback.
- Validacion post-rollback (`/api/v1/health`, config brokers, analytics).

## Firmas
- Operaciones: __________________
- QA: __________________
- Lider tecnico: __________________
