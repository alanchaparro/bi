# Sugerencias UI/UX — App bar, menú, secciones y proyecto

Documento de sugerencias desde el rol del **agente ui-designer** (`.cursor/agents/ui-designer.md`), para App bar, menú lateral, secciones de contenido y consistencia en todo el proyecto.

**Estado de implementación (iniciativa hasta producción):** Se implementaron ítems de prioridad alta y media. Ver sección al final.

---

## 1. App bar (header)

### Estado actual
- Header sticky con título "EPEM - Cartera de Cobranzas", toggle de sidebar, pills de sync/schedule, rol de usuario, toggle tema y "Cerrar sesión".
- Clases: `dashboard-header`, estilos en `globals.css` (sombra, borde, blur).

### Sugerencias

| Área | Sugerencia | Prioridad |
|------|------------|-----------|
| **Jerarquía visual** | El título usa `bg-gradient-to-r ... text-transparent`. Asegurar que el contraste cumpla AA (ratio ≥ 4.5:1) en modo claro; si no, usar `color: var(--color-text)` con peso fuerte en lugar de gradiente. | Media |
| **Altura mínima** | Ya existe `--touch-min: 44px` y `xl:min-h-16`. Unificar en token único (ej. `--header-height: 56px` o `3.5rem`) para que el `main` pueda usar `padding-top` o `scroll-margin-top` consistente. | Baja |
| **Pills (sync / schedule)** | Los pills son enlaces con muchos colores inline. Extraer a variables o clases semánticas (`.header-pill--ok`, `.header-pill--warn`, `.header-pill--error`) y alinear con la paleta del sistema (success, warning, danger). | Media |
| **Botón tema** | Usar ícono consistente (HeroUI Icon o SVG) en lugar de emoji (☀️/🌙) para evitar diferencias entre SO y mejor accesibilidad. | Baja |
| **Cerrar sesión** | Mantener `variant="secondary"` y `size="sm"`; asegurar que en móvil no se corte y que el área de toque sea ≥ 44px (`min-h-[var(--touch-min)]` ya aplicado). | Baja |
| **Separación lógica** | Agrupar en dos bloques claros: (1) Navegación + título, (2) Estado (pills) + usuario + acciones. Añadir `gap` consistente (ej. `gap-4`) y, si hace falta, un separador sutil entre "estado" y "usuario". | Media |

---

## 2. Menú (sidebar)

### Estado actual
- Sidebar con clases `dashboard-sidebar`, grupos (`dashboard-sidebar-group`), labels (`dashboard-sidebar-group-label`), links con ícono + texto (`dashboard-sidebar-link`, `dashboard-sidebar-link-icon`, `dashboard-sidebar-link-text`).
- Íconos son siglas de texto ("AC", "AA", "Rend.", "CO", "CF") en lugar de íconos gráficos.

### Sugerencias

| Área | Sugerencia | Prioridad |
|------|------------|-----------|
| **Íconos** | Sustituir siglas por íconos (HeroUI o SVG): gráfico para Análisis de Cartera, calendario para Anuales, tendencia para Rendimiento, cohorte para Cobranzas Corte, engranaje para Config. Misma medida (ej. 20px) y color heredado con acento en activo. | Alta |
| **Grupos** | El grupo "Análisis de Cartera" agrupa 4 ítems; "Sistema" solo Config. Valorar un único grupo "Navegación" o dejar "Análisis" + "Sistema" con el mismo estilo de `dashboard-sidebar-group-label` (tamaño, letter-spacing, color) en todo el proyecto. | Baja |
| **Estado activo** | Ya hay barra lateral (`border-left`) y fondo (`--sidebar-active-bg`). Revisar que el contraste del texto activo sea suficiente y que `aria-current="page"` esté en el `Link` (ya está). | Baja |
| **Hover / focus** | Tener transición corta (100–150ms) en `background-color` y `border-left-color` para feedback inmediato. Asegurar anillo de foco visible (`outline` o `box-shadow` con `--focus-ring`). | Media |
| **Ancho** | `lg:w-64` y `max-w-72` en móvil están bien. Unificar en variable CSS (ej. `--sidebar-width: 16rem`) para que el `pl-64` del contenido coincida y no haya desajustes. | Baja |
| **Overlay móvil** | El overlay `bg-black/50` está bien. Opcional: animar opacidad (150–200ms) al abrir/cerrar para que no sea brusco. | Baja |
| **Cierre en navegación** | Al hacer clic en un link en móvil se cierra el sidebar (ya implementado). Correcto. | — |

---

## 3. Secciones (páginas y bloques)

### 3.1 Encabezados de sección (Analysis / Cohort / Config)

