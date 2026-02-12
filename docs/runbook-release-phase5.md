# Runbook Release Phase 5

## Objetivo
Liberar cambios analytics sin fricción usando feature flags, monitoreo de errores/latencia y reversión rápida sin rollback de código.

## Rollout incremental recomendado
1. Activar solo `FF_API_ANALISIS_CARTERA=true` para un grupo controlado.
2. Verificar métricas 15-30 minutos.
3. Activar `FF_API_MOVIMIENTO=true`.
4. Verificar métricas 15-30 minutos.
5. Activar `FF_API_ANUALES=true`.
6. Verificar métricas 15-30 minutos.
7. Activar `FF_API_RENDIMIENTO=true`.

## Señales de monitoreo
1. Frontend fallback-rate por tab:
   - Config tab -> card `Monitoreo API`.
   - Fuente: `analytics_api_metrics_v1` en `localStorage`.
2. Backend endpoint metrics:
   - `GET /analytics/ops/metrics`
   - Observar por endpoint: `p95_ms`, `error_rate_pct`, `cache_hit_rate_pct`.
3. Logs backend:
   - `docker compose logs dashboard --tail=300`
   - Revisar eventos `analytics_*` con `filters` y `cutoff`.

## Umbrales operativos (gate)
1. `error_rate_pct <= 2.0%` por endpoint durante ventana de verificación.
2. `p95_ms <= 1200ms` para endpoints analytics críticos.
3. `fallback-rate <= 10%` por tab en frontend (después de warmup).

## Reversión rápida (sin rollback de código)
1. Desactivar flag del tab afectado (`FF_API_* = false`).
2. Forzar hard refresh (`Ctrl+F5`) en usuarios impactados.
3. Confirmar descenso de fallback-rate y errores.
4. Mantener endpoint en observación y reintentar activación en ventana controlada.

## Comandos útiles
```powershell
# Métricas endpoint
curl http://localhost:5000/analytics/ops/metrics

# Reset métricas backend (nuevo ciclo de medición)
curl http://localhost:5000/analytics/ops/reset

# Validación completa antes de release
.\scripts\docker-validate.ps1
```
