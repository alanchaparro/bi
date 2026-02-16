# Plan de mejoras – Cartera Cobranzas

Documento para ir resolviendo mejoras en orden de prioridad (alta → media → baja).  
Marcar con `[x]` al completar cada ítem y añadir evidencia o enlace si aplica.

---

## Prioridad ALTA

### A1. Eliminar login hardcodeado en frontend

**Problema:** En `frontend/src/App.tsx` se hace auto-login con `admin`/`admin123`. Inaceptable para producción.

**Acciones:**
- [x] Crear pantalla/página de login (formulario usuario + contraseña).
- [x] Quitar el `useEffect` que llama a `login({ username: 'admin', password: 'admin123' })`.
- [x] Tras login exitoso: guardar tokens, redirigir al dashboard y mostrar estado de sesión.
- [x] Manejar errores de login (credenciales inválidas, cuenta bloqueada) con mensaje claro en UI.

**Evidencia:** `frontend/src/modules/auth/LoginView.tsx`; flujo en `App.tsx` (estado `auth`, `handleLogin`, `getApiErrorMessage`).

---

### A2. Implementar uso de refresh token en frontend

**Problema:** El backend expone `/auth/refresh` y rotación de refresh tokens; el frontend no los usa. Al expirar el access token la sesión se pierde sin aviso.

**Acciones:**
- [x] Persistir `refresh_token` de forma segura (p. ej. en memoria o `sessionStorage`; valorar riesgos de `localStorage`).
- [x] Añadir interceptor en axios: ante respuesta 401, intentar renovar con refresh token.
- [x] Si el refresh tiene éxito: reenviar la petición original con el nuevo access token.
- [x] Si el refresh falla: limpiar sesión, mostrar "Sesión expirada" y redirigir a pantalla de login.
- [x] Documentar en runbook o README el flujo de tokens (access + refresh).

**Evidencia:** `frontend/src/shared/sessionStorage.ts`, `frontend/src/shared/api.ts` (`refreshToken`, `restoreSession`, interceptor, `setOnUnauthorized`). Persistencia en `sessionStorage`; restauración al cargar la app.

---

### A3. Endurecer o deshabilitar usuarios demo en no-dev

**Problema:** Valores por defecto `admin`/`admin123` y `analyst`/`analyst123` en config; un despliegue sin cambiar `.env` queda expuesto.

**Acciones:**
- [x] En entornos distintos de `dev` (p. ej. `APP_ENV=prod`), no usar `DEMO_USERS` para autenticación, solo usuarios de DB.
- [x] Actualizar `.env.example` y documentación con advertencia de no usar credenciales demo en producción.

**Evidencia:** `backend/app/core/security.py` (`_is_demo_allowed()` solo `app_env == 'dev'`); `.env.example` con comentario de advertencia.

---

### A4. Verificar que `.env` no esté en el historial de Git

**Problema:** Si en algún momento se commiteó `.env` con secretos, quedan en el historial.

**Acciones:**
- [x] Ejecutar `git log -p -- .env` (y variantes como `.env.local`) para comprobar que nunca se subió.
- [x] Si hubo commit con secretos: rotar todas las contraseñas/secretos que aparezcan y valorar limpieza de historial (p. ej. `git filter-repo`) según política de equipo.

**Evidencia:** Ejecutado `git log -p -- .env`: salida vacía → `.env` nunca fue commiteado. Sin acción adicional.

---

### A5. Operación: estabilidad y cierre de cutover (M-001 a M-006)

**Problema:** Mejoras operativas pendientes (estabilidad dashboard, monitoreo, parity, rollback, firmas, cierre de cutover).

**Acciones:**
- [ ] **M-001:** Estabilizar servicio `dashboard` para evitar reinicios en ventanas largas (60 min); identificar causa y mitigar.
- [ ] **M-002:** Completar monitoreo de cutover (30–60 min) con `cutover_window_monitor.py` y métricas dentro de umbral.
- [ ] **M-003:** Ejecutar 2 ciclos consecutivos de parity + perf en verde; documentar en `docs/evidence/`.
- [ ] **M-004:** Ejecutar rollback drill real en staging; documentar en `docs/rollback-drill-report.md` (tiempo &lt; 15 min).
- [ ] **M-005:** Completar firmas de salida (Backend/Frontend/Ops/QA) en checklist y rollback report.
- [ ] **M-006:** Cierre formal de cutover (checklist en verde) y plan de apagado legacy documentado.

