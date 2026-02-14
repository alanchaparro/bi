# Rollback Drill Report

## Entorno
- Docker Compose profile: `prod`
- Fecha ensayo: pendiente

## Escenario
1. Deploy versión candidata.
2. Simular falla en endpoint analytics.
3. Ejecutar rollback completo.

## Resultado esperado
- Restauración de servicio < 15 min.
- Configuración de Brokers intacta.
- No pérdida de reglas en DB.

## Evidencias
- Logs de deploy
- Logs de rollback
- Validación post-rollback (health + brokers config + analytics)
