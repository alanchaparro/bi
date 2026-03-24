# bugs_visual.md — Registro canónico visual UX/UI

## Uso
- `audit`: detectar oportunidades visuales/UX y registrar V-*.
- `verifica`: contrastar implementación y pasar a `Cerrado` o `Abierto`.

## Instrucciones para el dev (ejecucion)
1. Ejecutar recovery:
   - Windows doble clic: `RECUPERAR_DEV.bat`
   - Sin fetch remoto: `RECUPERAR_DEV.bat nofetch`
2. Seguir el plan: `RECUPERACION_DEV_PLAN.md`.
2.1. Si hay mezcla legacy/nuevo, aplicar canónico técnico transversal: `desacople.md`.
3. Completar checklist generado: `RECOVERY_EXECUTION_CHECKLIST.txt`.
4. Al cerrar una pasada, dejar `bugs_visual.md` sin drift con el codigo y con estados V-* consistentes.

## Estado recuperado (último consolidado)

### Verificación visual histórica
- V-001 a V-054: **Cerrado** en el último ciclo validado antes del incidente.
- V-055: **Cerrado** en recovery (confirmación explícita HeroUI para "Parar todo (emergencia)").

## Canonico visual de filtros segmentados (nuevo obligatorio)
- Para filtros de selección única como `Categoria` y `Via de cobro`, usar siempre el mismo estilo de referencia:
  - grupo horizontal con borde redondeado y fondo del panel.
  - opción activa en bloque verde/teal con texto blanco.
  - opciones inactivas en texto gris claro sin relleno dominante.
  - espaciado y altura consistentes entre vistas.
- Este canónico aplica en todo el frente nuevo.
- Referencia técnica: `desacople.md` (sección `3.1`).

## Hallazgos visuales activos
Actualmente no hay V-* abiertos pendientes de recuperar desde la última verificación consolidada.

### Verificación visual 2026-03-24
- V-063, V-064 y V-065: **Cerrado** en esta pasada.
- Evidencia: barrido de módulos activos (`frontend/src/modules/**`) sin marcadores legacy (`SectionHeader`, `window.confirm`, `className="input"`, ids `*Legacy*`) y mantenimiento de patrón visual canónico para filtros segmentados (`Categoria`/`Via de cobro`) según `desacople.md` sección 3.1.

## Checklist visual para próximas pasadas
- Coherencia de jerarquía visual (`AnalyticsPageHeader`, títulos, subtítulos)
- Tamaños de botón y targets táctiles (>=44px cuando aplique)
- Estados loading/error/empty consistentes
- Contraste y foco visible (`focus-visible`)
- Reduced motion global coherente
- Tablas y filtros con lenguaje de negocio
- Filtros segmentados canónicos (`Categoria`, `Via de cobro` y equivalentes) con el mismo estilo activo/inactivo

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
| 2026-03-23 | Dev: V-054, V-057, V-058 y V-059 cerrados (confirmaciones HeroUI y migración de vistas legacy al patrón canónico `AnalyticsPageHeader` + componentes HeroUI). |
| 2026-03-23 | Auditoría incremental III: se reabren V-054/V-057/V-058/V-059 y se agregan V-060/V-061/V-062 por regresión amplia a implementaciones legacy en módulos brokers/cartera. |
| 2026-03-23 | Dev/verifica: se cierran V-054, V-057, V-058, V-059, V-060, V-061 y V-062 con normalización canónica HeroUI en módulos config/brokers/cartera (headers, estados y confirmaciones). |
| 2026-03-23 | Verificación visual de continuidad: sin V-* nuevos tras build/typecheck, backlog visual permanece en cero y sin drift detectado entre estado canónico y vistas brokers/cartera/config. |
| 2026-03-23 | Se incorpora canónico explícito de filtros segmentados (`Categoria`/`Via de cobro`) para auditoría y desarrollo. |
| 2026-03-24 | Verificación visual: V-063/V-064/V-065 cerrados; `bugs_visual.md` y `bugs.md` vuelven a estado consistente (sin drift) tras nueva pasada de desacople. |
