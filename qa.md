# qa.md — Registro canónico de QA

## Uso
- `qa`: ejecutar validación tipo usuario final, dejar evidencia y estado por flujo.
- `verifica`: revalidar una corrección y registrar si el flujo pasa o falla.

## Instrucciones para QA
1. Leer `AGENTS.md`.
2. Leer `qa.md`, `bugs.md`, `bugs_visual.md` y `optimo.md`.
3. Si el flujo toca frontend analytics, routing o layout, validar también `desacople.md`.
4. Registrar cada corrida con:
   - fecha
   - scope
   - entorno
   - flujos probados
   - resultado (`Pasa`, `Pasa con reservas`, `Falla`, `Bloqueado`)
   - evidencia
5. Si aparece un problema:
   - técnico/operativo -> `bugs.md`
   - visual/UX -> `bugs_visual.md`
   - performance/hardware/fluidez -> `optimo.md`
6. No dejar cierres ni aperturas sólo en conversación.

## Estado actual
- Corrida vigente `2026-03-26 | importacion-comprador-e2e`: `Bloqueado` en verificación del agente (sin API en `:8000`); **PEND-06** cerrado en producto (copy de progreso en `ConfigView`); PNG de resultado final sigue siendo opcional con stack levantado: `importacion-comprador.spec.ts`.
- Corrida vigente `2026-03-26 | importaciones-config-e2e`: `Pasa` ( **PEND-05** cierre; `importaciones-config.spec.ts` + `pendientes-evidencia.spec.ts` con `E2E_BASE_URL=http://localhost:3000` → **3** tests Playwright OK; typecheck + Vitest OK).
- Corrida vigente `2026-03-26 | ejecutador-pendientes-experiencia-cliente`: `Pasa` (cierre **PEND-2026-03-26-02/03/04**; `npm run typecheck` y `npm run test:run` en `frontend` → **13** tests OK).
- Corrida vigente `2026-03-26 | ejecutador-regresion-automatizada`: `Pasa` (inventario `bugs.md` / `bugs_visual.md` / `optimo.md` sin AUD/V/OPT abiertos; **`pendientes.md`** backlog **Ninguno**; `python -m unittest discover -s tests -p 'test_*.py'` → **85** OK; `npm run typecheck` en `frontend` → OK).
- Corrida vigente `2026-03-25 | smoke-e2e-frontend`: `Pasa con reservas`.
- Corrida vigente `2026-03-25 | verify-login-rate-limit-fix`: `Falla`.
- Corrida vigente `2026-03-25 | verify-login-rate-limit-fix-restart`: `Pasa con reservas`.
- Corrida vigente `2026-03-25 | qa-suite-stable-after-selectors-fix`: `Pasa`.

### 2026-03-26 | importacion-comprador-e2e
- Scope: ejecutar importación **solo Cartera** (un mes) y capturar resultado; registro voz **comprador** en `pendientes.md`.
- Entorno: verificación agente sin API local en `:8000` → **Bloqueado** para evidencia PNG final.
- Resultado: `Bloqueado` (entorno); mitigación UX **PEND-06** implementada en `ConfigView` (mensaje 0 % / **Últ. actualización**).
- Evidencia: `frontend/e2e/importacion-comprador.spec.ts`; `frontend/src/modules/config/ConfigView.tsx`.

### 2026-03-26 | importaciones-config-e2e
- Scope: flujo **Config → Importaciones** con botones «Seleccionar todos» / «Solo Analytics»; alineación captura usuario `8080` con pruebas reproducibles.
- Entorno: Windows; Playwright Chromium + API vía `playwright.config.ts` (`3000`).
- Resultado: `Pasa`
- Evidencia: `npx playwright test importaciones-config.spec.ts pendientes-evidencia.spec.ts` → 3 OK.
- Hallazgos: ninguno técnico escalado a `bugs.md`.

### 2026-03-26 | ejecutador-pendientes-experiencia-cliente
- Scope: handoff **experiencia-cliente** → **ejecutador** (`pendientes.md` PEND-02/03/04); navegación y copy analytics cartera.
- Entorno: Windows; `frontend` Next.
- Flujos probados: `npm run typecheck`; `npm run test:run` (Vitest); ajuste mock `ButtonGroup` en `AnalisisRendimientoView.test.tsx` (regresión SegmentedControl).
- Resultado: `Pasa`
- Evidencia: typecheck OK; 13 tests Vitest OK.
- Hallazgos: ninguno escalado; `pendientes.md` backlog **Ninguno** tras cierres documentados.