**Evidencia:** Referencias a `docs/cutover-checklist-final.md`, `docs/rollback-drill-report.md` y logs/métricas según cada ítem.

**Seguimiento:** Las tareas M-001 a M-006 son operativas (estabilidad, monitoreo, parity, rollback, firmas, cierre). Se llevan en `docs/mejoras-pendientes-seguimiento.md` y en `docs/cutover-checklist-final.md`. Este plan no las ejecuta; solo referencia dónde completarlas.

---

## Prioridad MEDIA

### M1. CORS restrictivo en producción

**Problema:** Por defecto `CORS_ORIGINS=*`. En producción conviene restringir orígenes.

**Acciones:**
- [x] Documentar en runbook que no se use `*` en producción.
- [x] Comentario en `.env.example` con orígenes concretos para prod.

**Evidencia:** `.env.example` (comentario CORS); `docs/runbook-prod.md` (paso 2 Arranque).

---

### M2. Rate limit distribuido (si hay múltiples réplicas)

**Problema:** `InMemoryRateLimiter` no se comparte entre instancias; con varias réplicas el límite es por nodo.

**Acciones:**
- [x] Documentar en runbook que con varias réplicas se requiere backend compartido (Redis) y misma semántica.

**Evidencia:** `docs/runbook-prod.md` sección "Rate limit". Implementación Redis queda como mejora futura cuando se desplieguen múltiples réplicas.

---

### M3. Tipado estricto en frontend (reducir `any`)

**Problema:** Uso de `e: any` y `rules: any[]` en `App.tsx` y otros componentes.

**Acciones:**
- [x] Reemplazar `any` por `unknown` en handlers de error y usar helper tipado para mensaje.
- [x] Tipos concretos para errores de API (`frontend/src/shared/apiErrors.ts`).

**Evidencia:** `getApiErrorMessage(e: unknown)` en `apiErrors.ts`; `BrokersCommissionsView`, `BrokersPrizesView`, `BrokersSupervisorsView` con `catch (e: unknown)` y `getApiErrorMessage(e)`; `App.tsx` usa `Record<string, unknown>[]` para rules y `getApiErrorMessage` desde shared.

---

### M4. Tests con credenciales configurables

**Problema:** Tests usan `admin`/`admin123` fijos; si se desactivan usuarios demo, los tests fallan.

**Acciones:**
- [x] Variables de entorno `TEST_ADMIN_USER`, `TEST_ADMIN_PASSWORD`, `TEST_ANALYST_USER`, `TEST_ANALYST_PASSWORD` con fallback a demo.
- [x] Documentar en `tests/README.md` las variables necesarias.

**Evidencia:** `tests/test_api_v1_brokers_config.py`, `tests/test_api_v1_auth_refresh_and_analytics.py`; `tests/README.md` tabla de variables.

---

### M5. Health check con dependencias

**Problema:** El endpoint de health no refleja estado de DB ni del legacy.

**Acciones:**
- [x] Incluir en `GET /health` comprobación de conexión a la base de datos; 503 si DB no disponible.
- [x] Documentar contrato (200/503, campos `ok`, `db_ok`, `message`) en `docs/api-contracts-v1.md`.

**Evidencia:** `backend/app/api/v1/endpoints/health.py`; `docs/api-contracts-v1.md` sección Health.

---

### M6. Logging estructurado consistente

**Problema:** Spec exige logging estructurado; no hay un formato estándar (JSON) en toda la app.

**Acciones:**
- [x] Definir formato JSON por línea (`trace_id`, nivel, mensaje, duración, endpoint) en `app/core/logging_config.py`.
- [x] Usar en middleware de request (log_request al finalizar; structured_log en excepciones).

**Evidencia:** `backend/app/core/logging_config.py` (`structured_log`, `log_request`); `backend/app/main.py` middleware que emite una línea JSON por request (info) o por error (error).

---

## Prioridad BAJA

