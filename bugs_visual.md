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
- Ninguno.

### V-096 — Badge «Analytics v2» en Cartera vs expectativa de corte v2 unificado
- **Estado:** Cerrado
- **Impacto:** Media
- **Área:** `frontend/src/modules/cartera/CarteraView.tsx`
- **Tipo:** drift legacy | implementación frontend | flujo de uso
- **Descripción:** La cabecera muestra **pill** «Analytics v2» pero la pantalla no está alineada al mismo contrato visual/semántico que el resto de analytics v2 (p. ej. **Análisis cartera** con cierre/gestión explícitos). Refuerza desconfianza (“¿esto es el mismo reporte?”) sobre todo si filtros o tabla no reflejan el estado operativo esperado.
- **Evidencia:** revisión de código + coherencia con **AUD-2026-03-26-45**; pasos: menú **Cartera** → comparar filtros/encabezado con **Análisis cartera** en el mismo entorno.
- **Canon / referencia:** `desacople.md` §4 (frontend nuevo consume v2 por defecto); `docs/spec-canon-patrones-ui-analytics.md` (jerarquía y lenguaje de filtros).
- **Cierre (2026-03-26):** `CarteraView` migrado a `portfolio-corte-v2`; subtítulo y label **Mes de gestión** / **Vía de cobro** alineados al lenguaje de negocio; remisión explícita a **Análisis cartera** para detalle por contrato. Validación: `npm run typecheck` OK.