| Área | Sugerencia | Prioridad |
|------|------------|-----------|
| **Kicker** | `.analysis-kicker` (ej. "PANEL EJECUTIVO") está definido; usarlo en todas las vistas de análisis para dar contexto. Misma tipografía (tamaño, weight, letter-spacing) en Cartera, Rendimiento, Anuales y Cohorte. | Media |
| **Título de página** | `.analysis-header h2` / `.section-title.page-title`: unificar tamaño con escala del sistema (ej. `--text-display` o clamp 1.35rem–1.65rem). Una sola clase para "título de página" en todo el app. | Media |
| **Subtítulo** | `.analysis-subtitle`: color `var(--color-text-muted)`, mismo line-height en todas las secciones. | Baja |
| **Config submenu** | `.config-submenu` y `.config-submenu-btn`: alinear con el sistema de botones (tamaño, padding, border-radius). Si son tabs de sección, considerar componente Tabs de HeroUI para consistencia y accesibilidad (roles ARIA). | Media |

### 3.2 Paneles y cards

| Área | Sugerencia | Prioridad |
|------|------------|-----------|
| **Panel de filtros** | `.analysis-panel-card`: ya tiene glass y padding. Revisar que el espaciado entre filtros siga la regla del sistema (gap 16px entre grupos, 8px entre relacionados). | Baja |
| **Cards de gráficos** | `.chart-card-header` y contenedores de gráficos: mismo `border-radius` (ej. `--radius-lg`) y sombra (`--shadow-card`) en todas las vistas. | Media |
| **KPIs** | KPI cards: número grande (3xl/4xl), label arriba (xs, muted), variación abajo. Asegurar fuente mono y `tabular-nums` en todos los números. | Alta |

### 3.3 Filtros y acciones

| Área | Sugerencia | Prioridad |
|------|------------|-----------|
| **Botones de acción** | Ya unificados (Aplicar filtros, Limpiar, Restablecer) con mismo ancho, altura y padding. Mantener esta regla en cualquier nueva barra de acciones. | — |
| **Chips de filtros activos** | Estilo consistente (pill, mismo radius y padding) y botón de quitar con `aria-label` contextual. | Baja |
| **Count de filtros activos** | `.analysis-active-count`: alineado con el resto; no mezclar con botones en tamaño (debe verse como metadata, no como CTA). | Baja |

---

## 4. Proyecto entero

### 4.1 Tokens y sistema de diseño

| Área | Sugerencia | Prioridad |
|------|------------|-----------|
| **Paleta** | `globals.css` y `index.css` definen muchas variables. Documentar en un solo lugar (o en `ui-designer.md`) la paleta canónica: primary, success, warning, danger, default (50–900) y su uso (acciones, estados, fondos). Evitar colores hardcodeados en componentes. | Alta |
| **Tipografía** | Unificar: cuerpo `var(--text-base)`, títulos de sección `var(--text-heading)`, título de página `var(--text-display)`. Números: `font-mono` + `tabular-nums` siempre que sea monto o porcentaje. | Alta |
| **Espaciado** | Regla 8 / 16 / 32 px (relacionados / grupos / secciones). Revisar que `gap` y `padding` de cards, headers y main sigan esta escala. | Media |
| **Radius y sombras** | Usar solo `--radius-sm/md/lg`, `--shadow-card`, `--shadow-panel`, `--shadow-button-hover` salvo excepción justificada. | Media |

### 4.2 Componentes HeroUI

| Área | Sugerencia | Prioridad |
|------|------------|-----------|
| **Botones** | Primario: solid primary. Secundarios: outline o bordered con el mismo tamaño en el mismo grupo. No mezclar variants (ghost + outline en la misma barra solo si hay jerarquía clara). | Media |
| **Inputs y selects** | Mismo `size` y `variant` en todos los filtros de una misma vista. Labels con `.input-label` (o equivalente) con peso y margen definidos. | Media |
| **Tablas** | Compact, striping, números a la derecha con mono y tabular-nums, header sticky en listas largas. Estado vacío con ícono + mensaje + acción sugerida (ya hay EmptyState). | Alta |
| **Estados** | Loading → skeleton (no spinner sobre tabla vacía). Vacío → EmptyState con mensaje contextual. Error → ErrorState con mensaje amigable y "Reintentar". Revisar que todas las vistas de análisis implementen los 4 estados. | Alta |

### 4.3 Animaciones y microinteracciones

| Área | Sugerencia | Prioridad |
|------|------------|-----------|
| **Duración** | Acciones de usuario (clic, hover): 150–300 ms. Animaciones ambientales (pulso de sync): pueden ser 1–3 s. No superar 400 ms en feedback de clic/submit. | Media |
| **Entrada de página** | `.dashboard-page-enter` ya existe. Asegurar que todas las páginas bajo dashboard estén dentro del contenedor que lleva esta clase. | Baja |
| **Transición de datos** | Al filtrar, opacidad o fade corto (150 ms) para no dar sensación de salto. | Baja |

