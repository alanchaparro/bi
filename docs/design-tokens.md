# Design tokens — EPEM Cartera de Cobranzas

Fuente única de referencia para paleta, tipografía, espaciado, bordes y sombras. Todo el frontend debe usar estos tokens; evitar colores o valores hardcodeados en componentes.

---

## Paleta de colores

### Uso por contexto
- **Primary (acento):** Acciones principales, links, estado activo del menú, indicadores de progreso.
- **Success:** Cobrado, recuperado, OK, completado.
- **Warning:** En gestión, riesgo medio, desfasado.
- **Danger:** Castigado, vencido, error, acción destructiva.
- **Default (neutros):** Fondos, bordes, texto secundario, el 80% de la UI.

### Tokens (CSS variables en `frontend/src/app/globals.css`)

| Token | Dark | Light | Uso |
|-------|------|-------|-----|
| `--color-primary` / `--accent-color` | #38bdf8 | #0284c7 | Botones primarios, activo sidebar, acentos |
| `--color-text` / `--text-primary` | #f8fafc | #0f172a | Texto principal |
| `--color-text-muted` / `--text-secondary` | #94a3b8 | #334155 | Subtítulos, labels, metadata |
| `--color-bg` / `--bg-color` | #0f172a | #f0f4f8 | Fondo de página |
| `--card-bg` | rgba(30,41,59,.65) | rgba(255,255,255,.92) | Cards y paneles |
| `--glass-border` | rgba(255,255,255,.08) | rgba(15,23,42,.22) | Bordes sutiles |
| `--success` | #22c55e | #16a34a | Estados OK, cobrado |
| `--color-state-warn` / warning | #f59e0b | #d97706 | Advertencia, desfasado |
| `--color-error` / `--danger` | #ef4444 | #dc2626 | Error, vencido, peligro |
| `--color-state-info` | #38bdf8 | #0284c7 | Info, sincronizando |

### Estados de cartera (semántica)
- **VIGENTE / activo:** `success`
- **MOROSO / en gestión:** `warning`
- **Castigado / vencido:** `danger`
- **Recuperado:** `primary`

### Pills y badges del header (sync/schedule)
- OK: `--success` (fondo suave + borde + texto)
- Warn: `--color-state-warn`
- Error: `--color-error`

---

### Tipografía (EPEM Analytics - Linear Edition)

#### Fuentes
- **Sans:** `var(--font-sans)` → Inter Variable, system-ui, sans-serif (cuerpo y UI).
- **Mono:** Para montos, porcentajes y códigos; usar `font-mono` y `tabular-nums`.
- **OpenType:** `"cv01", "ss03"` para Inter Variable en analytics (geometric alternates).

#### Escala (variables en globals.css)

| Token | Dark (Linear) | Light | Uso |
|-------|---------------|-------|-----|
| `--color-primary` | #10b981 | #16a34a | Botones primarios EPEM (verde emerald) |
| `--accent-color` | #00c573 | #159336 | Links, estado activo, acentos |
| `--color-text` | #f7f8f8 | #0f172a | Texto principal (casi blanco) |
| `--color-text-muted` | #8a8f98 | #334155 | Metadata, placeholder |
| `--color-bg` | #08090a | #ffffff | Fondo de página (dark) |
| `--card-bg` | rgba(255,255,255,0.02) | rgba(255,255,255,.92) | Cards y paneles |
| `--glass-border` | rgba(255,255,255,0.08) | rgba(15,23,42,.22) | Bordes sutiles |
| `--color-state-warn` | #f59e0b | #d97706 | Advertencia, desfasado |
| `--color-error` | #23252a | #dc2626 | Error, vencido, peligro |
| `--color-state-info` | rgba(255,255,255,0.05) | #38bdf8 | Info, sincronizando |
| `--color-success` | #10b981 | #22c55e | OK, cobrado, completado |
| `--color-secondary-text` | #d0d6e0 | #475569 | Body text, descripción |
| `--color-tertiary-text` | #62666d | #64748b | Timestamps, disabled |
| `--color-border-subtle` | rgba(255,255,255,0.05) | rgba(15,23,42,.12) | Bordes ultra sutiles |
| `--color-border-standard` | rgba(255,255,255,0.08) | rgba(15,23,42,.32) | Bordes estándar |
| `--color-panel-bg` | #0f1011 | #f3f4f5 | Sidebar, panels |
| `--color-surface-level3` | #191a1b | #f5f6f7 | Superficies elevadas |

#### Linear Tokens Extraídos (adaptable a EPEM)