### 2026-03-26 | ejecutador-regresion-automatizada
- Scope: cumplimiento skill ejecutador (inventario + regresión tras cierres AUD/V/PEND recientes).
- Entorno: Windows; Python 3.14 contra SQLite de tests; `frontend` Next (typecheck sólo en esta pasada).
- Flujos probados: descubrimiento `unittest` en `tests/`; typecheck TypeScript.
- Resultado: `Pasa`
- Evidencia: `PYTHONPATH=backend python -m unittest discover -s tests -p 'test_*.py' -q` → Ran 85 tests OK; `npm run typecheck` (cwd `frontend`) OK.
- Hallazgos derivados: ninguno; sin aperturas en `bugs.md` / `bugs_visual.md` / `optimo.md` / `pendientes.md`.
- Drift check: alineado con backlogs **Ninguno** en canónicos operativos.

### 2026-03-25 | smoke-e2e-frontend
- Scope: login, continuidad de sesión, navegación principal, analytics base, configuración y menú móvil.
- Entorno: frontend Next en `http://localhost:3000` con Playwright Chromium; API `api-v1` levantada por `playwright.config.ts`.
- Flujos probados:
  - login válido
  - login inválido
  - navegación a cartera, anuales, rendimiento, cobranzas corte y configuración
  - carga base de filtros/resumen en análisis de cartera
  - toggle/menu móvil
- Resultado: `Pasa con reservas`
- Evidencia:
  - `npm.cmd run test:e2e -- e2e/login.spec.ts` -> `3 passed`
  - `npm.cmd run test:e2e -- e2e/menu.spec.ts e2e/analisis-cartera-filtros.spec.ts e2e/secciones.spec.ts` -> `11 passed`, `2 flaky`, `1 failed`
  - Bloqueo inicial resuelto para QA real: instalación de navegador con `npx.cmd playwright install chromium`
  - Evidencia local en `frontend/playwright-report/index.html` y `frontend/test-results/**/trace.zip`
- Hallazgos derivados:
  - `AUD-2026-03-25-42` abierto en `bugs.md` por rate limit de login demasiado agresivo para corridas/reintentos seguidos en entorno dev/QA (`429 Demasiadas solicitudes` tras múltiples logins en la misma ventana).
  - Sin V-* nuevos abiertos en esta pasada; el fallo del caso móvil quedó clasificado como evidencia insuficiente para reabrir UX sin una reproducción más fuerte en navegador manual.
- Drift check:
  - `qa.md` alineado con `bugs.md`
  - sin cambios necesarios en `bugs_visual.md`
  - sin cambios necesarios en `optimo.md`

### 2026-03-25 | verify-login-rate-limit-fix
- Scope: revalidar `AUD-2026-03-25-42` despues del ajuste backend de rate limit login.
- Entorno: frontend Next en `http://localhost:3000` via Playwright `webServer`; backend vivo en `http://localhost:8000`.
- Flujos probados:
  - login repetido a traves de `menu.spec.ts`, `analisis-cartera-filtros.spec.ts` y `secciones.spec.ts`
  - navegacion a configuracion, anuales y cobranzas corte
  - menu movil
- Resultado: `Falla`
- Evidencia:
  - `python -m unittest tests.test_api_v1_auth_refresh_and_analytics -v` => `17 tests OK`
  - `python -m unittest tests.test_prod_check -v` => `5 tests OK`
  - `npm.cmd run test:e2e -- e2e/menu.spec.ts e2e/analisis-cartera-filtros.spec.ts e2e/secciones.spec.ts` => `10 passed`, `3 flaky`, `1 failed`
  - la traza `frontend/test-results/secciones-Todas-las-seccio-b9bea-alisis-Anuales-pagina-carga-chromium/error-context.md` sigue mostrando alerta `Demasiadas solicitudes`
- Hallazgos derivados:
  - no se abre un AUD nuevo; se mantiene `AUD-2026-03-25-42` en `bugs.md` como `Listo para verificar`
  - la evidencia sugiere que el runtime backend activo no fue reiniciado con el fix, por lo que la verificacion final requiere restart del proceso/stack en `:8000`
- Drift check:
  - `qa.md` alineado con `bugs.md`
  - sin cambios necesarios en `bugs_visual.md`
  - sin cambios necesarios en `optimo.md`

