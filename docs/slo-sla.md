# SLO / SLA

## Objetivos de latencia (p95)
- GET `/api/v1/brokers/*`: <= 300 ms
- POST `/api/v1/brokers/*`: <= 400 ms
- GET analytics agregados: <= 1200 ms

## Disponibilidad
- API interna: >= 99.5% mensual.

## Throughput objetivo
- 50 req/min sostenidas sin degradación crítica para módulos Brokers.

## Calidad de datos
- Discrepancia máxima aceptable vs legacy: <= 0.5% en agregados principales.
- Pruebas de paridad con golden datasets por corte mensual.

## Observabilidad mínima
- Logs estructurados JSON con `trace_id`, `path`, `status`, `latency_ms`.
- Error rate por endpoint y últimos 7 días.

## Alertas base
- Error rate > 2% en 5 min.
- p95 > 2x umbral durante 10 min.
