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

## Tipografía

### Fuentes
- **Sans:** `var(--font-sans)` → Inter, system-ui, sans-serif (cuerpo y UI).
- **Mono:** Para montos, porcentajes y códigos; usar `font-mono` y `tabular-nums`.

### Escala (variables en globals.css)
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
