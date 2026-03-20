# Auditoría de estados (loading / vacío / error) por vista

Cumplimiento del punto 2 de **Próximos pasos** en `docs/sugerencias-ui-designer.md`: skeleton, vacío y error en cada vista.

---

## Resumen

| Vista | Loading (skeleton) | Vacío | Error |
|-------|--------------------|--------|--------|
| Análisis de Cartera | ✅ AnalysisFiltersSkeleton + Skeleton en KPIs | ✅ EmptyState con mensaje | ✅ ErrorState (options + summary) |
| Rendimiento | ✅ AnalysisFiltersSkeleton | ✅ EmptyState en gráficos sin datos | ✅ ErrorState + LoadingState |
| Análisis Anuales | ✅ AnalysisFiltersSkeleton | ✅ EmptyState en tabla | ✅ ErrorState + LoadingState |
| Cobranzas Cohorte | ✅ AnalysisFiltersSkeleton | ✅ EmptyState (filtros / tabla) | ✅ ErrorState + LoadingState |
| Configuración | N/A (formularios) | N/A | ✅ Errores inline (sync, health, validación) |

---

## Detalle por vista

### Análisis de Cartera (`AnalisisCarteraView`)
- **Loading:** `AnalysisFiltersSkeleton` (filterCount=8, kpiCount=6, showTable). KPIs en carga usan `Skeleton` HeroUI con shimmer. `LoadingState` para "Cargando resumen...".
- **Vacío:** `EmptyState` cuando no hay datos para los filtros (con mensaje contextual).
- **Error:** `ErrorState` cuando fallan options o summary, con `onRetry`.

### Rendimiento (`AnalisisRendimientoView`)
- **Loading:** `AnalysisFiltersSkeleton` (filterCount=7, kpiCount=6, showTable). `LoadingState` "Actualizando rendimiento...".
- **Vacío:** `EmptyState` en cada gráfico cuando no hay series ("Sin datos.").
- **Error:** `ErrorState` con mensaje y reintentar.

### Análisis Anuales (`AnalisisAnualesView`)
- **Loading:** `AnalysisFiltersSkeleton` (filterCount=3, kpiCount=6, showTable). `LoadingState` "Actualizando resumen anual...".
- **Vacío:** `EmptyState` en tabla "Sin datos para filtros seleccionados.".
- **Error:** `ErrorState` con reintentar.

### Cobranzas Cohorte (`AnalisisCobranzasCohorteView`)
- **Loading:** `AnalysisFiltersSkeleton` (filterCount=5, kpiCount=6, showTable). `LoadingState` "Cargando resumen inicial...".
- **Vacío:** `EmptyState` cuando no hay filas ("Sin datos para los filtros seleccionados." + sugerencia).
- **Error:** `ErrorState` con `onRetry` (`retryLastRequest`).

### Configuración (`ConfigView`)
- **Loading:** No hay carga inicial de lista; cada subsección tiene sus propios estados (health loading, sync running, etc.).
- **Vacío:** No aplica (formularios y acciones).
- **Error:** Errores mostrados inline: `displayError` en importaciones, `health.error`, validaciones de formulario y `syncResult?.error`. No se usa `ErrorState` global porque el contexto es por sección.

---

## Conclusión

Las vistas de **análisis** (Cartera, Rendimiento, Anuales, Cohorte) cubren los cuatro estados (loading con skeleton, con datos, vacío, error). **Configuración** no requiere skeleton/vacío global; los errores se manejan por bloque (conexión, sync, usuarios). Auditoría cerrada.
