# Spec: Unificación de títulos de página y kicker

**Origen:** PLAN.md — Tarea "Unificación de títulos de página y kicker", Subtarea 2 (ui-designer).  
**Referencia:** docs/sugerencias-ui-designer.md §3.1 (Kicker, Título de página).

---

## 1. Kicker (`.analysis-kicker`)

### Uso
- **Una etiqueta por vista** que identifica la sección. Misma clase en todas las vistas de análisis.
- Texto del kicker por vista:

| Vista | Ruta / Módulo | Kicker (texto) |
|-------|----------------|----------------|
| Análisis de Cartera | `analisisCartera` | `CARTERA` |
| Rendimiento de Cartera | `analisisRendimiento` | `RENDIMIENTO` |
| Análisis Anuales | `analisisAnuales` | `ANUALES` |
| Cobranzas Cohorte | `analisisCobranzasCohorte` | `COHORTE` |
| Configuración | `config` | `SISTEMA` (ya usado) |

*(Opcional: si se prefiere un único contexto "PANEL EJECUTIVO" en las 4 vistas de análisis, se puede dejar ese texto y diferenciar solo en Config con "SISTEMA"; la spec prioriza contexto por vista.)*

### Clase y tipografía unificada
- **Clase:** `.analysis-kicker`
- **Tipografía (un solo lugar, misma en Cartera, Rendimiento, Anuales, Cohorte):**
  - `font-size`: **0.6875rem** (11px)
  - `font-weight`: **700**
  - `letter-spacing`: **0.08em**
  - `text-transform`: **uppercase**
- Estilos actuales de `.analysis-kicker` en `frontend/src/index.css` (borde, fondo, padding, border-radius) se mantienen; solo se asegura que **no exista otra clase** para el kicker (p. ej. eliminar o reemplazar `.cohorte-kicker` por `.analysis-kicker` donde se use).

### Archivos a tocar
- **CSS:** `frontend/src/index.css` — una sola definición de `.analysis-kicker`; eliminar o unificar `.cohorte-kicker` con `.analysis-kicker`.
- **Vistas:**  
  `frontend/src/modules/analisisCartera/AnalisisCarteraView.tsx`,  
  `frontend/src/modules/analisisRendimiento/AnalisisRendimientoView.tsx`,  
  `frontend/src/modules/analisisAnuales/AnalisisAnualesView.tsx`,  
  `frontend/src/modules/analisisCobranzasCohorte/AnalisisCobranzasCohorteView.tsx`  
  → pasar a cada una el `kicker` correspondiente de la tabla (ya usan `AnalyticsPageHeader` con `kicker`).

---

## 2. Título de página (`.page-title`)

### Uso
- **Una sola clase** para el título principal de página en todo el app: `.page-title`.
- El componente `AnalyticsPageHeader` debe aplicar **solo** `.page-title` al `<h2>` (quitar la clase `.section-title` del título de página para evitar duplicar reglas de tamaño).

### Token de tamaño
- **Opción A (recomendada):** usar variable del sistema  
  `font-size: var(--text-display);`  
  con `--text-display` definido en `globals.css` (p. ej. `1.5rem`).
- **Opción B (responsive):**  
  `font-size: clamp(1.35rem, 2vw, 1.65rem);`  
  para que escale entre 1.35rem y 1.65rem según viewport.

La definición debe vivir en **un solo archivo** (o `frontend/src/app/globals.css` o `frontend/src/index.css`), no en ambos, para que todas las vistas de análisis (y cualquier otra página que use título de página) compartan la misma regla.

### Otras propiedades del título (unificadas)
- `font-weight`: **700**
- `letter-spacing`: **-0.025em** (o -0.02em)
- `line-height`: **1.25**
- `color`: **var(--color-text)**

### Archivos a tocar
- **CSS:**  
  - `frontend/src/app/globals.css`: definir o ajustar `.page-title` con `font-size: var(--text-display)` o con `clamp(1.35rem, 2vw, 1.65rem)`; eliminar duplicados.  
  - `frontend/src/index.css`: si `.analysis-header h2` define tamaño, reemplazar por uso de `.page-title` y eliminar la regla de `font-size` en `.analysis-header h2` (o dejar que `.page-title` sea la única que define tamaño para el título de página).
- **Componente:**  
  `frontend/src/components/analytics/AnalyticsPageHeader.tsx`:  
  `<h2 className="section-title page-title">` → `<h2 className="page-title">` (o mantener `section-title` solo si se usa para otra cosa; en tal caso, que `.page-title` tenga prioridad en tamaño y no `.section-title`).

---

## 3. Resumen de archivos

| Archivo | Cambio |
|---------|--------|
| `frontend/src/index.css` | Una sola `.analysis-kicker`; unificar/eliminar `.cohorte-kicker`; asegurar que el título de página use solo `.page-title` (sin duplicar font-size en `.analysis-header h2` si se centraliza en `.page-title`). |
| `frontend/src/app/globals.css` | `.page-title` con `font-size: var(--text-display)` o `clamp(1.35rem, 2vw, 1.65rem)` y resto de propiedades unificadas. |
| `frontend/src/components/analytics/AnalyticsPageHeader.tsx` | `h2` con clase `page-title` (y quitar `section-title` del título de página si procede). |
| `frontend/src/modules/analisisCartera/AnalisisCarteraView.tsx` | `kicker="CARTERA"` (o valor acordado). |
| `frontend/src/modules/analisisRendimiento/AnalisisRendimientoView.tsx` | `kicker="RENDIMIENTO"`. |
| `frontend/src/modules/analisisAnuales/AnalisisAnualesView.tsx` | `kicker="ANUALES"`. |
| `frontend/src/modules/analisisCobranzasCohorte/AnalisisCobranzasCohorteView.tsx` | `kicker="COHORTE"`. |
| `frontend/src/modules/config/ConfigView.tsx` | Sin cambio (ya usa `kicker="SISTEMA"`). |

---

## 4. Checklist de implementación (frontend)

- [ ] Kicker: un solo texto por vista según tabla; clase `.analysis-kicker` en todas.
- [ ] Tipografía del kicker: 0.6875rem, 700, 0.08em, uppercase; definida una sola vez.
- [ ] No queda `.cohorte-kicker` con estilos distintos; todo kicker usa `.analysis-kicker`.
- [ ] Título de página: una sola clase `.page-title` con `--text-display` o clamp 1.35rem–1.65rem.
- [ ] Definición de tamaño del título en un solo archivo (globals.css o index.css).
- [ ] Todas las vistas de análisis (Cartera, Rendimiento, Anuales, Cohorte) y Config usan el mismo patrón header (kicker + título).

---

## 5. Notas para revisión (ui-designer)

- Verificar que en todas las vistas el kicker se vea con la misma tipografía y que el título de página tenga el mismo tamaño y peso.
- Verificar que no haya títulos de página fuera del sistema (p. ej. otros `h1`/`h2` con tamaños inline o clases distintas).
