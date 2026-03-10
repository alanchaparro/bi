# Frontend V2 Rollout Checklist

## 1) Pre-Canary
- [x] `npm run typecheck` en `frontend/` sin errores.
- [x] `npm run build` en `frontend/` sin errores.
- [x] Validar flags activos en entorno:
  - `VITE_USE_ANALYTICS_V2=1`
  - `VITE_USE_COHORTE_V2_FIRST_PAINT=1`
  - `VITE_USE_FIRST_PAINT_ALL_SECTIONS=1`
  - `VITE_USE_FRONTEND_PERF_TELEMETRY=1`
  - `VITE_USE_STRICT_UI_TOKENS=1`

## 2) Smoke Funcional por Ruta
Ejecutar manualmente en navegador: entrar a cada ruta, aplicar filtros, resetear, comprobar que no hay bloqueos.
- [ ] `cartera`: carga filtros, first-paint visible, aplicar/reset responde, sin bloqueos.
- [ ] `cohorte`: first-paint visible antes de detail, botón `Cargar más` funciona.
- [ ] `rendimiento`: first-paint visible, summary completa luego en background.
- [ ] `anuales`: first-paint visible, summary completa luego en background.
- [ ] `config/programación`: ejecutar/pausar/reanudar/eliminar no rompe layout.

## 3) Smoke Visual
- [ ] Desktop (1366x768): sin overflow horizontal no deseado en cards/filtros.
- [ ] Mobile (~390x844): filtros y botones navegables, sin solapes.
- [ ] Focus ring visible en controles interactivos (teclado Tab).
- [ ] MultiSelect usable con teclado (ArrowUp/Down, Enter/Space, Escape).
- [ ] Teclado y focus-visible verificados por ruta (Tab, Enter, Escape en filtros y modales).

## 4) Observabilidad
- [ ] Backend recibe eventos `POST /telemetry/frontend-perf` (payload con `ttfb_ms`, `fcp_ms`, `ready_ms`, `api_calls`).
- [ ] `ready_ms` se envía por ruta al llamar `markPerfReady(route)` cuando la vista está lista.
- [ ] En respuestas de analytics, `cache_hit` aparece en `meta` cuando la respuesta viene de cache; en el payload de telemetría, `cache_hit` aparece en cada elemento de `api_calls` cuando aplica.

## 5) Canary y Fallback
- [ ] Activar canary interno por 24-48h.
- [ ] Monitorear p95 por ruta y errores JS.
- [ ] Si hay regresión, fallback inmediato por flags:
  - `VITE_USE_FIRST_PAINT_ALL_SECTIONS=0`
  - `VITE_USE_COHORTE_V2_FIRST_PAINT=0`
  - `VITE_USE_ANALYTICS_V2=0`

## 6) Criterio de Aceptación
- [ ] Sin errores de compilación.
- [ ] Sin regresión funcional en filtros.
- [ ] UX inicial más rápida (first-paint) y detail no bloqueante.
