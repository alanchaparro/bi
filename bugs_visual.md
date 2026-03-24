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
- **V-075 (Abierto | Alta):** `app/login/page.tsx` muestra error como texto plano (`<p className="text-sm text-[var(--color-error)]">`) en vez de patrón canónico de estado (`ErrorState` o equivalente de bloque).  
  **Impacto:** feedback de error menos visible/consistente en una pantalla crítica de acceso.  
  **Fix mínimo sugerido:** reutilizar `LoginView` o migrar el bloque de error a componente de estado visual consistente con el resto del frontend.
- **V-076 (Abierto | Alta):** `BrokersView` usa fila de tabla para vacío con copy técnico (`analytics_contract_snapshot`, validación de supervisores) y mezcla semántica con error.  
  **Impacto:** confunde al cliente operativo y rompe jerarquía visual de estados.  
  **Fix mínimo sugerido:** mantener error en `ErrorState` y vacío en `EmptyState` con lenguaje de negocio (sin nombres de tablas internas).
- **V-077 (Abierto | Media):** `SidebarNav` legacy usa glifos abreviados (`[]`, `AC`, `BM`, etc.) y menú hamburguesa como carácter `☰`.  
  **Impacto:** iconografía poco semántica y percepción visual menos profesional frente a shell Next.  
  **Fix mínimo sugerido:** reemplazar por iconos SVG o set de iconos consistente con labels legibles.
- **V-078 (Abierto | Media):** pantallas base de carga usan texto plano (`DashboardLayout` y `app/page.tsx`) sin `LoadingState` canónico.  
  **Impacto:** inconsistencia visual en el primer contacto (arranque/autenticación).  
  **Fix mínimo sugerido:** unificar a `LoadingState` con copy corto y patrón visual consistente.
- **V-079 (Abierto | Media):** objetivos táctiles menores al mínimo canónico (`--touch-min: 44px`) en controles frecuentes (`dashboard-sidebar-sublink` 36px, `theme-toggle` 38px, `multi-select-trigger` 42px).  
  **Impacto:** menor usabilidad táctil y más errores de interacción en operación.  
  **Fix mínimo sugerido:** normalizar alturas/tamaño a `>=44px` en esos controles.
- **V-080 (Abierto | Media):** `BrokersSupervisorsView` no muestra estado vacío cuando no hay supervisores disponibles; queda panel sin contexto.  
  **Impacto:** pantalla “en blanco” que genera duda operativa.  
  **Fix mínimo sugerido:** agregar `EmptyState` con mensaje y acción sugerida.
- **V-081 (Abierto | Baja):** `DashboardLayout` mantiene copy sin tildes en navegación/cabecera (`Menu`, `Navegacion`, `sincronizacion`, `menu lateral`).  
  **Impacto:** detalle de calidad percibida en UI principal.  
  **Fix mínimo sugerido:** corregir a `Menú`, `Navegación`, `sincronización`, `menú`.
- **V-082 (Abierto | Baja):** `MultiSelectFilter` usa caret textual (`^`/`v`) en lugar de icono visual consistente.  
  **Impacto:** se percibe como placeholder/legacy frente al resto de componentes pulidos.  
  **Fix mínimo sugerido:** reemplazar por chevron SVG o icono del sistema UI.
- **V-083 (Abierto | Baja):** `AnalisisAnualesView` muestra `EmptyState` sin `suggestion` accionable.  
  **Impacto:** vacío correcto pero poco guiado para usuario operativo.  
  **Fix mínimo sugerido:** incluir sugerencia breve de ajuste de filtros/período.
- **V-084 (Abierto | Baja):** `ConfigView` mantiene textos sin tilde en sección sensible (`conexion`, `Comprobar conexion`, `Sin conexion`).  
  **Impacto:** inconsistencia de copy en una pantalla operativa crítica.  
  **Fix mínimo sugerido:** normalizar ortografía (`conexión`) en labels, botones y estados.
- **V-085 (Abierto | Baja):** píldoras de estado de cabecera (`.header-pill`) tienen `min-height: 2rem`, por debajo del objetivo táctil móvil.  
  **Impacto:** target reducido para interacción rápida en anchos chicos.  
  **Fix mínimo sugerido:** elevar `min-height`/padding en móvil para cumplir objetivo táctil.

### Aperturas de esta pasada
- **V-075 (Abierto):** login Next sin bloque de error canónico.
- **V-076 (Abierto):** vacío técnico/confuso en `BrokersView`.
- **V-077 (Abierto):** iconografía legacy poco semántica en `SidebarNav`.
- **V-078 (Abierto):** cargas base con texto plano, sin `LoadingState`.
- **V-079 (Abierto):** targets táctiles por debajo de `44px` en controles clave.
- **V-080 (Abierto):** falta `EmptyState` en `BrokersSupervisorsView` sin opciones.
- **V-081 (Abierto):** copy sin tildes en cabecera/layout Next.
- **V-082 (Abierto):** caret textual en `MultiSelectFilter`.
- **V-083 (Abierto):** `EmptyState` sin sugerencia en `AnalisisAnualesView`.
- **V-084 (Abierto):** ortografía inconsistente en textos de conexión (`ConfigView`).
- **V-085 (Abierto):** píldoras de header con target táctil bajo.

### Cierres de esta pasada
- **V-068 (Cerrado):** `LoginView` migra feedback de error a `ErrorState` y elimina uso de `alert-error` en login legacy.
- **V-069 (Cerrado):** indicador de programación en cabecera migra de glifo ambiguo `"P"` a copy explícito `"Prog."`.
- **V-070 (Cerrado):** appbar principal deja de clippear contenido al relajar `overflow` y `white-space` con wrap controlado en acciones.
- **V-071 (Cerrado):** `ConfigView` unifica botones de acciones al sistema `Button` de HeroUI, eliminando mezcla con `btn btn-*` en flujo operativo.
- **V-072 (Cerrado):** `CarteraView` y `BrokersMoraView` migran vacíos a `EmptyState` canónico con mensaje + sugerencia.
- **V-073 (Cerrado):** CTA de sesión corrige copy a `"Cerrar sesión"` en shell Next.
- **V-074 (Cerrado):** shell legacy `App.tsx` alinea feedback a `ErrorState` y retira toggle con emoji para reducir drift visual frente a shell Next.
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
| 2026-03-24 | Auditoría visual estricta de segunda pasada: se abren V-075 a V-085 (feedback canónico en login, copy/empty state en brokers, iconografía/cargas legacy, targets táctiles <44px, consistencia de microcopy y accesibilidad táctil en header/filtros). |
| 2026-03-24 | Verificación de continuidad (dev): barrido visual/UX sin reaperturas V-*; se mantiene backlog visual en cero y sin drift frente a `bugs.md`. |
| 2026-03-24 | Dev/verifica: V-068 a V-074 pasan a **Cerrado** tras normalizar feedback login/shell (`ErrorState`), copy de programación/sesión, clipping de appbar, unificación de botones en `ConfigView` y estados vacíos canónicos en cartera/mora. |
| 2026-03-24 | Auditoría visual completa (`audit`) sobre vistas y layout: se abren V-068 a V-074 por inconsistencias de feedback/login legacy, semántica de header, riesgo de clipping, mezcla de sistemas de botones, estados vacíos no canónicos y drift visual entre shell legacy/Next. |
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
