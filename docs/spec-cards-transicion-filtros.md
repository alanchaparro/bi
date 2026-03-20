# Spec: Cards de gráficos unificadas y transición al filtrar

**Origen:** PLAN.md — Tarea "Unificación de cards de gráficos y transición al filtrar", Subtarea 2 (ui-designer).  
**Referencias:** `docs/sugerencias-ui-designer.md` §3.2 (Cards de gráficos) y §4.3 (Transición de datos).

---

## 1. Cards de gráficos

### Objetivo
Mismo `border-radius` y sombra en todos los contenedores de gráficos en: Análisis de Cartera, Rendimiento, Anuales y Cobranzas Cohorte.

### Tokens a usar
- **Border radius:** `var(--radius-lg)` (ya definido en `globals.css` y `index.css` en `:root`).
- **Sombra:** `var(--shadow-card)` (definido en `globals.css` para dark y light).

### Clases y variables

| Elemento | Clase / selector | Qué aplicar |
|----------|------------------|-------------|
| Contenedor de cada gráfico (card) | `.chart-card` | `border-radius: var(--radius-lg)`; `box-shadow: var(--shadow-card)` |
| Header dentro de la card del gráfico | `.chart-card-header` | Sin cambio de radius/sombra; solo layout (ya definido). |
| Wrapper opcional que envuelve solo el área del chart | Mismo contenedor que lleva `.chart-card` | Hereda del padre; no hace falta clase extra. |

### Dónde definir los estilos

- **Recomendado:** en **`frontend/src/app/globals.css`** (o, si el proyecto centraliza estilos de análisis en `index.css`, en **`frontend/src/index.css`**), en un solo lugar para evitar duplicados.
- Asegurar que **`.chart-card`** tenga siempre:
  - `border-radius: var(--radius-lg);`
  - `box-shadow: var(--shadow-card);`
- Quitar o corregir **overrides** que usen otra sombra (p. ej. `--shadow-md` o `--shadow`) en temas light/dark para `.chart-card`, de modo que en todas las vistas y temas se use **`--shadow-card`** y **`--radius-lg`**.

### Comportamiento por vista
- **Análisis de Cartera:** ya usa `card chart-card`; debe verse con `--radius-lg` y `--shadow-card`.
- **Rendimiento:** usa `card chart-card chart-card-wide rend-chart-card`; `.chart-card` aplica; `.rend-chart-card` solo ajustes de padding (mantener).
- **Anuales:** si hay bloques de gráficos con card, usar la clase `chart-card` en el contenedor y mismo criterio.
- **Cobranzas Cohorte:** contenedores que actúen como “card de gráfico” deben usar `chart-card` (o las mismas propiedades) para radius y sombra.

### Resumen de cambios de código (cards)
1. En la hoja elegida (`globals.css` o `index.css`):  
   Añadir o consolidar en **`.chart-card`** las propiedades:  
   `border-radius: var(--radius-lg);` y `box-shadow: var(--shadow-card);`
2. En la misma hoja:  
   En cualquier regla que sobrescriba `.chart-card` (p. ej. `:root[data-theme='light'] .chart-card`), reemplazar `box-shadow: var(--shadow-md)` (o similar) por **`box-shadow: var(--shadow-card)`**.
3. Revisar que ningún contenedor de gráfico en las cuatro vistas use sombra o radius distintos; si no usa `.chart-card`, añadir la clase o las mismas variables.

---

## 2. Transición al filtrar

### Objetivo
Fade corto de opacidad (150 ms) cuando cambian los datos por filtros, sin sensación de salto. Sin animaciones > 400 ms.

### Duración
- **150 ms** (`ease-out` recomendado).

### Clase CSS

Definir una clase de transición reutilizable, por ejemplo:

- **Nombre de clase:** `.data-transition`
- **Propiedades:**
  - `transition: opacity 150ms ease-out;`
- **Estado “cargando” (opcional):**  
  Clase adicional, p. ej. `.data-transition--loading`, con `opacity: 0.45` (o valor acordado, p. ej. `0.4`–`0.5`), para que el contenedor se atenúe mientras se cargan los datos.

Ejemplo de reglas:

```css
.data-transition {
  transition: opacity 150ms ease-out;
}

.data-transition.data-transition--loading {
  opacity: 0.45;
}
```

### Dónde aplicar la transición

Aplicar la clase **al contenedor que envuelve el contenido que cambia al filtrar**:

| Vista | Contenedor a marcar con `.data-transition` |
|-------|--------------------------------------------|
| Análisis de Cartera | Wrapper que contiene: resumen/KPIs, `summary-grid`, `charts-grid` y, si se desea, la tabla de detalle cuando también se actualiza por filtros. |
| Rendimiento | Wrapper del contenido principal que incluye KPIs, gráficos y tablas que dependen de los filtros. |
| Anuales | Wrapper del contenido que se actualiza al aplicar filtros (resumen, tablas, gráficos si los hay). |
| Cobranzas Cohorte | Wrapper del contenido que se actualiza al cambiar filtros (KPIs, gráficos, tablas). |

En todas las vistas: **no** aplicar la transición al panel de filtros ni a la barra de acciones, solo al **bloque de datos** (resumen, grids, tablas, gráficos).

### Comportamiento en lógica (React)
- Al iniciar la carga por cambio de filtros (p. ej. al llamar a “Aplicar filtros” o al disparar el fetch): añadir la clase de estado de carga al contenedor (p. ej. `data-transition--loading` o un atributo `data-loading="true"` que se estilice igual).
- Cuando termine la carga (datos recibidos o error): quitar esa clase/atributo para que el contenedor vuelva a opacidad 1.
- El contenedor debe tener siempre la clase base `.data-transition` para que la transición de opacidad funcione.

### Dónde definir la clase
- En **`frontend/src/app/globals.css`** o en **`frontend/src/index.css`** (mismo criterio que para las cards), en un solo lugar.

### Restricción
- No usar duraciones > 400 ms para esta transición de feedback al filtrar.

---

## 3. Archivos que el frontend puede tocar

| Archivo | Cambios |
|---------|--------|
| `frontend/src/app/globals.css` | Variables ya existen (`--radius-lg`, `--shadow-card`). Añadir/ajustar reglas para `.chart-card` (radius + shadow) y para `.data-transition` / `.data-transition--loading`. |
| `frontend/src/index.css` | Si aquí están los estilos de análisis: unificar `.chart-card` con `--radius-lg` y `--shadow-card`; quitar overrides que usen `--shadow-md` en chart cards. Opcionalmente definir aquí `.data-transition` si se centraliza en index. |
| `frontend/src/modules/analisisCartera/AnalisisCarteraView.tsx` | Envolver el bloque de datos (resumen + grids + tabla) en un div con `className="data-transition"` y añadir clase/atributo de loading cuando `loadingSummary \|\| loadingKpis`. |
| `frontend/src/modules/analisisRendimiento/AnalisisRendimientoView.tsx` | Igual: wrapper con `.data-transition` en el contenido que cambia por filtros; estado de loading según corresponda. |
| `frontend/src/modules/analisisAnuales/AnalisisAnualesView.tsx` | Igual: wrapper con `.data-transition` en el contenido que se actualiza al filtrar. |
| `frontend/src/modules/analisisCobranzasCohorte/AnalisisCobranzasCohorteView.tsx` | Igual: wrapper con `.data-transition` en el contenido que se actualiza al filtrar; asegurar que los contenedores de gráficos usen `.chart-card` (o mismo radius/sombra). |

No tocar backend, tests ni archivos fuera de `frontend/src/`.

---

## 4. Checklist de implementación (frontend)

- [ ] `.chart-card` usa en todos los temas `border-radius: var(--radius-lg)` y `box-shadow: var(--shadow-card)`.
- [ ] No queda ningún override de `.chart-card` con `--shadow-md` o sombra distinta de `--shadow-card`.
- [ ] Las cuatro vistas (Cartera, Rendimiento, Anuales, Cohorte) muestran los contenedores de gráficos con el mismo aspecto (radius y sombra).
- [ ] Clase `.data-transition` definida con `transition: opacity 150ms ease-out`.
- [ ] Clase de estado de carga (ej. `.data-transition--loading`) definida con `opacity: 0.45` (o valor acordado).
- [ ] En cada vista de análisis, el contenedor de datos (resumen + gráficos + tablas) tiene `.data-transition` y la clase/atributo de loading cuando corresponde.
- [ ] Duración de la transición ≤ 400 ms.

---

## 5. Notas para QA

- Verificar en las cuatro vistas que las cards de gráficos se vean con el mismo redondeo y la misma sombra (dark y light).
- Al cambiar filtros y pulsar “Aplicar”, comprobar que el contenido de datos hace un fade breve (no salto brusco) y que la transición no supera 400 ms.
