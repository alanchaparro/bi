# Informe de auditoría QA – Cartera Cobranzas Auto

**Fecha:** 2026-02-24  
**Alcance:** Código, seguridad, CI/CD, especificación baseline y runbook.

---

## 1. Cumplimiento del spec-baseline

El archivo `docs/spec-baseline.md` tiene todos los ítems marcados como cumplidos. Se verificó la existencia de la evidencia técnica referida:

| Ítem | Estado | Notas |
|------|--------|--------|
| Auth refresh, rate limit, deps | OK | `auth_refresh.py`, `rate_limit.py`, `deps.py` presentes y usados |
| Error contract con trace_id (incl. 422) | OK | `main.py`: handlers para HTTPException y RequestValidationError |
| Migración legacy + verificación | OK | Scripts `migrate_legacy_config_to_db.py`, `verify_legacy_config_migration.py` referenciados en CI y runbook |
| Analytics v1 + export csv/pdf | OK | Endpoints en `analytics.py` |
| Preferencias usuario (filtros) | OK | `brokers.py` + migración 0004_user_preferences |
| Gates CI release | OK | `.github/workflows/release.yml` con tests, E2E, parity, smoke, frontend build |

**Conclusión:** El proyecto cumple el checklist del spec-baseline a nivel de evidencia declarada.

---

## 2. Seguridad

### 2.1 Lo que está bien

- **Frontend no accede a MySQL:** Todo pasa por API (axios a `VITE_API_BASE_URL`).
- **Validación Pydantic:** Endpoints usan schemas (LoginIn, SyncRunIn, MysqlConnectionIn, etc.).
- **Secretos en .env:** Config lee de `BaseSettings`; `.gitignore` incluye `.env` y `.env.*` (excepto `.env.example`).
- **RBAC:** `require_permission()` en brokers, analytics y sync; roles admin/analyst/viewer con permisos definidos en `ROLE_PERMISSIONS`.
- **Auth endurecida:** Refresh tokens, rotación, revoke; bloqueo por intentos fallidos (`auth_refresh`, `AUTH_MAX_FAILED_ATTEMPTS`); rate limit en login y escrituras.
- **Demo users solo en dev:** `_is_demo_allowed()` comprueba `settings.app_env == 'dev'`.
- **SQL:** Consultas MySQL en sync usan parámetros (`effective_params`) en `cursor.execute()`; hints de incremental son internos (dict `MYSQL_INCREMENTAL_HINTS`), no input de usuario.

### 2.2 Mejoras recomendadas (no bloqueantes)

1. **CORS en producción**  
   - Por defecto `CORS_ORIGINS='*'` en `config.py`. En prod debe usarse lista explícita (ya indicado en runbook).  
   - **Recomendación:** En `APP_ENV=prod`, validar en arranque que `CORS_ORIGINS != '*'` y loguear warning o fallar si sigue siendo `*`.

2. **Endpoint `/health/perf`**  
   - Expone `pg_stat_statements` (consultas SQL y tiempos). Útil para ops pero con riesgo de información sensible.  
   - **Recomendación:** Proteger con `require_permission('system:read')` o exponer solo cuando `APP_ENV != 'prod'`.

3. **Password por defecto en script de validación**  
   - `scripts/validate_incremental_sync.py`: `PASSWORD = os.getenv("SYNC_VALIDATE_PASSWORD", "admin123")`.  
   - **Recomendación:** No usar default "admin123"; usar `os.getenv("SYNC_VALIDATE_PASSWORD")` y fallar con mensaje claro si no está definido en entornos no-dev.

4. **JWT/Postgres por defecto**  
   - `config.py` usa valores por defecto como `change_me_jwt_secret`, `change_me_refresh_secret`, `''` para `postgres_password`.  
   - **Recomendación:** En `APP_ENV=prod`, validar que estos valores estén explícitamente definidos y no sean los de ejemplo.

---

## 3. Calidad de código y pruebas

### 3.1 Backend

- Tests: `tests/test_api_v1_*.py`, auth/refresh, brokers, sync, analytics, etc.
- Release workflow ejecuta `coverage run` y sube `coverage.xml` como artefacto.
- **Gap:** No hay gate que falle el pipeline si la cobertura está por debajo de un mínimo (p. ej. `coverage report --fail-under=70`). El spec menciona “Cobertura mínima acordada en CI alcanzada por gates release” pero no está implementado numéricamente.

