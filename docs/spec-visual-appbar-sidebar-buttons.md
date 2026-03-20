# Spec visual — App bar, Sidebar y Botones

**Origen:** Subtarea 2 del PLAN.md (ui-designer).  
**Objetivo:** Especificación concreta para que el frontend implemente consistencia HeroUI en header, menú lateral y botones, con tokens del sistema y accesibilidad.

---

## 1. App bar (header)

### 1.1 Estructura y bloques

- **Dos bloques lógicos** con separación clara:
  1. **Bloque izquierdo:** Navegación (toggle sidebar) + título de la aplicación.
  2. **Bloque derecho:** Estado (pills sync/schedule) + usuario (rol) + acciones (tema, cerrar sesión).

- **Gap entre bloques:** `gap-4` (16px) entre el bloque izquierdo y el derecho.
- **Gap interno del bloque izquierdo:** `gap-3` (12px) entre toggle y título.
- **Gap interno del bloque derecho:** `gap-4` entre el grupo “Estado” y el grupo “Usuario y acciones”; dentro de “Usuario y acciones”, `gap-3`.
- **Separador:** Entre “Estado” y “Usuario y acciones” usar un divisor vertical sutil (`h-4 w-px bg-[var(--glass-border)]`) solo cuando haya al menos un pill visible (sync o schedule).

### 1.2 Título

- **Contraste AA (≥ 4.5:1) en modo claro:** El título debe usar **color sólido**, no gradiente, en `data-theme="light"`.
  - En `globals.css` ya existe la regla `:root[data-theme="light"] .dashboard-header h1` con `color: var(--color-primary)` y `background: none`. Mantenerla.
- **Modo oscuro:** Se puede mantener gradiente (`bg-gradient-to-r from-[var(--color-primary)] to-indigo-400 bg-clip-text text-transparent`) siempre que el contraste sea suficiente.
- **Tipografía:** `text-lg font-bold` en móvil, `xl:text-xl` en desktop. Escala de tokens: alineado a `--text-heading` / `--text-display` según criterio del sistema.

### 1.3 Pills (sync / schedule)

- **Clases semánticas obligatorias:** Usar solo las clases definidas en `globals.css`:
  - `.header-pill` (base)
  - `.header-pill--ok` → estado OK / completado (success)
  - `.header-pill--warn` → advertencia / desfasado (warning)
  - `.header-pill--error` → error (danger)
  - `.header-pill--info` → informativo / sincronizando (info)

- **Paleta:** Las clases deben consumir **únicamente** las variables del sistema ya definidas en `globals.css` para dark/light (`--success`, `--color-state-warn`, `--color-error`, `--color-state-info`). No introducir colores inline ni nuevas variables.
- **Comportamiento:** Siguen siendo enlaces (`<Link href="...">`) con `title` descriptivo para accesibilidad.

### 1.4 Botón de tema

- **Ícono:** Siempre **SVG o componente HeroUI**, nunca emoji (☀️/🌙).
- **Implementación actual:** El componente `ThemeIcon` con SVG (sol/luna) en `DashboardLayout.tsx` cumple la spec. Mantener.
- **Botón HeroUI:** `<Button isIconOnly variant="ghost" size="sm">` con `aria-label` descriptivo: “Cambiar a modo claro” / “Cambiar a modo oscuro”.
- **Área de toque:** `min-h-[var(--touch-min)] min-w-[var(--touch-min)]` (44px).

### 1.5 Toggle del sidebar

- **Ícono:** Usar **SVG o ícono HeroUI** en lugar de caracteres “◀” y “☰”.
  - Sugerencia: ícono de “menú” (hamburger) para abrir y “chevron left” o “X” para cerrar, o el ícono que exponga HeroUI para “toggle sidebar”.
- **Botón:** `<Button isIconOnly variant="bordered" ...>` (o `variant="outline"` si HeroUI no tiene `bordered`), `size="md"`, `aria-label`, `aria-expanded`, `data-testid="sidebar-toggle"`.

### 1.6 Cerrar sesión

- **Variante:** Secundaria. Usar `variant="bordered"` o `variant="ghost"` (alineado al resto de acciones secundarias del header). Si actualmente está `variant="secondary"`, comprobar que HeroUI lo traduce a un estilo coherente con “secundario”.
- **Tamaño:** `size="sm"`.
- **Área de toque:** `min-h-[var(--touch-min)]`.

