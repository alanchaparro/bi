# HeroUI — documentación canónica (frontend EPEM)

## Propósito

Esta carpeta es la **fuente de verdad del proyecto** para:

- Qué es HeroUI en nuestro stack y **cómo** deben adoptarlo desarrollos y agentes de IA.
- **Qué archivos** usar como referencia (índice vs. dump completo).
- Cómo se articula con **patrones analytics**, **temas** y **desacople**.

No sustituye a `AGENTS.md` ni a `desacople.md`: **completa** la capa de UI basada en `@heroui/react`.

## Precedencia (orden de lectura obligatoria)

Cuando haya conflicto entre documentos:

1. `AGENTS.md`
2. `desacople.md`
3. `docs/spec-canon-patrones-ui-analytics.md`
4. **Este `README.md`** + `PLAN-MIGRACION.md`
5. Material de apoyo en `archive-md-no-canonico/docs/` (p. ej. `frontend-visual-standard.md`) cuando el spec analytics remite a specs complementarias

Si una regla del **spec analytics** dice explícitamente “usar patrón X” (p. ej. segmented nativo), prevalece hasta que el **plan de migración** marque esa pieza como migrada y el spec se actualice.

## Contenido de esta carpeta

| Archivo | Uso |
|--------|-----|
| `README.md` | **Canónico operativo** (este archivo): reglas de adopción y enlaces. |
| `PLAN-MIGRACION.md` | **Plan de trabajo** por fases: botones, **menús/dropdowns**, formularios (select/combo), feedback, tablas, navegación. |
| `llms.txt` | Índice compacto de **HeroUI v3** (componentes, getting started, migración v2→v3). Ideal para contexto corto en IA. |
| `llms-full.txt` | Documentación **ampliada** exportada para agentes; usar cuando haga falta detalle de API o migración por componente. |