### 4.4 Accesibilidad

| Área | Sugerencia | Prioridad |
|------|------------|-----------|
| **Landmarks** | Header con rol implícito, `<nav>` en sidebar con `aria-label="Menú principal"`, `<main>` para contenido. Revisar que no falte ningún landmark en layout. | Media |
| **Focus** | Anillo de foco visible en todos los controles (variable `--focus-ring`). Orden de tabulación lógico: toggle menú → título → pills → tema → cerrar sesión. | Media |
| **Contraste** | Texto sobre fondos oscuros y claros: ratio ≥ 4.5:1. Pills y badges: revisar contraste de texto sobre fondo de color. | Alta |
| **Labels** | Todo input/select con label asociado (visible o `aria-label`). Botones de ícono con `aria-label` descriptivo. | Alta |

### 4.5 Consistencia entre vistas

| Área | Sugerencia | Prioridad |
|------|------------|-----------|
| **Estructura de página** | Todas las vistas de análisis: Header (kicker + título + subtítulo) → Filtros → Acciones → Chips activos → Resumen/KPIs → Contenido (tablas/gráficos). Mismo orden y mismas clases donde aplique. | Media |
| **Nombres de sección** | Rutas y títulos alineados con `NAV_ITEMS` y con el lenguaje del negocio (AGENTS.md): "Rendimiento de Cartera", "Análisis Anuales", etc. | Baja |
| **Config** | Subsecciones (usuarios, negocio, importaciones, programación) con el mismo patrón de tabs o botones y mismo estilo de contenido (espaciado, cards). | Baja |

---

## 5. Resumen de prioridades

- **Alta:** Íconos del sidebar, KPIs con mono/tabular-nums, estados (loading/vacío/error) en todas las vistas, paleta y tipografía documentadas y usadas, contraste y labels para a11y.
- **Media:** Jerarquía y pills del header, hover/focus del sidebar, kicker y títulos unificados, config submenu tipo Tabs, tokens de espaciado/radius/sombras, botones e inputs HeroUI consistentes, landmarks y foco, estructura de página por vista.
- **Baja:** Token de altura del header, ancho del sidebar en variable, overlay animado, un solo grupo en el menú, animación de entrada y transición de datos.

---

## 6. Próximos pasos sugeridos (estado)

1. **Implementar íconos en el sidebar** — ✅ Hecho (SVG) + `docs/design-tokens.md`.
2. **Auditar estados** — ✅ Hecho. Ver `docs/audit-estados-vistas.md`.
3. **Revisar contraste** — ✅ Título header en modo claro con color sólido; pills con clases semánticas y colores del sistema (design-tokens).
4. **Unificar encabezados** — ✅ Kicker "PANEL EJECUTIVO" en análisis; Config con `AnalyticsPageHeader` kicker "SISTEMA"; misma spec (kicker + título + subtítulo).
5. **Opcional** — ✅ Config con `<Tabs>` HeroUI; pills del header en clases `.header-pill--*`; overlay móvil del sidebar con transición de opacidad (200ms).

Este documento puede usarse como checklist para el agente frontend y como referencia para el ui-designer al dar specs de nuevos componentes o pantallas.

---

## Estado de implementación (post-iniciativa)

| Área | Estado |
|------|--------|
| **Íconos sidebar** | ✅ Sustituidos siglas por SVG (gráfico, calendario, tendencia, cohorte, engranaje). |
| **Paleta y tipografía** | ✅ Documentado en `docs/design-tokens.md`. |
| **KPIs mono/tabular-nums** | ✅ Aplicado en `.kpi-card-value` y celdas `.num` de tablas. |
| **Estados loading/vacío/error** | ✅ Ya presentes en Cartera, Rendimiento, Anuales, Cohorte. |
| **Header pills** | ✅ Clases semánticas `.header-pill--ok`, `--warn`, `--error`, `--info`. |
| **Botón tema** | ✅ Ícono SVG (sol/luna) en lugar de emoji. |
| **Separación header** | ✅ Dos bloques (estado | usuario y acciones) con separador. |
| **Contraste título** | ✅ En modo claro título usa color sólido para AA. |
| **Sidebar hover/focus** | ✅ Transición 150ms y `--focus-ring` en `:focus-visible`. |
| **Tokens** | ✅ `--header-height`, `--sidebar-width` en globals.css. |
| **Config submenu Tabs** | ✅ Sustituido por `<Tabs>` HeroUI (lista de pestañas); contenido condicional se mantiene. |
| **Overlay móvil animado** | ✅ Overlay siempre en DOM con `transition-opacity duration-200` y `opacity-0 pointer-events-none` cuando el menú está cerrado. |