### Cierres de esta pasada
- **V-096 (Cerrado):** ver bloque de detalle arriba; pill «Analytics v2» coherente con consumo real de API v2 en Cartera.
- **V-090 (Cerrado):** `DashboardLayout` + `globals.css` compactan shell y devuelven protagonismo al dato (`--header-height: 3.75rem`, `--sidebar-width: 16rem`, menor padding de header/main). La verificación runtime en `1366x768` confirma que el shell ya no domina la pantalla.
- **V-091 (Cerrado):** el header normaliza jerarqu?a de acciones secundarias con HeroUI (`sidebar toggle` y `Cerrar sesi?n` pasan a `outline`).
- **V-091 (Cerrado):** la verificación runtime con capturas Playwright de `/analisis-anuales`, `/analisis-cartera` y `/config` confirma que la composición general ya no está desbordada: headers, filtros, acciones y contención base quedaron suficientemente ordenados para cerrar el hallazgo sistémico de composición.
- **V-092 (Cerrado):** `.analysis-kicker` y `.chart-card` reducen ornamentaci?n y vuelven al canon compartido (kicker 11px sin sombra decorativa; chart cards con `--shadow-card` y superficie m?s sobria).
- **V-092 (Cerrado):** la dirección cromática dark queda cerrada tras unificar tokens de `frontend/src/index.css` y `frontend/src/app/globals.css` y verificar runtime en `frontend/tmp/visual-audit-analisis-anuales.png`: shell, cards, superficies y acentos ya comparten una familia visual suficientemente coherente y más ejecutiva.
- **V-093 (Cerrado):** la verificación runtime final confirma mejora suficiente del lenguaje tabular: encabezados más claros, mejor separación de filas, hover útil y menor percepción de “planilla cruda” en analytics. Se cierra como backlog sistémico, aunque puede seguir refinándose en iteraciones futuras.
- **V-094 (Cerrado):** la verificación runtime a `100%` en `1366x768` confirma que analytics ya no exige bajar el zoom del navegador a ~`70%` para sentirse usable; la densidad desktop quedó dentro de baseline operativo.
- **V-095 (Cerrado):** `Categoría` migra a `SegmentedControl` en `frontend/src/modules/analisisCartera/AnalisisCarteraView.tsx` y `frontend/src/modules/analisisRendimiento/AnalisisRendimientoView.tsx`, alineando el filtro al canon `Todas | Vigente | Moroso` definido por `docs/spec-canon-patrones-ui-analytics.md` y `AGENTS.md`. Validación: `npm.cmd run typecheck` OK.
- **V-088 (Cerrado):** `ConfigView` corrige copy visible del submenú/configuración (`Configuración de negocio`, `Programación`, `Subsecciones de configuración`) y reemplaza `MYSQL_SSL_DISABLED` por lenguaje comprensible para negocio.
- **V-089 (Cerrado):** `AnalisisCobranzasCohorteView` reemplaza cargas parciales en texto plano por `LoadingState` canónico (`Actualizando resultados...`, `Cargando detalle...`).
- **V-086 (Cerrado):** `.table-wrap` recupera scroll horizontal real al separar `overflow-x: auto` de `overflow-y: hidden` y estabilizar gutter en tablas operativas.
- **V-087 (Cerrado):** tablas anchas agregan hint móvil de desplazamiento en `AnalisisAnualesView`, `AnalisisCobranzasCohorteView`, `BrokersView` y `CarteraView`.
- **V-075 (Cerrado):** `app/login/page.tsx` migra el feedback de error a `ErrorState` canónico.
- **V-076 (Cerrado):** `BrokersView` separa error/empty state y elimina copy técnico a favor de lenguaje de negocio.
- **V-077 (Cerrado):** `SidebarNav` reemplaza glifos/carácter hamburguesa por iconografía SVG consistente.
- **V-078 (Cerrado):** `DashboardLayout` y `app/page.tsx` unifican pantallas base de carga con `LoadingState`.
- **V-079 (Cerrado):** controles frecuentes se normalizan a objetivo táctil `>= 44px` (`dashboard-sidebar-sublink`, `theme-toggle`, `multi-select-trigger`, `header-pill`).
- **V-080 (Cerrado):** `BrokersSupervisorsView` incorpora `EmptyState` guiado cuando no hay supervisores.
- **V-081 (Cerrado):** `DashboardLayout` corrige microcopy principal (`Menú`, `Navegación`, `sincronización`, `Cerrar sesión`).
- **V-082 (Cerrado):** `MultiSelectFilter` sustituye caret textual por chevron SVG.
- **V-083 (Cerrado):** `AnalisisAnualesView` agrega `suggestion` accionable al `EmptyState`.
- **V-084 (Cerrado):** `ConfigView` normaliza ortografía sensible de conexión/sincronización/contraseña.
- **V-085 (Cerrado):** `.header-pill` eleva su target táctil al mínimo canónico.
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
| 2026-03-26 | Dev (**ejecutador**): **V-096 Cerrado** tras migración `CarteraView` a v2 y copy/filtros alineados (evidencia: typecheck OK). |
| 2026-03-26 | **Orquesta / audivisual:** apertura **V-096** (pill «Analytics v2» en Cartera vs alineación con flujo/copy de analytics v2); barrido sin `SectionHeader` / `window.confirm` / ids `*Legacy*` en `frontend/src/modules/**`. |
| 2026-03-25 | Dev: consolidación de la sección *Hallazgos visuales activos* (cero ítems abiertos; cierres V-075–V-095 solo en *Cierres de esta pasada*) para eliminar drift con el estado real del código. |
| 2026-03-25 | Auditoría coordinada levanta **V-094** por evidencia de runtime: la app sigue requiriendo zoom ~`70%` para desktop usable. Se agrega ademas el canon operativo `docs/spec-canon-patrones-ui-analytics.md` para fijar reglas de decision visual (por ejemplo, filtros `<= 3` opciones => segmented control) y baseline obligatorio de densidad desktop a `100%` en `1366x768`. |
| 2026-03-25 | Verificaci?n visual con capturas reales del usuario reabre **V-090**, **V-091** y **V-092** y abre **V-093**: el frente sigue percibi?ndose ?junior? por shell pesado, spacing inconsistente, paleta/contraste d?biles y tablas visualmente pobres. Se concluye que hace falta una pasada de redise?o sist?mico, no solo microajustes.
| 2026-03-25 | Auditoría visual estricta contra `manual-ux-ui-reporteria.pdf` + `frontend-visual-standard.md` + specs `spec-titulos-kicker.md`, `spec-visual-appbar-sidebar-buttons.md` y `spec-cards-transicion-filtros.md`: se abren **V-090** por shell sobredimensionado (`--header-height: 4.25rem`, `--sidebar-width: 18rem`, paddings altos), **V-091** por drift de variantes HeroUI en acciones del header (`ghost`/`outline` fuera del patrón secundario esperado) y **V-092** por tokens compartidos fuera de canon (`.analysis-kicker` más ornamental y `.chart-card` dark con shadow propia en vez de ceñirse al estándar compartido). |
| 2026-03-25 | Dev/verifica: **V-090**, **V-091** y **V-092** pasan a **Cerrado** al compactar el shell (`--header-height: 3.75rem`, `--sidebar-width: 16rem`, menor padding de `DashboardLayout`), normalizar variantes HeroUI del header a `outline` y desornamentar tokens compartidos (`.analysis-kicker`, `.chart-card`) para alinearlos con el canon visual. Validación: `npm.cmd run typecheck` OK. |
| 2026-03-25 | Dev/verifica: **V-088** y **V-089** pasan a **Cerrado** al normalizar copy visible de `ConfigView` (`Configuración de negocio`, `Programación`, `Subsecciones de configuración`, `Desactivar SSL de MySQL`) y migrar cargas parciales de `AnalisisCobranzasCohorteView` a `LoadingState` canónico. Validación: `npm.cmd run typecheck` OK. |
| 2026-03-25 | Auditoría visual amplia guiada por `manual-ux-ui-reporteria.pdf` + specs visuales actuales: se abren **V-088** por copy técnico/no canónico visible en `ConfigView` (`Configuracion de negocio`, `Programacion`, `Subsecciones de configuracion`, `MYSQL_SSL_DISABLED`) y **V-089** por estados de carga parciales en texto plano en `AnalisisCobranzasCohorteView` (`Actualizando resultados...`, `Cargando detalle...`). |
| 2026-03-25 | Dev/verifica: **V-086** y **V-087** pasan a **Cerrado** al restaurar scroll horizontal controlado en `.table-wrap` (`overflow-x: auto` + `overflow-y: hidden`) y añadir hints móviles de desplazamiento en tablas anchas. Validación: `npm.cmd run typecheck` OK. |
| 2026-03-25 | Auditoría visual estricta enfocada en móvil y tablas: se abren **V-086** por scroll horizontal bloqueado en `.table-wrap` (`frontend/src/index.css`) y **V-087** por ausencia de hint/alternativa móvil en tablas anchas de `AnalisisAnualesView`, `AnalisisCobranzasCohorteView`, `BrokersView` y `CarteraView`, en tensión con el manual UX/UI local. |
| 2026-03-25 | Dev/verifica: V-075 a V-085 pasan a **Cerrado** tras normalizar feedback login, vacíos guiados, iconografía/sidebar, `LoadingState`, targets táctiles `>=44px`, microcopy con tildes y `EmptyState` accionable. Validación: `npm.cmd run typecheck` OK y `npm.cmd run test:run -- src/components/layout/DashboardLayout.test.tsx src/app/providers.test.tsx` -> `2 passed`. |
| 2026-03-25 | Auditoría visual coordinada: se confirman vigentes V-075 a V-085 en código/CSS activo (`app/login/page.tsx`, `BrokersView`, `SidebarNav`, `DashboardLayout`, `MultiSelectFilter`, `BrokersSupervisorsView`, `AnalisisAnualesView`, `ConfigView`) y no se detectan V-* nuevos fuera de ese backlog abierto. |
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
