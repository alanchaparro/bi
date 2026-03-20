# Reporte QA — Unificación de cards y transición al filtrar — 12/03/2025

## Alcance revisado
- **Spec:** `docs/spec-cards-transicion-filtros.md`
- **PLAN.md:** Tarea "Unificación de cards de gráficos y transición al filtrar", Subtarea 6 (qa)
- **Revisión:** Solo código (no se pudo abrir el navegador). Verificación de clases aplicadas, contenedores y coherencia con la spec.

---

## ✅ Funciona correctamente

### Cards de gráficos
- **globals.css:** `.chart-card` tiene `border-radius: var(--radius-lg)` y `box-shadow: var(--shadow-card)`.
- **index.css:** `.chart-card` repite las mismas propiedades; `:root[data-theme='light'] .chart-card` usa `box-shadow: var(--shadow-card)` (sin override a `--shadow-md`).
- **Vistas que usan chart-card:**
  - **Análisis de Cartera:** artículos de gráficos con `card chart-card` (+ `chart-card-wide` donde aplica).
  - **Rendimiento:** los 5 gráficos usan `card chart-card chart-card-wide rend-chart-card`.
- **Anuales:** no tiene contenedores de tipo gráfico; solo tabla. La spec no exige chart-card ahí.
- **Cobranzas Cohorte:** KPIs usan `card kpi-card`; solo se usa `.chart-card-header` en el header de la card. No hay bloques “chart” independientes; coherente con la spec.

### Transición al filtrar
- **globals.css:** `.data-transition { transition: opacity 150ms ease-out; }` y `.data-transition.data-transition--loading { opacity: 0.45; }`. Duración ≤ 400 ms según spec.
- **Cuatro vistas con wrapper correcto:**
  - **AnalisisCarteraView:** wrapper con `data-transition` y `data-transition--loading` cuando `loadingSummary || loadingKpis`; envuelve resumen, KPIs, grids y gráficos (no el panel de filtros).
  - **AnalisisRendimientoView:** wrapper con `data-transition` y `data-transition--loading` cuando `loadingSummary`; envuelve KPIs y charts-grid.
  - **AnalisisAnualesView:** wrapper con `data-transition` y `data-transition--loading` cuando `loadingSummary`; envuelve la sección de tabla.
  - **AnalisisCobranzasCohorteView:** `analysis-results data-transition` con `data-transition--loading` cuando `applying || loadingSummary || loadingDetail`; envuelve KPIs, tabla y contenido que cambia por filtros.

La transición se aplica solo al bloque de datos que cambia al filtrar, no al panel de filtros ni a la barra de acciones.

### Tests E2E
- El tester reportó **17 E2E pasando**, lo que respalda que filtros y flujo no se rompieron.

---

## ⚠️ Observaciones (no bloquean)

1. **Override de `.card` en light (globals.css):** `:root[data-theme="light"] .card` usa valores rgba en lugar de `var(--shadow-card)`. El valor es el mismo que `--shadow-card` en light; sería más mantenible usar la variable. Impacto: bajo.
2. **Revisión sin navegador:** No se pudo validar en pantalla la uniformidad visual de las cards (radius/sombra) en las cuatro vistas ni que el fade de 150 ms se perciba bien y no rompa el flujo. Se recomienda una pasada manual rápida.

---

## ❌ Bloqueantes
- Ninguno detectado en código.

---

## 📊 Coherencia de datos
- No aplica a esta feature (solo estilos y transición). Los E2E existentes pasan.

---

## 🔄 Reglas de negocio (AGENTS.md)
- No se modifican filtros, gestion_month ni datos; solo presentación. Sin impacto en reglas de negocio.

---

## REPORTE DE CIERRE — QA

**Veredicto:** ⚠️ **APROBADO CON OBSERVACIONES**

### Flujos revisados
- Unificación de cards (clases y CSS): ✅ OK en código.
- Transición al filtrar (clase y contenedores en las 4 vistas): ✅ OK en código.
- E2E (reportados por tester): ✅ 17 pasando.

### Coherencia de datos
- N/A (cambio solo de UI/estilos).

### Reglas de negocio (AGENTS.md)
- Sin cambios; no aplica.

### Observaciones (no bloquean)
- Revisión fue solo de código; falta verificación manual en pantalla: (1) que las cards se vean con el mismo redondeo y sombra en las 4 vistas (dark/light), (2) que el fade de 150 ms al aplicar filtros no rompa el flujo.
- Opcional: en `globals.css`, usar `var(--shadow-card)` en `:root[data-theme="light"] .card` en lugar de valores rgba fijos.

### Bloqueantes
- Ninguno.

### Notificaciones al orquestador
- Ninguna. Si se desea máxima confianza visual, se puede pedir al frontend o al ui-designer una revisión manual rápida de cards y transición en las 4 vistas.

---

**Resumen en una línea:** Código cumple la spec (chart-card con --radius-lg y --shadow-card; data-transition 150 ms en las 4 vistas); veredicto APROBADO CON OBSERVACIONES condicionado a revisión manual en pantalla de aspecto de cards y sensación del fade al filtrar.
