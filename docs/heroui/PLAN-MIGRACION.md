# Plan de migración incremental a HeroUI (EPEM frontend)

**Versión:** 2.3 — **Fase 5 cerrada** (2026-03-28)  
**Estado:** activo — ir marcando checkboxes al cerrar entregas.  
**Cambios 1.1:** Fase 1 ampliada a menús **Dropdown**; Fase 2 a **Select** / **ComboBox** / multi-select; inventario de primitivos pendientes.  
**Cambios 1.2:** Primera ejecución Fase 1 en código (`DomButton`, migración de `<button>` en alcance acordado).  
**Cambios 1.3:** **Dropdown** HeroUI en Config → Importaciones (atajos de dominios; acciones del log: exportar TXT + copiar portapapeles).  
**Cambios 1.4:** **`StringSelect`** en Config + Cohorte cobranzas (sustituye `<select>`).  
**Cambios 2.0 (cierre Fase 2):** **`TextField`** + **`Input`** (login, Config formularios texto); **`SearchField`** en **`MultiSelectFilter`**; **`Checkbox`** HeroUI (Cartera / Rendimiento). Matrices de checkboxes en Config siguen nativas.  
**Cambios 3.0 (cierre Fase 3):** **`Toast.Provider`** en `providers.tsx` (`placement="bottom end"`); notificaciones globales vía **`toast`** imperativo de HeroUI; wrapper **`pushAppToast`** (`frontend/src/shared/pushAppToast.ts`) con tipos `success` / `info` / `error` → `danger` y **`timeout` 3500 ms** (paridad con el antiguo `ToastStack`). Eliminado componente custom **`ToastStack`** y CSS `.toast-*` asociado. **`Alert`** HeroUI no adoptado aún: errores de página siguen en **`ErrorState`** / inline según módulo.  
**Cambios 4.0 (cierre Fase 4):** Spike **`Table`** HeroUI en **Resumen de brokers** (`BrokersSummaryTable` + `BrokersView` dentro de `.table-wrap--brokers-summary`). Decisión documentada abajo (**híbrido**): no migración masiva del resto de tablas analytics en este entregable.  
**Cambios 5.1:** Filtro **unidad de negocio (UN)** unificado con **`Button`** HeroUI (`UnidadNegocioTagFilter`): multi-selección con **`variant="primary"`** al estar activo y **`outline`** en reposo, **`aria-pressed`**, **`Label`** + **`Description`**; sin pulsaciones = todas las UN. Vistas: Cartera, Análisis cartera, Cohorte cobranzas, Rendimiento, Anuales, Rolo cartera, Brokers. Referencia: [Button](https://heroui.com/docs/react/components/button).

**Cambios 5.0 (cierre Fase 5):** Menú móvil (**≤1024px**) como **drawer equivalente**: panel lateral fijo + **`.sidebar-overlay`** visible (sin empujar `app-shell`). Confirmaciones destructivas con **`AlertDialog`** + `isOpen` / `onOpenChange` (`useOverlayState`) en **Config** (parada emergencia, borrar programación) y **Brokers** comisiones/premios. **`Tooltip`** en **App** (tema L/O, pills sync/programación) y botón menú en **`SidebarNav`**. El paquete **beta** no exporta **`Drawer`**; patrón documentado en README.  
**Canónico asociado:** `docs/heroui/README.md`

## Objetivo

Unificar progresivamente **botones, menús desplegable (dropdown), selects/combos, formularios, feedback y overlays** (y después tablas/navegación donde aplique) sobre **`@heroui/react`**, sin romper:

- `docs/spec-canon-patrones-ui-analytics.md`
- `desacople.md`
- Temas (`themePresets` + variables CSS)
- Contratos de datos y rutas v2 (`AGENTS.md`)

## No objetivos (explícito)

- Reescribir de golpe todas las vistas.
- Sustituir **SegmentedControl** nativo sin decisión de producto + actualización del spec.
- Eliminar tokens/CSS propios del analytics: HeroUI **coexiste** con `globals.css` / `index.css`.

## Inventario actual (referencia rápida)

Imports frecuentes hoy: `Button`, `Input`, `Label`, `TextField`, `SearchField`, `Checkbox`, `Card`, `Modal`, `AlertDialog`, `Tooltip`, `Tabs`, `Dropdown`, `Skeleton`, `Spinner`, `Text`, `Popover`, `RouterProvider`, `Toast`, `useOverlayState`, **`Button`** + **`Description`** (filtro UN vía **`UnidadNegocioTagFilter`**); **`StringSelect`** en `frontend/src/components/filters/StringSelect.tsx`.

**Post–Fase 2:** Valorar **`ComboBox`** si algún filtro necesita teclear para acotar listas muy largas (además de la búsqueda ya integrada en `MultiSelectFilter` vía `SearchField`).

Áreas mayormente **fuera** de HeroUI o **híbridas**: tablas HTML densas (salvo pilotos como brokers resumen), charts, sidebar/shell, `SegmentedControl`, parte de filtros compuestos (hasta migración explícita de la capa UI).

---

## Fase 0 — Baseline y disciplina

**Meta:** Dejar claro el contrato para todo PR de UI.

- [x] Carpeta `docs/heroui` canónica (`README.md` + este plan).
- [ ] En cada PR que toque UI: citar en descripción si aplica **fase N** o solo fix puntual.
- [x] Mantener `npm run typecheck` y `npm run test:run` en verde (2026-03-28); mocks Vitest actualizados con `Popover` compuesto donde hacía falta.

**Criterio de hecho:** `AGENTS.md` y spec analytics enlazan a `docs/heroui/README.md`.

---

## Fase 1 — Botones, menús desplegable y acciones en barra

**Meta:** Reducir `<button>`/clases sueltas donde ya exista `Button` de HeroUI; introducir **`Dropdown`** donde hoy hay “botón + menú” improvisado (`details/summary`, divs posicionados, `<select>` usado como menú de acciones).

**Alcance sugerido (orden):**

1. [x] `components/feedback/*` — `ErrorState` en HeroUI; toasts globales vía **`Toast.Provider`** + `pushAppToast` (Fase 3); `EmptyState` sin botones.
2. [x] `components/filters/*` — barra masiva de `MultiSelectFilter` → `Button` HeroUI; **sin** tocar opciones `role="option"` ni `SegmentedControl`.
3. [x] Menús de acciones con **`Dropdown`** (primer bloque: `ConfigView` importaciones — dominios rápidos; log de importación — exportar / copiar). *Pendiente:* otros módulos si suman “Más opciones” en toolbar.
4. [x] Primer lote: `App.tsx` (header), `FloatingQuickFilters` (arrastre), leyendas en `AnalisisCarteraView` / `RendimientoStyleCountBarChart`, tarjetas de tema y tabs duplicados en `ConfigView`.

**Criterio de hecho:** En el alcance, no quedan `<button>` sueltos salvo justificación documentada; **menús de acciones** no están implementados con HTML/CSS ad hoc si `Dropdown` cubre el caso.

**Riesgo:** Bajo–medio (z-index con tablas y sidebar, cierre al hacer clic fuera). Probar tema claro/oscuro.

---

## Fase 2 — Formularios, selects y campos

**Meta:** Formularios de login, config, brokers y **filtros por lista** hacia primitivos v3: `TextField`, `NumberField`, **`Select`**, **`ComboBox`** donde aplique, según API del `beta` instalado.

**Pasos:**

1. [x] **`TextField`** como contenedor canónico donde aplica (login, Config texto); `Input` + `Label` dentro; sin audit exhaustivo de cada vista analytics que ya usaba solo `MultiSelect`/`Segmented`.
2. [x] **`<select>` nativo** sustituido por **`StringSelect`** (Config, Cohorte). *Futuro:* `ComboBox` solo si negocio lo pide.
3. [x] **`MultiSelectFilter`:** disparador **`Button`** HeroUI (ya estaba); panel: búsqueda con **`SearchField`** + bulk **`Button`**; opciones **`role="option"`** nativas (multi-selección + teclado custom) — alinear todo el listbox a `ListBox` HeroUI quedó **fuera de alcance** (riesgo de regresión); revisión en Fase 4 u hilo aparte si el spec lo exige.
4. [x] **Login:** `TextField` + `Label` + `Input`. **Brokers:** sin campos de texto libre; filtros vía `MultiSelectFilter` / `ViaSegmentedOrMulti` ya sobre primitivos HeroUI acordes al spec.
5. [x] **Búsqueda en multi-select:** `SearchField` HeroUI. Toggles “Monto detallado” / “Mostrar números en gráficos”: `Checkbox` HeroUI.

**Criterio de hecho:** Módulos objetivo sin inputs ni listas de valor “a mano” sin razón documentada; selects de datos alineados a HeroUI salvo excepción en Bloqueos.

**Riesgo:** Medio (validación, estados de error, listas async). Incluir pruebas manuales o e2e en login/config y un flujo con filtro por UN o mes.

---

## Fase 3 — Feedback global (toast / alertas)

**Meta:** Evaluar **Toast** y **Alert** de HeroUI frente a `ToastStack` custom.

1. [x] Diseño: API única **`pushAppToast`** (`success` | `info` | `error`) → delega en **`toast.success` / `toast.info` / `toast.danger`**; errores de carga de página siguen en **`ErrorState`** y mensajes de sync en **header pills** (sin duplicar en toast salvo evolución explícita).
2. [x] Migración incremental: wrapper **`frontend/src/shared/pushAppToast.ts`** + **`<Toast.Provider />`** en **`AuthProvider`** (`placement="bottom end"`).
3. [x] Retirado el stack custom y estilos `.toast-*`; no se unificaron aún header-pill vs toast (fuera de alcance de esta fase).

**Decisión (2026-03-28):** **Híbrido.** Toast **HeroUI** para avisos transitorios (p. ej. filtros aplicados / errores de summary en Cartera). **No** sustituir por toast los estados persistentes de error de página ni el feedback de jobs en header: distinto semántica y duración. **`Alert`** no incorporado de forma transversal; valorar por módulo en fases posteriores.

**Criterio de hecho:** ~~Documentar en este archivo la decisión (HeroUI puro vs. híbrido) y actualizar spec si cambia el patrón visual.~~ Hecho. El spec analytics no exigía toasts sticky en el panel; el nuevo patrón es región fija inferior-derecha (portal HeroUI).

**Riesgo:** Medio (timing, portales, z-index con sidebar).

---

## Fase 4 — Tablas de datos

**Meta:** Decisión técnica documentada: **mantener tablas HTML** optimizadas vs. migrar a **`Table` HeroUI** (virtualización, selección).

1. [x] Spike en vista piloto **Brokers → Resumen de brokers** (`frontend/src/components/tables/BrokersSummaryTable.tsx`): solo lectura, columnas fijas, scroll horizontal vía **`Table.ScrollContainer`** + `min-w` en **`Table.Content`** (misma idea que el spec: tablas anchas con scroll en desktop).
2. [x] Revisión **1366×768 / densidad:** el contenedor sigue siendo **`.table-wrap`** (borde, tipografía compacta heredada sobre `th`/`td`); la región HeroUI **`variant="secondary"`** evita doble “card” de **`primary`**. Sin virtualización: volúmenes actuales de filas por API no justifican complejidad; reevaluar si algún endpoint entrega miles de filas visibles a la vez.
3. [x] Decisión: **híbrido** (ver sección “Decisión tablas”). **No** migrar en bloque Cartera (columnas dinámicas por mes de gestión), Cohorte/Anuales (tablas muy anchas + reglas CSS propias), ni tablas **editables** (comisiones/premios con inputs en celdas) sin spike aparte.

**Criterio de hecho:** Sección “Decisión tablas” actualizada abajo con fecha y referencia a código piloto.

**Riesgo:** Alto (regresión de UX y performance).

---

## Fase 5 — Navegación y overlays móviles

**Meta:** Mejorar shell móvil y consistencia de overlays.

1. [x] **Drawer equivalente** (`@heroui/react` **beta** sin componente `Drawer`): a **`max-width: 1024px`**, menú lateral con **transform** + **overlay** visible (`index.css`); **`app-shell`** ya no se desplaza; clic en overlay cierra. Desktop **`min-width: 1025px`** sin cambio de interacción (overlay sigue oculto).
2. [x] **AlertDialog** para confirmaciones **destructivas** (backdrop no dismissable por defecto, `role="alertdialog"`): **`ConfigView`** (parada emergencia con icono `warning`, eliminar programación `danger`), **`BrokersCommissionsView`** / **`BrokersPrizesView`** (eliminar regla). **`Modal`** se mantiene para otros usos si reaparecen.
3. [x] **`Tooltip`** HeroUI: **`SidebarNav`** (menú hamburguesa), **`App.tsx`** (tema L/O, pills de programación y sync con detalle en contenido).

**Pantallas / archivos tocados:** `index.css`, `SidebarNav.tsx`, `App.tsx`, `ConfigView.tsx`, `BrokersCommissionsView.tsx`, `BrokersPrizesView.tsx`.

**Criterio de hecho:** Lista arriba + **prueba manual** recomendada: viewport ≤1024px (abrir/cerrar menú, overlay, Escape), y abrir cada **AlertDialog** en Config / brokers.

**Riesgo:** Medio (foco, scroll lock).

---

## Seguimiento

| Fase | Responsable sugerido | Última actualización | Notas |
|------|----------------------|----------------------|--------|
| 0 | Equipo | 2026-03-28 | Docs creados |
| 1 | Equipo | 2026-03-28 | Sprint 1: `DomButton` + `<button>`; Sprint 2: `Dropdown` en Config importaciones/log |
| 2 | Equipo | 2026-03-28 | **Cerrada:** `StringSelect`, `TextField`/`Input`, `SearchField` en multi, `Checkbox` toggles |
| 3 | Equipo | 2026-03-28 | **Cerrada:** `Toast.Provider`, `pushAppToast`, Cartera sin `ToastStack` |
| 4 | Equipo | 2026-03-28 | **Cerrada:** spike `Table` en brokers; decisión híbrida documentada |
| 5 | Equipo | 2026-03-28 | **Cerrada:** drawer móvil + overlay; `AlertDialog`; `Tooltip` header/menú |

## Bloqueos

*(Añadir filas: fecha, descripción, enlace issue/PR, workaround.)*

| Fecha | Bloqueo | Workaround |
|-------|---------|------------|
| — | — | — |

## Decisión tablas (Fase 4)

- **Decisión:** **Híbrido.**  
  - **HeroUI `Table`** (`variant="secondary"`) para tablas de **solo lectura** con columnas **estables** y sin lógica de edición en celda; primer caso: **Resumen de brokers** (`BrokersSummaryTable`).  
  - **Mantener `<table>` HTML** + `.table-wrap` donde haya **columnas dinámicas** (p. ej. pivot por mes en **Cartera**), **pies de tabla / reglas CSS** dedicadas (Cohorte resumen, Anuales), o **celdas con formularios** (comisiones, premios).  
  - **Virtualización / selección masiva:** no requerida hoy; usar APIs HeroUI/RAC cuando un módulo lo exija explícitamente.
- **Fecha:** 2026-03-28  
- **PR / evidencia:** `frontend/src/components/tables/BrokersSummaryTable.tsx`, `frontend/src/modules/brokers/BrokersView.tsx`, `index.css` (`.table-wrap--brokers-summary`), esta sección.