### 2026-03-25 | verify-login-rate-limit-fix-restart
- Scope: confirmar cierre real de `AUD-2026-03-25-42` sobre el runtime Docker activo y detectar remanentes E2E fuera del login.
- Entorno: `api-v1` Docker reiniciado en `http://localhost:8000`; frontend Next en `http://localhost:3000`; Playwright Chromium.
- Flujos probados:
  - 12 logins seguidos contra `/api/v1/auth/login`
  - suite `menu.spec.ts`, `analisis-cartera-filtros.spec.ts`, `secciones.spec.ts`
- Resultado: `Pasa con reservas`
- Evidencia:
  - `docker compose restart api-v1`
  - `python -m unittest tests.test_api_v1_auth_refresh_and_analytics -v` => `18 tests OK`
  - `python -m unittest tests.test_prod_check -v` => `5 tests OK`
  - ráfaga de login real contra `http://localhost:8000/api/v1/auth/login` => `12/12` respuestas `200`
  - `npm.cmd run test:e2e -- e2e/menu.spec.ts e2e/analisis-cartera-filtros.spec.ts e2e/secciones.spec.ts` => `12 passed`, `1 flaky`, `1 failed`
- Hallazgos derivados:
  - `AUD-2026-03-25-42` queda resuelto y pasa a `Cerrado` en `bugs.md`
  - se abre `AUD-2026-03-25-43` por remanentes E2E no relacionados al login: navegación `Configuración` flaky y caso móvil del menú
- Drift check:
  - `qa.md` alineado con `bugs.md`
  - sin cambios necesarios en `bugs_visual.md`
  - sin cambios necesarios en `optimo.md`

### 2026-03-25 | qa-suite-stable-after-selectors-fix
- Scope: cerrar remanentes E2E de `AUD-2026-03-25-43` tras ajustar selectores al layout canónico del frontend nuevo.
- Entorno: frontend Next en `http://localhost:3000`; backend `api-v1` Docker en `http://localhost:8000`; Playwright Chromium.
- Flujos probados:
  - navegación a configuración desde sidebar
  - apertura/cierre del menú móvil
  - batería completa `menu.spec.ts`, `analisis-cartera-filtros.spec.ts`, `secciones.spec.ts`
- Resultado: `Pasa`
- Evidencia:
  - `npm.cmd run typecheck` => `OK`
  - `npm.cmd run test:e2e -- e2e/secciones.spec.ts -g "Menu desplegable movil: abrir y cerrar"` => `1 passed`
  - `npm.cmd run test:e2e -- e2e/menu.spec.ts e2e/analisis-cartera-filtros.spec.ts e2e/secciones.spec.ts` => `14 passed`
- Hallazgos derivados:
  - `AUD-2026-03-25-43` pasa a `Cerrado` en `bugs.md`
  - sin nuevos `AUD-*`, `V-*` ni `OPT-*`
- Drift check:
  - `qa.md` alineado con `bugs.md`
  - sin cambios necesarios en `bugs_visual.md`
  - sin cambios necesarios en `optimo.md`

## Plantilla de corrida
### YYYY-MM-DD | Nombre corto de la corrida
- Scope:
- Entorno:
- Flujos probados:
- Resultado:
- Evidencia:
- Hallazgos derivados:
- Drift check:

## Historial
- 2026-03-25 | Se crea `qa.md` como canónico para corridas QA con evidencia y escalamiento a `bugs.md`, `bugs_visual.md` y `optimo.md`.
- 2026-03-25 | Primera corrida real de QA de usuario: login E2E en verde (`3 passed`), suite ampliada con `11 passed`, `2 flaky`, `1 failed`; se abre `AUD-2026-03-25-42` por `429 Demasiadas solicitudes` en login bajo reintentos seguidos.
- 2026-03-25 | Revalidacion post-fix de `AUD-2026-03-25-42`: backend tests en verde, pero Playwright contra el stack vivo todavia muestra `Demasiadas solicitudes`; queda pendiente reiniciar backend y rerun QA sobre runtime actualizado.
- 2026-03-25 | Revalidación post-restart: `AUD-2026-03-25-42` queda cerrado con `12/12` logins reales sin `429` y rerun Playwright sin rate limit; se abre `AUD-2026-03-25-43` por remanentes E2E de navegación/config y menú móvil.
- 2026-03-25 | Cierre de `AUD-2026-03-25-43`: la suite Playwright se alinea al layout canónico y queda estable (`14 passed`), sin remanentes E2E abiertos en este frente.
- 2026-03-26 | **Ejecutador**: corrida `ejecutador-regresion-automatizada` (detalle bajo *Estado actual*); canónicos sin backlog abierto.
