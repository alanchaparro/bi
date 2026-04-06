# POWER.md - Canon Ejecutivo de Tableros Analytics

## 1. Proposito
Este documento es el canon operativo para la creacion y mantenimiento de tableros analiticos en el proyecto **EPEM - Cartera de Cobranzas**. El objetivo es transformar las vistas tecnicas en herramientas de decision estrategica, siguiendo la filosofia de "Power BI": **de lo general a lo particular**.

## 1.1 Alcance y precedencia
- Este documento expresa la **nueva voluntad ejecutiva** del proyecto para la jerarquia de lectura y composicion de tableros analytics.
- No reemplaza reglas de negocio de `AGENTS.md`, ni fronteras de `desacople.md`, ni la politica de componentes de `docs/heroui/README.md`.
- Si existia contradiccion previa sobre el orden de lectura entre header, KPIs y filtros, `power.md` prevalece.
- La conciliacion oficial queda asi:
  - `AGENTS.md`: negocio, contratos, seguridad y referencia transversal.
  - `power.md`: narrativa ejecutiva, orden de lectura y composicion general de tableros.
  - `docs/spec-canon-patrones-ui-analytics.md`: implementacion operativa de filtros, tablas, densidad y acciones.
  - `docs/heroui/*`: primitivos UI y migracion incremental.

## 2. Arquitectura de Pantalla (Flujo de Lectura)
Toda vista de analisis debe seguir este orden vertical:

### A. Header de Identidad
- **Kicker**: etiqueta en mayusculas para ubicacion rapida.
- **Titulo**: nombre claro de la seccion.
- **Subtitulo**: explicacion breve de que mide la pantalla y bajo que logica.
- **Meta**: badges de frescura de datos y explicaciones de metricas.

### B. Resumen Ejecutivo (KPIs)
Antes de cualquier filtro o tabla, el ejecutivo debe ver la foto general.
- **Estructura**: grid de 3 a 4 tarjetas (`summary-card`).
- **Diseno**:
  - Fondo: `var(--bg-panel-dark)`.
  - Borde: `var(--border-standard-white)` con borde izquierdo acentuado por color.
  - Sombra: `var(--shadow-linear-ring)`.
- **Contenido**: valor numerico grande -> etiqueta -> nota aclaratoria.

### C. Motor de Filtros Jerarquico
La **lista maestra** de qué filtros entran en cada sección y en qué orden (macro / micro) vive en `frontend/src/config/analyticsFilterLayouts.ts` y se renderiza con `DashboardFiltersLayout` (excepciones puntuales se documentan en `power_avance.md`). Para ocultar un filtro sin cambiar el canon, la vista puede pasar `omit` al layout.

Los administradores pueden **persistir overrides** (orden, filas macro/micro, anchos y clases de rejilla) desde **Configuración → Layouts de filtros**; se guardan en API (`/brokers/config/dashboard-filter-layouts`) y aplican a todos los usuarios. El código del repo sigue siendo el valor por defecto cuando no hay override.

### C.1 Nueva sección de tablero analytics (obligatorio)
Toda **nueva vista o ruta** que sea un tablero analítico del mismo tipo que Cartera, Análisis, Rendimiento, Cohorte, etc. debe incorporarse **igual que las existentes** respecto a filtros:
1. **Registro en código**: añadir un `sectionId` en `frontend/src/config/analyticsFilterLayouts.ts` con las mismas tres capas que el resto: `macro`, `micro` y `floating` (pool de ids de `AnalyticsFilterId` que la vista realmente soporte).
2. **Render en pantalla**: usar `DashboardFiltersLayout` para macro/micro, `FloatingQuickFilters` + `DashboardFloatingFiltersLayout` para el panel lateral, y `buildEffectiveFilterLayout(sectionId, …)` leyendo `useFilterLayoutConfig()` (mismo patrón que las vistas actuales).
3. **Backend de normalización**: si la API persiste layouts, el pool de esa sección debe estar reflejado en el espejo de `DEFAULT_LAYOUTS` del servicio de normalización (hoy `dashboard_filter_layouts.py`), para no romper PUT/GET.
4. **Excepciones**: solo con acuerdo explícito y nota en `power_avance.md` (p. ej. módulos fuera del alcance tipo EERR que sigan otro contrato).

Los filtros no deben ser una lista plana, sino una jerarquia de decision:
1. **Fila Macro**:
   - UN -> Via de Cobro -> Categoria -> Tramo.
2. **Fila Micro**:
   - Mes de Gestion -> Año -> Supervisor -> Periodo.
3. **Fila de Accion**:
   - Alineados a la derecha.
   - **Boton Primario**: "Aplicar Filtros".
   - **Botones Secundarios**: "Limpiar", "Exportar", "Restablecer".

### D. Cuerpo de Datos
- **Capa de Transicion**: texto breve indicando que datos se estan viendo.
- **Tablas**:
  - Tipografia: `tabular-nums`.
  - Bordes sutiles.
- **Graficos**: colores alineados a la paleta Linear (`--color-chart-1` al `7`).

## 3. Canon Visual
Cualquier cambio en la UI debe validar que usa los tokens definidos en `globals.css`.

| Elemento | Token / Valor | Efecto esperado |
|----------|----------------|-----------------|
| Fondo principal | `--bg-marketing-black` | Negro profundo |
| Fondo panel | `--bg-panel-dark` | Contraste sutil |
| Texto primario | `--text-primary-linear` | Blanco roto |
| Bordes | `--border-standard-white` | Borde sutil |
| Acento | `--brand-emerald` | Emerald |
| Radius | `8px` | Bordes suaves |
| Sombra | `--shadow-linear-ring` | Anillo de 1px |

## 4. Reglas de Interaccion
1. **Carga no bloqueante**: usar `LoadingState` o skeletons.
2. **Feedback de filtros**: mostrar siempre el conteo de filtros activos.
3. **Persistencia**: los filtros deben persistirse en `userPreferences` cuando el modulo lo soporte.
4. **Empty states**: no mostrar tablas vacias; usar `EmptyState` con sugerencia accionable.

## 4.1 Orden canonico conciliado
El orden final obligatorio para vistas analytics tipo tablero ejecutivo es:
1. Header de identidad
2. Meta y explicacion compacta
3. Resumen ejecutivo (KPIs)
4. Filtros jerarquicos
5. Seleccion actual o transicion de lectura
6. Graficos
7. Tabla de detalle

Las excepciones deben justificarse por escrito en `power_avance.md`.

## 5. Checklist de validacion para el desarrollador
Antes de mergear una nueva vista o cambio:
- [ ] Tiene header con kicker y subtitulo.
- [ ] Existen las tarjetas de resumen ejecutivo arriba.
- [ ] Si es una **nueva sección** de tablero analytics: cumple **C.1** (registro en `analyticsFilterLayouts.ts`, `DashboardFiltersLayout` + FAB como el resto, espejo backend si aplica).
- [ ] Los filtros estan organizados en Macro -> Micro -> Acciones.
- [ ] El boton "Aplicar" es el elemento visualmente mas fuerte de los filtros.
- [ ] Se usan los tokens visuales definidos.
- [ ] La tabla usa `tabular-nums` y scroll horizontal cuando hace falta.
- [ ] El estado de carga es profesional y no disruptivo.
- [ ] La vista mantiene el orden ejecutivo `Header -> KPIs -> Filtros -> Detalle`.