### B1. Centralizar tipos y manejo de errores en frontend

**Problema:** `BrokersFilters` duplicado; errores leídos de forma ad hoc (`e?.response?.data?.message`).

**Acciones:**
- [x] Centralizar tipos de filtros y preferencias en un módulo compartido (`contracts.ts`).
- [x] Helper que extraiga mensaje y opcionalmente `error_code`, `trace_id` (`parseApiError` en `apiErrors.ts`); uso de `getApiErrorMessage` en toda la app.

**Evidencia:** `frontend/src/shared/contracts.ts` (`BrokersFilters`, `BrokersPreferences`, `EMPTY_BROKERS_FILTERS`); `api.ts` y `store/userPreferences.ts` importan desde contracts; `apiErrors.ts` con `getApiErrorMessage` y `parseApiError`/`ApiErrorDetail`.

---

### B2. Completar contexto de producto en `agente.md`

**Problema:** La sección "Contexto del producto" sigue como "a completar".

**Acciones:**
- [x] Rellenar: nombre del proyecto, público objetivo, roles, KPIs clave.
- [x] Añadir: fuentes/tablas principales, volumen y latencia esperada, reglas de negocio relevantes, restricciones de infra.

**Evidencia:** `agente.md` actualizado con "Contexto del producto" completo.

---

### B3. Servir frontend estático en perfil prod (Docker Compose)

**Problema:** Frontend solo tiene perfil `dev` (npm run dev). En producción debe servirse el build estático.

**Acciones:**
- [x] Añadir servicio `frontend-prod` en `docker-compose.yml` (perfil `prod`) con build multi-stage (node + nginx).
- [x] Documentar en runbook el despliegue completo: backend + frontend estático.

**Evidencia:** `frontend/Dockerfile` (build + nginx); `docker-compose.yml` servicio `frontend-prod`; `docs/runbook-prod.md` sección "Frontend estático (perfil prod)".

---

### B4. Cobertura de tests en CI

**Problema:** El pipeline ejecuta tests pero no publica ni exige umbral de cobertura.

**Acciones:**
- [x] Añadir paso en CI que ejecute tests con `coverage`, genere `coverage.xml` y suba artefacto.

**Evidencia:** `.github/workflows/release.yml`: pasos "Backend Coverage" (coverage run + xml) y "Upload Backend Coverage" (artefacto `backend-coverage`).

---

### B5. Cache y optimizaciones de analytics (performance)

**Problema:** `docs/performance-notes.md` indica full scans y recomienda memoizar y cachear.

**Acciones:**
- [x] Implementar cache por firma de filtros en `POST /api/v1/analytics/brokers/summary` (in-memory, TTL 60 s).
- [x] Nota en performance-notes sobre extensión a otros endpoints.

**Evidencia:** `backend/app/core/analytics_cache.py`; uso en `backend/app/api/v1/endpoints/analytics.py`; `docs/performance-notes.md` actualizado.

---

### B6. M-007: Cobranzas sin filtro sucursal y con filtro/gráfico por UN

**Problema:** Mejora de UX en módulo Cobranzas (validación funcional pendiente).

**Acciones:**
- [x] Documentar criterios de aceptación y smoke manual en `docs/mejoras-pendientes-seguimiento.md`.
- [ ] Verificación en UI (legacy) y cierre de M-007 cuando se cumpla.

**Evidencia:** `docs/mejoras-pendientes-seguimiento.md`: subsección "Criterios de aceptación M-007 (Cobranzas UX)". El cierre definitivo queda pendiente de validación funcional en legacy.

---

## Resumen de prioridades

| Prioridad | Cantidad | Temas |
|-----------|----------|--------|
| Alta      | 5        | A1–A5 (login real, refresh token, demo en prod, .env en Git, cutover/ops) |
| Media     | 6        | M1–M6 (CORS, rate limit, tipado, tests, health, logging) |
| Baja      | 6        | B1–B6 (tipos/errores, agente.md, frontend prod, cobertura, cache, M-007) |

**Recomendación:** Resolver en orden A1 → A2 → A3 → A4 → A5, luego M1–M6, y finalmente B1–B6. Actualizar este documento marcando ítems y añadiendo evidencia según se cierre cada uno.