**Recomendación:** Añadir un step en `release.yml` que ejecute `coverage report --fail-under=X` (X acordado, p. ej. 60–70) después de generar `coverage.xml`.

### 3.2 Frontend

- TypeScript, `api.ts` con tipos y cliente axios contra API.
- Tests con Vitest; Playwright para E2E.
- Release: `npm ci`, `generate:types`, `test`, `typecheck`, `build`.

### 3.3 CI

- **release.yml:** Build, tests backend, coverage, bootstrap auth, migración legacy, E2E brokers, perf smoke, parity analytics, smoke deploy, OpenAPI, frontend install/test/typecheck/build. Limpieza con `docker compose down -v`.
- **docker-ci.yml:** En PR/push usa `npm install`; release usa `npm ci`. Para consistencia y velocidad en CI, **recomendación:** usar `npm ci` también en docker-ci para el frontend.

---

## 4. Operación y documentación

- **Runbook:** `docs/runbook-prod.md` describe bootstrap, sync, rollback, perfil LAN y firewall.
- **Checklist prod:** `docs/prod-from-zero-checklist.md` con pasos claros.
- **Bootstrap:** Script `bootstrap_auth_users.py` existe y está referenciado en runbook, Makefile, `prod_bootstrap_from_zero.ps1` y release workflow.

---

## 5. Resumen de opciones de mejora

| Prioridad | Área | Acción sugerida |
|-----------|------|------------------|
| Alta | Seguridad prod | Validar en arranque (prod): CORS no `*`, JWT/refresh/DB no por defecto. |
| Alta | CI | Añadir gate de cobertura mínima en release (coverage report --fail-under). |
| Media | Seguridad | Proteger o restringir `/health/perf` (permiso o solo no-prod). |
| Media | Scripts | Quitar default "admin123" en `validate_incremental_sync.py`; exigir env en no-dev. |
| Baja | CI | Unificar frontend install a `npm ci` en docker-ci.yml. |

---

## 6. Veredicto

- **Luz verde condicionada:** El proyecto está en condiciones de dar luz verde para release **si** se asumen o resuelven las siguientes condiciones:

1. **Pre-producción obligatorio:**  
   - `.env` de producción con `CORS_ORIGINS` explícitos (no `*`).  
   - `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY` y contraseñas de DB generados/gestión segura (no valores por defecto del repo).  
   - Runbook y checklist de prod ejecutados según `docs/runbook-prod.md` y `docs/prod-from-zero-checklist.md`.

2. **Recomendado antes de siguiente release:**  
   - Implementar gate de cobertura mínima en CI.  
   - Endurecer validaciones de seguridad en arranque para `APP_ENV=prod`.  
   - Proteger o restringir `/health/perf` y eliminar default "admin123" en el script de validación.

Si las variables de entorno y el despliegue se hacen según el runbook y no se usa CORS `*` ni secretos por defecto en prod, no se identifican bloqueantes críticos que impidan dar luz verde al proyecto para el corte actual.

---

## 7. Implementación de mejoras (2026-02-24)

Se implementaron todas las opciones de mejora del informe:

| Mejora | Implementación |
|--------|----------------|
| **Validación arranque prod** | Nuevo módulo `backend/app/core/prod_check.py`: en `APP_ENV=prod` valida CORS ≠ `*`, JWT/refresh no por defecto, POSTGRES_PASSWORD y DATABASE_URL sin placeholder. Invocado en `main.py` al startup. Tests en `tests/test_prod_check.py`. |
| **Gate cobertura mínima** | En `.github/workflows/release.yml`, el step "Backend Coverage" añade `coverage report --fail-under=44` (44% = cobertura actual; el pipeline falla si baja de ese umbral; se puede subir a 50, 60, 70 al añadir tests). |
| **Proteger /health/perf** | `GET /api/v1/health/perf` requiere permiso `system:read` (admin/analyst) vía `Depends(require_permission('system:read'))` en `backend/app/api/v1/endpoints/health.py`. |
| **Script validate_incremental_sync** | Eliminado default `admin123`. En prod se exige `SYNC_VALIDATE_PASSWORD`. En dev se acepta `DEMO_ADMIN_PASSWORD` como fallback. Si falta contraseña, el script termina con mensaje claro. |
| **npm ci en Docker CI** | En `.github/workflows/docker-ci.yml`, "Frontend Install" usa `npm ci` en lugar de `npm install`. |
