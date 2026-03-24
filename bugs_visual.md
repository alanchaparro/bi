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
5. Si el hallazgo visual impacta performance/fluidez, alinear también con `optimo.md`.

## Estado recuperado (último consolidado)

### Verificación visual histórica
- V-001 a V-054: **Cerrado** en el último ciclo validado antes del incidente.
- V-055: **Cerrado** en recovery (confirmación explícita HeroUI para "Parar todo (emergencia)").

## Hallazgos visuales activos
Actualmente no hay V-* abiertos pendientes de recuperar desde la última verificación consolidada.

### Cierres de esta pasada
- **V-064 (Cerrado):** `BrokersPrizesView` migra feedback de carga/error al canónico `LoadingState`/`ErrorState` (sin `alert-error` ni texto plano de carga).
- **V-065 (Cerrado):** `ConfigView` normaliza estado de error en health/import logs con `ErrorState`.
- **V-066 (Cerrado):** `ConfigView` incorpora loading canónico para programación (`LoadingState`) y elimina feedback legacy en el flujo.
- **V-067 (Cerrado):** `AnalisisCarteraView` corrige recorte visual en puntas de barras del gráfico apilado por gestión (holgura vertical + unión de segmentos sin clipping superior).

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
| 2026-03-23 | Dev: V-054, V-057, V-058 y V-059 cerrados (confirmaciones HeroUI y migración de vistas legacy al patrón canónico `AnalyticsPageHeader` + componentes HeroUI). |
| 2026-03-23 | Auditoría incremental III: se reabren V-054/V-057/V-058/V-059 y se agregan V-060/V-061/V-062 por regresión amplia a implementaciones legacy en módulos brokers/cartera. |
| 2026-03-23 | Dev/verifica: se cierran V-054, V-057, V-058, V-059, V-060, V-061 y V-062 con normalización canónica HeroUI en módulos config/brokers/cartera (headers, estados y confirmaciones). |
| 2026-03-23 | Verificación visual de continuidad: sin V-* nuevos tras build/typecheck, backlog visual permanece en cero y sin drift detectado entre estado canónico y vistas brokers/cartera/config. |
| 2026-03-24 | Auditoría `audit`: se detectan V-064/V-065/V-066 por feedback visual legacy en `BrokersPrizesView` y `ConfigView` (`alert-error` y carga en texto plano). |
| 2026-03-24 | Dev/verifica: V-064/V-065/V-066 pasan a **Cerrado** al normalizar estados de carga/error con `LoadingState`/`ErrorState` en brokers/config. |
| 2026-03-24 | Dev/verifica: V-067 pasa a **Cerrado** en `AnalisisCarteraView` al eliminar clipping en puntas de barras del chart apilado por gestión. |
| 2026-03-24 | Ajuste fino V-067: se incrementa holgura vertical y visibilidad mínima del segmento superior en barras apiladas para evitar tapa plana cuando el valor secundario es casi cero. |
| 2026-03-24 | Ajuste estructural V-067: barras apiladas dejan de estirarse por `flex` en muestras cortas (1-3 meses), con ancho fijo adaptable y mayor espacio para ejes X/Y para evitar recorte visual. |
| 2026-03-24 | Ajuste final V-067: se corrige posicionamiento del tick superior del eje Y (evitando clipping) y se amplía espacio inferior para etiquetas del eje X verticales. |
| 2026-03-24 | Ajuste adicional V-067: se agrega headroom de escala en Y (+8%) y se fija el tick superior dentro del área útil (`bottom: calc(100% - 0.95rem)`) para evitar recorte persistente en distintas resoluciones. |
| 2026-03-24 | Ajuste de distribución V-067: barras/labels usan layout fluido en series medianas (>=6) para eliminar gran hueco a la derecha; en series cortas (<=3) se centran sin deformar ancho. |
| 2026-03-24 | Corrección V-067: se elimina límite `maxWidth` en barras/labels fluidos para permitir expansión completa y distribución uniforme sin hueco residual a la derecha. |
| 2026-03-24 | Mejora UX V-067: se agrega toggle `Mostrar porcentaje/numero` en charts apilados y detalle persistente dentro del gráfico (numero + %) por serie, visible en hover o fijo sin hover. |
| 2026-03-24 | Ajuste UX V-067 solicitado por usuario: `Mostrar porcentaje/numero` pasa a render por cada barra (cada serie por separado) en lugar de un único recuadro global del gráfico. |
| 2026-03-24 | Ajuste de legibilidad V-067: modo limpio en etiquetas por barra (solo porcentaje); el número absoluto queda en el detalle de hover para evitar saturación visual. |
| 2026-03-24 | Ajuste de visibilidad V-067: etiquetas por barra se reposicionan dentro del cuerpo de cada barra (top/bottom) con `% + cantidad` por serie para evitar clipping/solape en la parte superior del chart. |
| 2026-03-24 | Mejora de accesibilidad visual V-067: se agregan controles `+/-` de zoom para escalar tamaño de etiquetas por barra (70%-200%) sin afectar datos ni ejes. |
| 2026-03-24 | Persistencia UX V-067: el zoom de etiquetas por chart apilado se guarda en `localStorage` y se restaura al recargar (`Vigente/Moroso` y `Cobrador/Débito` por separado). |
| 2026-03-24 | Ajuste de autoacomodo V-067: etiquetas pasan a centrado vertical dentro de cada barra y el chart incrementa ancho mínimo por barra según zoom para preservar legibilidad (con scroll horizontal cuando aplica). |
| 2026-03-24 | Ajuste UX V-067 solicitado por usuario: se reemplaza toggle único por dos selectores (`Ver %` y `Ver #`) y layout automático de etiquetas horizontal/vertical según ancho disponible y zoom. |
| 2026-03-24 | Mejora UX Rolo: se agrega filtro flotante expandible/contraíble en `rolo-cartera` para cambiar rápidamente mes de cierre y año de contrato sin volver al bloque superior de filtros. |
| 2026-03-24 | Ajuste UX Rolo solicitado por usuario: filtro flotante movido al lateral derecho tipo pestaña vertical (fijo al scroll) y formulario interno en disposición vertical para Mes/Año. |
| 2026-03-24 | Ajuste UX Rolo solicitado por usuario: se agrega botón/handle de arrastre para mover libremente el panel flotante en pantalla (posición fija al soltar, acompañando el scroll). |
| 2026-03-24 | Fix UX Rolo: drag del panel flotante migrado a pointer events (mouse/touch) y corrección de estilo al arrastrar (`bottom:auto`) para evitar que quede anclado en la mitad en viewport angosto. |
| 2026-03-24 | Fix estructural UX Rolo: panel flotante renderizado por `portal` en `document.body` para eliminar límites de arrastre impuestos por contenedores del layout y permitir movimiento completo en pantalla. |