### 1.7 Token de altura

- **Variable:** `--header-height` ya existe en `globals.css` (2.5rem). El `<header>` debe usar `h-[var(--header-height)]` y el contenido principal `pt-[var(--header-height)]`. No duplicar con `min-h-16` u otros valores; unificar en `--header-height`.

---

## 2. Sidebar (menú)

### 2.1 Íconos de navegación

- **Tipo:** Íconos **gráficos** (HeroUI o SVG), nunca siglas de texto (“AC”, “AA”, “Rend.”, etc.).
- **Tamaño:** ~20px (por ejemplo `width={20} height={20}` en SVG o clase `w-5 h-5`). El contenedor `.dashboard-sidebar-link-icon` puede seguir en 28px con el ícono centrado a 20px.
- **Semántica por ítem (referencia):**
  - Análisis de Cartera → gráfico / cuadrícula / dashboard.
  - Análisis Anuales → calendario.
  - Rendimiento de Cartera → tendencia / gráfico de línea.
  - Análisis Cobranzas Corte → cohorte / personas.
  - Configuración → engranaje / settings.
- **Color:** Heredado del enlace; en estado activo usar `var(--color-primary)` en el ícono.

### 2.2 Transiciones hover / focus

- **Duración:** 100–150 ms para `background-color`, `color`, `border-left-color`.
- **Implementación en CSS:** `transition: background 0.15s ease, color 0.15s ease, border-left-color 0.15s ease` (ya presente en `.dashboard-sidebar-link`). Mantener.
- **Focus visible:** Anillo de foco con `--focus-ring` en `:focus-visible` (outline: none; box-shadow: var(--focus-ring)). Ya definido en `.dashboard-sidebar-link:focus-visible`.

### 2.3 Variable de ancho

- **Variable:** `--sidebar-width: 16rem` ya existe en `globals.css`.
- **Uso:**
  - El `<aside>` del sidebar debe usar `width: var(--sidebar-width)` en desktop (por ejemplo `lg:w-[var(--sidebar-width)]` o clase que resuelva a lo mismo). Actualmente `lg:w-64` (16rem) es equivalente; se puede sustituir por `lg:w-[var(--sidebar-width)]` para unificación.
  - El contenedor de contenido principal debe usar `padding-left: var(--sidebar-width)` cuando el sidebar esté abierto en desktop (por ejemplo `pl-[var(--sidebar-width)]`). Actualmente `pl-64`/`pl-72` en móvil; en desktop unificar a `pl-[var(--sidebar-width)]`.
- **Móvil:** Mantener ancho actual (ej. `w-[85vw] max-w-72`) para el drawer; la variable aplica sobre todo al layout desktop.

### 2.4 Estado activo

- **Indicador visual:** Barra lateral izquierda (`border-left: 3px solid var(--sidebar-active-border)`) y fondo (`background: var(--sidebar-active-bg)`).
- **Atributo:** El `<Link>` del ítem activo debe tener `aria-current="page"`.
- **Clase:** Mantener `.dashboard-sidebar-link.is-active` con los estilos ya definidos en `globals.css`.

### 2.5 Cierre en móvil

- Al hacer clic en un link del menú en viewport móvil, el sidebar se cierra. Comportamiento actual correcto; mantener.

### 2.6 data-testid y landmarks

- **Mantener** `data-testid="nav-rendimiento-cartera"` en el link de “Rendimiento de Cartera”.
- **Nav:** `<nav aria-label="Menú principal">` ya presente; mantener.

---

## 3. Botones y componentes HeroUI

### 3.1 Variantes por tipo de acción

| Tipo de acción   | Variant HeroUI   | Color   | Uso típico                          |
|------------------|------------------|--------|-------------------------------------|
| Principal        | `solid`          | `primary` | Una sola acción principal por contexto (ej. “Aplicar filtros”, “Guardar”) |
| Secundaria       | `bordered` o `ghost` | `default` o `primary` | Acciones secundarias (Cancelar, Cerrar, Ver más) |
| Destructiva      | `solid`          | `danger`  | Eliminar, desactivar, acciones irreversibles |
| Terciaria / icono | `light` o `ghost` | `default` | Icon-only (tema, cerrar menú, etc.) |

- **Regla:** En un mismo grupo de botones (misma barra o mismo modal), **no mezclar** variantes que compitan visualmente (ej. no poner un “solid” y un “flat” sin jerarquía clara). Misma variante para acciones del mismo nivel.

