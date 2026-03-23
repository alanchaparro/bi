# bugs_visual.md — Registro canónico visual UX/UI

## Uso
- `audit`: detectar oportunidades visuales/UX y registrar V-*.
- `verifica`: contrastar implementación y pasar a `Cerrado` o `Abierto`.

## Instrucciones para el dev (ejecucion)
1. Ejecutar recovery:
   - Windows doble clic: `RECUPERAR_DEV.bat`
   - Sin fetch remoto: `RECUPERAR_DEV.bat nofetch`
2. Seguir el plan: `RECUPERACION_DEV_PLAN.md`.
3. Completar checklist generado: `RECOVERY_EXECUTION_CHECKLIST.txt`.
4. Al cerrar una pasada, dejar `bugs_visual.md` sin drift con el codigo y con estados V-* consistentes.

## Estado recuperado (último consolidado)

### Verificación visual histórica
- V-001 a V-054: **Cerrado** en el último ciclo validado antes del incidente.
- V-055: **Cerrado** en recovery (confirmación explícita HeroUI para "Parar todo (emergencia)").

## Hallazgos visuales activos
- **V-054 (reabierto, P3):** `ConfigView` volvió a `window.confirm('¿Eliminar esta programación?')` en borrado, rompiendo el patrón HeroUI de confirmaciones.
- **V-057 (P2):** `BrokersPrizesView` regresó a shell legacy (`section.card` + `SectionHeader`, `<input className="input">`, `alert-error`, borrado sin confirmación), perdiendo consistencia con HeroUI/canon.
- **V-058 (P2):** `BrokersMoraView` usa patrón legacy (`<h2>`, `<select className="input">`, `style` inline, tabla sin formato operativo) y no sigue el contrato visual de `AnalyticsPageHeader` + `analysis-panel-card`.
- **V-059 (P3):** `AnalisisCarteraLegacyView` volvió a estilos inline en cabecera y CTA `<a>` con utilidades, en lugar de `Button` HeroUI + clases compartidas.

## Checklist visual para próximas pasadas
- Coherencia de jerarquía visual (`AnalyticsPageHeader`, títulos, subtítulos)
- Tamaños de botón y targets táctiles (>=44px cuando aplique)
- Estados loading/error/empty consistentes
- Contraste y foco visible (`focus-visible`)
- Reduced motion global coherente
- Tablas y filtros con lenguaje de negocio

## Historial
| Fecha | Acción |
|---|---|
| 2026-03-23 | Recuperación post-incidente: recreado `bugs_visual.md` canónico con estado consolidado. |
| 2026-03-23 | Recovery dev: V-055 cerrado en `ConfigView` con confirmación explícita en `Modal` HeroUI antes de detener programación global. |
| 2026-03-23 | Se agregan instrucciones operativas para dev y launcher `RECUPERAR_DEV.bat`. |
| 2026-03-23 | Auditoría incremental: se reabre V-054 por regresión a `window.confirm` en borrar programación y se crea V-056 por estilos inline residuales en `ConfigView`. |
| 2026-03-23 | Dev: V-054 y V-056 cerrados en `ConfigView` (confirmación de borrado con `Modal` HeroUI y migración de estilos inline a clases CSS reutilizables). |
| 2026-03-23 | Auditoría incremental II: se detectan regresiones en `BrokersPrizesView`, `BrokersMoraView` y `AnalisisCarteraLegacyView` (V-057, V-058, V-059). |
| 2026-03-23 | Verifica/audit: V-054 se reabre nuevamente por retorno de `window.confirm` en borrado de programación. |
