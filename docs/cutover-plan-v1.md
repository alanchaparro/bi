# Cutover Plan v1

## Estrategia
1. Mantener Legacy en producción.
2. Publicar API v1 en paralelo.
3. Ejecutar paridad de KPIs y regresión funcional.
4. Habilitar frontend v1 por feature flag.
5. Monitorear 7 días.
6. Retirar rutas legacy de configuración gradualmente.

## Criterios de entrada
- Tests críticos en verde.
- Error rate < 2%.
- Paridad de cálculos >= 99.5%.

## Criterios de rollback
- Error rate > 2% sostenido.
- Desvío KPI > 0.5% en críticos.
- Falla en persistencia de reglas.

## Checklist de salida
- Documentación actualizada.
- Auditoría de cambios activa.
- Operación entrenada con runbook.