La documentación oficial viva sigue en [heroui.com](https://www.heroui.com/docs/react/getting-started) (versión alineada con el paquete `beta` / v3 del repo).

## Stack en este repositorio

- **`@heroui/react`** y **`@heroui/styles`** (canal `beta` en `frontend/package.json`).
- **Tailwind CSS v4**, **React 19**, **Next.js 15**.
- Estilos globales: `frontend/src/app/globals.css` (`@import "@heroui/styles"`) + tokens propios en `globals.css` / `index.css`.
- Temas operativos: `frontend/src/shared/themePresets.ts` + `data-theme` / variables CSS (no hardcodear skins fuera de tokens salvo excepción documentada).

## Reglas de adopción (obligatorias en nuevos desarrollos)

1. **Controles interactivos nuevos** (botones de acción, inputs de formulario, modales, pestañas, checkboxes en formularios, etc.): **priorizar componentes `@heroui/react`** acordes al caso, siguiendo la API del paquete instalado (v3 / beta).
2. **No introducir** `<button>`, `<input>` o overlays ad hoc **si ya existe** un equivalente estable en HeroUI para el mismo patrón, salvo que el spec canónico lo prohíba o el `PLAN-MIGRACION.md` deje constancia de excepción temporal.
3. **Mantener accesibilidad**: preferir primitivos HeroUI/React Aria frente a divs clicables.
4. **Coherencia visual**: variantes y tamaños alineados a lo ya usado en el módulo vecino o a `docs/spec-canon-patrones-ui-analytics.md`.
5. **Cambios en bloque migrado**: al tocar un archivo que el plan ya marcó como “objetivo HeroUI”, **completar la migración** del patrón en ese PR o documentar bloqueo en `PLAN-MIGRACION.md` (sección Bloqueos).
6. **Tests y mocks**: actualizar `vi.mock('@heroui/react')` solo cuando el contrato del mock deje de reflejar los exports usados.

### `TextField` (formularios)

Composición recomendada por HeroUI v3: **`TextField`** envuelve **`Label`**, **`Input`** (y opcional **`FieldError`**). Usarla en login y formularios de configuración en lugar de `<label>` + `<input>` sueltos.

### `StringSelect` (listas estáticas)

`frontend/src/components/filters/StringSelect.tsx` compone **`Select`** + **`ListBox`** de HeroUI para reemplazar `<select>` con opciones fijas o generadas en cliente (misma semántica, mejor teclado/foco). Incluye **`STRING_SELECT_TRIGGER_ANALYTICS`** para alinear estilos con filtros analytics. Usar **`labelId`** (etiqueta visible) o **`aria-label`** cuando no haya texto visible.

**`MultiSelectFilter`:** disparador **`Button`**; búsqueda interna con **`SearchField`** (icono + limpiar); la lista de opciones multi-seleccionables conserva patrón nativo `role="listbox"`/`role="option"` por compatibilidad con el teclado y el portal existente.

### `DomButton` (tipos beta)

`frontend/src/components/ui/DomButton.tsx` reenvía al `Button` de `@heroui/react` y amplía el tipo con atributos DOM que **React Aria** ya aplica (`title`, `role`, `aria-selected`, `aria-pressed`, hover, `onPointerDown`, etc.) cuando los tipos exportados del paquete beta no los listan. Usar **`DomButton`** en esos casos para no perder tooltips ni roles sin `as any`.

### Toasts globales (`Toast.Provider` + `pushAppToast`)

- **`<Toast.Provider />`** está montado en `frontend/src/app/providers.tsx` (junto a `RouterProvider`), con **`placement="bottom end"`** (API HeroUI v3).
- Para disparar avisos desde cualquier vista cliente, usar **`pushAppToast`** desde `frontend/src/shared/pushAppToast.ts` (`success` | `info` | `error`), que delega en **`toast.*`** de `@heroui/react` con **`timeout` 3500 ms** por defecto.
- No sustituye **`ErrorState`** ni mensajes persistentes en layout; ver decisión híbrida en `PLAN-MIGRACION.md` (Fase 3).

### Tablas (`Table` vs HTML)

- Composición v3: **`Table`** → **`Table.ScrollContainer`** → **`Table.Content`** (`aria-label` obligatorio para a11y) → **`Table.Header`** / **`Table.Column`** / **`Table.Body`** / **`Table.Row`** / **`Table.Cell`**.
- **Cuándo usar HeroUI:** tablas **solo lectura**, columnas **fijas**, sin inputs en celdas; referencia: **`BrokersSummaryTable`** (`frontend/src/components/tables/BrokersSummaryTable.tsx`) dentro de **`.table-wrap--brokers-summary`** para conservar el chrome del spec (scroll horizontal, densidad desktop).
- **Cuándo mantener `<table>` nativo:** pivots (columnas por mes), tablas con reglas CSS muy específicas, o filas editables — ver **Fase 4** en `PLAN-MIGRACION.md`.

### Shell móvil (drawer equivalente)

- En **`@heroui/react` beta** instalado **no** hay **`Drawer`** exportado; el menú lateral en **`≤1024px`** usa **panel fijo** + **`.sidebar-overlay`** (ver `index.css` y `SidebarNav.tsx`).
- Con menú abierto: **`body.sidebar-open`** + scroll bloqueado; cierre por overlay, ítem de navegación o **Escape** (`App.tsx`).

### `AlertDialog` vs `Modal`

- **Confirmaciones destructivas** o de alto impacto (eliminar regla, parada de emergencia): **`AlertDialog`** controlado con **`isOpen`** / **`onOpenChange`** (`useOverlayState`), composición **`AlertDialog.Backdrop`** → **`Container`** → **`Dialog`**, **`Header`** con **`AlertDialog.Icon`** + **`Heading`**.
- **`Modal`** reservado a flujos no destructivos (formularios, detalle) si se reintroducen.

### `Tooltip`

- **`Tooltip`** → **`Tooltip.Trigger`** + **`Tooltip.Content`** (`placement`, `delay` opcionales). Útil en **icon-only** o pills compactas del header; mantener **`aria-label`** en el disparador.

## Patrones: botón, menú desplegable y selección

HeroUI distingue **acciones en menú** de **elección de valor en formulario**. Hay que usar el primitivo correcto y respetar `docs/spec-canon-patrones-ui-analytics.md` (segmented vs select vs multi).

| Necesidad | Primitivo típico (v3) | Notas |
|-----------|------------------------|--------|
| Botón que abre **lista de acciones** (exportar, duplicar, eliminar, “más opciones”) | **`Dropdown`** (+ items de menú según API del paquete) | No usar `<div>` + `position:absolute` ad hoc. Evitar mezclar en el mismo control acciones destructivas sin confirmación (`AlertDialog` / flujo explícito). |
| **Una opción** en contexto de filtro/formulario (lista larga o dinámica) | **`Select`** | Alineado al spec: p. ej. UN, mes, supervisor. |
| **Búsqueda + elección** en listas largas | **`ComboBox`** | Cuando el usuario necesita teclear para acotar. |
| Lista de opciones **sin** el patrón “campo colapsable” clásico | **`ListBox`** (y composición con otros primitivos) | Evaluar caso a caso con a11y y densidad desktop. |
| Contenido rico / formulario mini en capa flotante | **`Popover`** (ya en uso) | No sustituir por Dropdown si la semántica es panel, no menú de acciones. |

**Reglas transversales**

- **Botón + menú** (“dropdown button”): implementar con **`Dropdown`** (disparador + menú), no con un `Button` que togglee HTML suelto.
- **Select nativo** (`<select>`) o listas custom con `onClick` en `<li>`: migrar hacia **`Select` / `ComboBox`** cuando el plan marque el módulo, salvo bloqueo documentado.
- **`MultiSelectFilter`** y similares: mantener el **contrato de datos** del filtro; la capa visual puede ir sustituyéndose por primitivos HeroUI equivalentes cuando existan y el plan lo indique.
- Si el spec exige **segmented** o **multi-select** explícito, **no** sustituir por un único `Select` simple sin actualizar el spec y el plan.

Documentación en repo: `llms.txt` / `llms-full.txt` y [componentes React](https://www.heroui.com/docs/react/getting-started).

## Excepciones conocidas (hasta actualizar spec + plan)

- **`SegmentedControl`** (`frontend/src/components/filters/SegmentedControl.tsx`): patrón **nativo + CSS** explícito en spec analytics para opciones 2–3; **no** sustituir por `ToggleButtonGroup` sin revisión de producto y actualización del spec.
- **Shell / sidebar**: layout propio + **drawer equivalente** en móvil (Fase 5); si HeroUI publica **`Drawer`** estable, valorar sustitución sin romper overlay y z-index.

## Para agentes de IA

1. Leer este `README.md` y el estado actual de `PLAN-MIGRACION.md`.
2. Usar `llms.txt` como mapa; profundizar con `llms-full.txt` o la web oficial si la tarea es migración o API nueva.
3. Tras implementar una fase o sub-bloque del plan, **actualizar `PLAN-MIGRACION.md`** (checklist y notas) en el mismo cambio que el código.

## Contacto con otros canónicos

- Hallazgos de bugs técnicos → `bugs.md` (skill auditor).
- UX/visual → `bugs_visual.md` / `pendientes.md` según reglas del repo.
- Regresiones de negocio → `AGENTS.md` y validaciones de API indicadas allí.
