# Inventario de secciones del frontend — EPEM Cartera de Cobranzas

Documento de referencia para el **rebuild completo del frontend con HeroUI**. Ninguna de estas secciones debe perderse.

## Rutas y páginas obligatorias

| Ruta | Sección (label) | Grupo en menú | Módulo/vista actual |
|------|-----------------|---------------|----------------------|
| `/` | (raíz) | — | Redirige a `/login` o `/analisis-cartera` |
| `/login` | Login | — | `LoginView` — autenticación |
| `/analisis-cartera` | Análisis de Cartera | Análisis de Cartera | `AnalisisCarteraView` |
| `/analisis-anuales` | Análisis Anuales | Análisis de Cartera | `AnalisisAnualesView` |
| `/rendimiento` | Rendimiento de Cartera | Análisis de Cartera | `AnalisisRendimientoView` |
| `/cobranzas-cohorte` | Análisis Cobranzas Corte | Análisis de Cartera | `AnalisisCobranzasCohorteView` |
| `/config` | Configuración | Sistema | `ConfigView` |

## Funcionalidad por sección que debe conservarse

### Login (`/login`)
- Formulario: usuario, contraseña.
- Llamada a API de auth; guardado de refresh token; redirección a `/analisis-cartera` en éxito.
- Manejo de error (mensaje amigable, sin stack).
- Si ya hay sesión, redirigir a `/analisis-cartera`.

### Análisis de Cartera (`/analisis-cartera`)
- Filtros por empresa, período (gestión), UN, categoría, tramo, vía de cobro según backend.
- Tabla/corte de cartera; KPIs (monto total, cantidad contratos, etc.).
- Consume rutas v2 (portfolio-corte-v2) según AGENTS.md.
- Estados: loading (skeleton), vacío, error, con datos.

### Análisis Anuales (`/analisis-anuales`)
- Métricas anuales; filtros por año/empresa.
- Consume endpoints de analytics v2.
- Estados: loading, vacío, error, con datos.

### Rendimiento de Cartera (`/rendimiento`)
- Rendimiento por gestor; métricas monto y cantidad (rendimiento_monto_%, rendimiento_cantidad_%).
- Filtros por empresa, período, UN, categoría, tramo, vía de pago/cobro.
- Consume rendimiento-v2.
- Estados: loading, vacío, error, con datos.

### Análisis Cobranzas Corte (`/cobranzas-cohorte`)
- Análisis por cohortes (fecha de originación).
- Filtros coherentes con el resto.
- Estados: loading, vacío, error, con datos.

### Configuración (`/config`)
- Configuración de la app; puede incluir estado de sync, opciones de usuario, etc.
- Enlace desde el header (pills de sync) hacia `/config`.

## Layout y shell que debe rehacerse con HeroUI

- **Header (app bar)**: título "EPEM - Cartera de Cobranzas", toggle sidebar (móvil), pills de estado de sync/schedule, rol de usuario, toggle tema (dark/light), botón Cerrar sesión.
- **Sidebar**: menú de navegación por grupos ("Análisis de Cartera" y "Sistema"); ítems con iconos; activo según `pathname`; colapsable en móvil con overlay.
- **Contenido principal**: área bajo header y al lado del sidebar; mismo padding y contenedor.
- **Auth**: rutas protegidas; si no hay auth, redirigir a `/login`; layout de dashboard solo para usuarios autenticados.
- **Tema**: dark/light con HeroUI; persistir en `localStorage` (`ui-theme`).

## Contratos con backend que no deben cambiar

- Auth: `POST /api/v1/auth/login`, refresh token, access token en memoria.
- Analytics: rutas v2 (portfolio-corte-v2, rendimiento-v2, etc.) con `options` y `summary`/datos.
- Metadata en respuestas: `source_table`, `data_freshness_at`, `cache_hit`, `pipeline_version` (según AGENTS.md).

## Archivos de configuración a mantener o adaptar

- `frontend/src/config/routes.ts` — definición de `ROUTES`, `ROUTE_TO_SECTION_ID`, `NAV_ITEMS`.
- `frontend/src/config/navSections.ts` — `NAV_SECTIONS` (ids y grupos).
- Variables de entorno y `shared/env.ts` para base URL de la API.
- `shared/api`, `shared/contracts`, `shared/types` — no tocar lógica de negocio; el frontend solo consume.

## Resumen para el equipo

- **Secciones a recrear**: Login, Análisis de Cartera, Análisis Anuales, Rendimiento, Cobranzas Corte, Configuración.
- **Shell**: layout con tema HeroUI (Sidebar, Navbar/AppBar, botones, menú, tokens del tema).
- **Misma funcionalidad y rutas**: solo se reemplaza la UI por componentes y tema HeroUI; no se eliminan secciones ni flujos.