### 3.2 Tamaños

| Contexto              | Size HeroUI | Notas                                      |
|-----------------------|------------|--------------------------------------------|
| Tablas, listas, header (iconos, pills) | `sm`       | Altura ~32px, compacto                     |
| Formularios, modales, barras de acción en páginas | `md`       | Altura ~40px, área de toque cómoda         |
| CTA principal en página (hero)         | `lg`       | Solo si hay una única acción destacada     |

- **Área de toque mínima:** Donde aplique (botones críticos en móvil), asegurar `min-h-[var(--touch-min)]` (44px) y/o `min-w-[var(--touch-min)]` para icon-only.

### 3.3 Resumen por componente del layout

- **Toggle sidebar:** `variant="bordered"` o `"outline"`, `size="md"`, ícono SVG/HeroUI, `data-testid="sidebar-toggle"`.
- **Tema:** `variant="ghost"`, `size="sm"`, ícono SVG (ThemeIcon), `aria-label` según tema actual.
- **Cerrar sesión:** `variant="bordered"` o `variant="ghost"`, `size="sm"`.
- **Cerrar menú (mobile header del sidebar):** `variant="ghost"`, `size="sm"`, ícono (no “✕” de texto; usar SVG o HeroUI).

---

## 4. Archivos a tocar

| Archivo | Cambios principales |
|---------|----------------------|
| `frontend/src/components/layout/DashboardLayout.tsx` | Bloques del header con gap unificado; toggle con ícono SVG/HeroUI; Cerrar sesión con variante secundaria; sidebar con ancho por `--sidebar-width` en desktop; botón cerrar menú con ícono. |
| `frontend/src/app/globals.css` | Confirmar que pills y título usan solo variables del sistema; opcionalmente añadir comentarios que referencien esta spec. Ajustar sidebar/header a `--sidebar-width` / `--header-height` si algo queda hardcodeado. |

**No tocar:** Lógica de negocio, rutas (`routes.ts`, `NAV_ITEMS`), providers, ni backend/tests.

---

## 5. Qué debe mantenerse (no romper)

- **data-testid:** `sidebar-toggle`, `nav-rendimiento-cartera`, y cualquier otro existente (ej. en vistas de análisis).
- **Estructura de `NAV_ITEMS`** y de `groupNavItems()`: solo cambios visuales (íconos, clases), no cambios de rutas ni ids.
- **Atributos de accesibilidad ya presentes:** `aria-label`, `aria-expanded`, `aria-current="page"`, `aria-label="Menú principal"` en `<nav>`, `role="group"` y `aria-label` en los grupos del header.
- **Variables CSS ya definidas:** `--header-height`, `--sidebar-width`, `--touch-min`, `--focus-ring`, `--color-primary`, y las usadas por `.header-pill--*`.

---

## 6. Estados visuales (donde aplique)

- **Header/Sidebar:** No tienen estado “loading” o “vacío” crítico; el header puede mostrar “Cargando…” si la sesión está resolviéndose (ya manejado en el layout).
- **Botones:** Estados nativos de HeroUI (hover, focus, disabled, loading). Para botones que disparan acciones async (ej. “Aplicar filtros”), usar el prop `isLoading` de HeroUI cuando corresponda en lugar de deshabilitar sin feedback.

---

## 7. Accesibilidad (checklist)

- **Header:** Orden de tabulación lógico: toggle → título (si es focusable) → pills → tema → cerrar sesión.
- **Landmarks:** `<header>` para app bar, `<nav aria-label="Menú principal">` para el menú, `<main>` para el contenido.
- **Contraste:** Título en modo claro con color sólido (AA). Pills con colores del sistema; revisar ratio texto/fondo en light/dark.
- **Focus:** Anillo visible con `--focus-ring` en todos los controles (sidebar links ya lo tienen).
- **Labels:** Todo botón de ícono con `aria-label` descriptivo; pills con `title` o texto visible que describa el estado.

---

## 8. Referencias

- **Tokens y paleta:** `docs/design-tokens.md` y `frontend/src/app/globals.css` (`:root`, `:root[data-theme="light"]`).
- **Sugerencias detalladas:** `docs/sugerencias-ui-designer.md`.
- **Reglas de negocio y UX:** `AGENTS.md` y `.cursor/rules/agent-frontend-heroui.mdc`.