| Token Linear | Valor Linear | Uso recomendado | Adaptación EPEM |
|--------------|--------------|-----------------|-----------------|
| `--bg-marketing-black` | #08090a | Hero backgrounds | `--color-bg` |
| `--bg-panel-dark` | #0f1011 | Sidebar, panels | `--color-panel-bg` |
| `--bg-surface-level3` | #191a1b | Elevated surfaces | `--color-surface-level3` |
| `--text-primary` | #f7f8f8 | Headings | `--color-text` |
| `--text-secondary` | #d0d6e0 | Body text | `--color-secondary-text` |
| `--text-tertiary` | #8a8f98 | Placeholders | `--color-tertiary-text` |
| `--text-quaternary` | #62666d | Disabled | `--color-quaternary-text` |
| `--brand-indigo` | #10b981 | CTA buttons | `--color-primary` (verde EPEM) |
| `--accent-violet` | #00c573 | Links, active | `--accent-color` |
| `--accent-hover` | #00e5a4 | Hover states | `--color-accent-hover` |
| `--border-subtle` | rgba(255,255,255,0.05) | Ultra-subtle borders | `--color-border-subtle` |
| `--border-standard` | rgba(255,255,255,0.08) | Standard borders | `--color-border-standard` |

#### Notas de adaptación para EPEM

- **Color de acento:** Usar `#10b981` (verde emerald) en lugar de `#5e6ad2` (indigo de Linear). Esto respeta el canónico EPEM de cobranzas.
- **Bordes:** Mantener transparencia `rgba(255,255,255,0.05)` a `rgba(255,255,255,0.08)` para evitar ruido visual.
- **Fondos:** Usar `rgba(255,255,255,0.02)` a `rgba(255,255,255,0.05)` para botones y superficies elevadas (translúcido, nunca sólido).
- **Tipografía:** Implementar OpenType `"cv01", "ss03"` para Inter Variable en analytics (geometric alternates para look más limpio).
- **Peso de fuente:** Usar weight 510 para énfasis (between regular 400 and medium 500), no 700 (bold).

### Escala de tipografía (Linear)

| Size | Weight | Line Height | Letter Spacing | Uso |
|------|--------|-------------|----------------|------|
| 72px | 510 | 1.00 | -1.584px | Display XL (hero) |
| 64px | 510 | 1.00 | -1.408px | Display Large |
| 48px | 510 | 1.00 | -1.056px | Display |
| 32px | 400 | 1.13 | -0.704px | Heading 1 |
| 24px | 400 | 1.33 | -0.288px | Heading 2 |
| 20px | 590 | 1.33 | -0.24px | Heading 3 |
| 18px | 400 | 1.60 | -0.165px | Body Large |
| 16px | 400 | 1.50 | normal | Body |
| 14px | 510 | 1.50 | -0.182px | Caption |
| 13px | 400-510 | 1.50 | -0.13px | Meta |
| 12px | 400-590 | 1.40 | normal | Label |

---

## Paleta de colores

| Token | Valor | Uso |
|-------|--------|-----|
| `--text-base` | 1rem (16px) | Cuerpo, inputs, tablas |
| `--text-heading` | 1.25rem (20px) | Títulos de sección |
| `--text-display` | 1.5rem (24px) | Título de página |

### Reglas
- Números monetarios y porcentajes: siempre `font-mono` y `tabular-nums`.
- KPIs: número grande (3xl/4xl) con mono; label arriba en `text-default-500` o `--color-text-muted`.
- No mezclar más de 2 pesos de fuente en la misma sección.

---

## Espaciado

Regla del proyecto:
- **Entre elementos relacionados:** 8px (`gap-2`)
- **Entre grupos de elementos:** 16px (`gap-4`)
- **Entre secciones:** 32px (`gap-8`)
- **Padding interno de cards:** 24px (`p-6`)
- **Padding de página:** 24px desktop, 16px mobile (`p-6` / `p-4`)

Ancho máximo del contenido: `--container-max: 1800px`.

---

## Bordes y sombras

| Token | Uso |
|-------|-----|
| `--radius-sm` | 10px — inputs, badges pequeños |
| `--radius-md` | 14px — botones, chips |
| `--radius-lg` | 18px — cards, modales |
| `--radius` | 12px — genérico |
| `--shadow-card` | Cards y paneles |
| `--shadow-panel` | Paneles destacados |
| `--shadow-button-hover` | Hover de botón primario |

---

## Accesibilidad

- **Contraste:** Texto sobre fondo ≥ 4.5:1 (AA). Título del header en modo claro usa color sólido (`--color-primary`). Pills del header (`.header-pill--ok`, `--warn`, `--error`, `--info`) usan colores del sistema con fondo suave; en modo claro los tonos están ajustados para legibilidad.
- **Foco:** `--focus-ring: 0 0 0 3px color-mix(in srgb, var(--color-primary) 35%, transparent)` en todos los controles.
- **Touch:** Área mínima de toque 44px (`--touch-min: 44px`) para botones y links críticos.

---

## Referencia

- Definición de variables: `frontend/src/app/globals.css` (`:root` y `:root[data-theme="light"]`).
- Reglas de negocio y uso de términos: `AGENTS.md`.
- Specs por componente: `.cursor/agents/ui-designer.md`.
