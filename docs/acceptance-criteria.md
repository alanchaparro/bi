# Acceptance Criteria

## Brokers
- Dado filtros válidos, cuando aplico, entonces veo tabla agregada por mes/supervisor/UN/vía.
- Totales y subtotales deben coincidir con la suma de filas visibles.

## Configuración Comisiones
- Se pueden guardar reglas por supervisor/UN/vía/mes.
- Si no existe regla aplicable, comisión = 0.
- Cambios persisten entre sesiones y navegadores.

## Configuración Premios
- Escalas por meta y porcentaje mínimo.
- Si supera máximo umbral definido, mantiene premio de mayor escala alcanzada.
- Unificación FVBROKERS aplicada para cálculo final.

## Supervisores Brokers
- Selección de supervisores habilitados persiste.
- Filtros de supervisor en todas las secciones de Brokers muestran solo habilitados.

## Mora Brokers
- Filtros por supervisor, UN, vía, venta, cierre y antigüedad.
- Tabla incluye ID contrato, antigüedad en meses y días.

## Seguridad
- Usuario sin permiso de escritura no puede guardar reglas.
- Payload inválido devuelve error estructurado.
