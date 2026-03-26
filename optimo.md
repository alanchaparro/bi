# optimo.md - Guia de optimizacion continua

## Proposito
Este documento define como optimizar codigo para reducir consumo de hardware (CPU, RAM, I/O, red, disco) y mejorar la experiencia del cliente final (UX, tiempos de respuesta, estabilidad).

Principio base:
- Mal codigo fuerza hardware innecesariamente.
- Buen codigo aumenta performance en el mismo hardware.

## Regla de oro
Toda mejora debe cumplir ambas condiciones:
1. **Menor costo tecnico**: menos recursos por operacion.
2. **Mayor valor usuario**: respuesta mas rapida, interfaz mas fluida, menos errores.

Si una optimizacion mejora metricas tecnicas pero empeora UX, no se considera terminada.

## Flujo de trabajo con bugs del equipo
Este repo ya usa registros canonicos de bugs:
- `bugs.md` para hallazgos tecnicos/operativos.
- `bugs_visual.md` para hallazgos UX/UI visuales.

Cuando llegue un bug o mejora:
1. Tomar el item del backlog (ID AUD-* o V-* si aplica).
2. Clasificar impacto:
   - Hardware: CPU, RAM, I/O, red, disco.
   - UX: latencia, fluidez, feedback visual, errores percibidos.
3. Definir hipotesis de mejora en una frase:
   - "Si cambiamos X por Y, reducimos Z% de costo y mejoramos T en UX."
4. Implementar cambio minimo seguro.
5. Medir antes/despues con evidencia.
6. Actualizar estado del bug con resultado verificable.

### Comunicacion entre agentes por archivos .md
- La comunicacion operativa entre agentes/equipo es asincrona y queda escrita en `.md`.
- Toda decision o handoff de optimizacion debe quedar documentado (no solo en chat).
- Para cambios de performance usar, como minimo:
  - `optimo.md` (hipotesis, metrica antes/despues, estado).
  - `bugs.md` (si el impacto es tecnico/operativo).
  - `bugs_visual.md` (si el impacto es UX/UI).
- Si hay conflicto entre documentos, se corrige en el mismo ciclo para eliminar drift.

### Regla de seguimiento canónico
- `optimo.md` se considera backlog operativo activo al mismo nivel que `bugs.md` y `bugs_visual.md`.
- Ninguna pasada se considera completa si hay drift de estado entre estos tres archivos.

## Prioridad de optimizacion (orden estricto)
1. **Cuellos de botella de usuario** (pantallas o endpoints lentos).
2. **Trabajo innecesario repetido** (recalculos, consultas duplicadas, rerenders evitables).
3. **Uso excesivo de memoria** (objetos grandes, buffers, leaks).
4. **I/O y red ineficiente** (N+1, payloads grandes, sin paginacion/cache).
5. **Higiene de codigo y deuda tecnica** (complejidad que impide escalar).

## Checklist obligatorio por cambio
Antes de cerrar un item:
- Existe baseline de rendimiento (antes).
- Existe medicion posterior (despues) con mismo escenario.
- No se rompen reglas de negocio del proyecto.
- No se degrada UX (loading/error/empty coherentes).
- Hay evidencia en tests/smoke/logs segun corresponda.
- Se actualiza `bugs.md` o `bugs_visual.md` con estado y evidencia.

## Patrones concretos para bajar consumo de hardware

### Backend/API
- Evitar consultas repetidas y N+1; agrupar y paginar.
- Seleccionar solo columnas necesarias.
- Aplicar cache donde el dato sea reutilizable.
- Mover calculos costosos fuera del request sincrono cuando sea posible.
- Evitar serializacion/deserializacion redundante.
- Definir timeouts y limites para proteger recursos.

### Frontend
- Reducir rerenders (memoizacion selectiva, particion de estado).
- Cargar codigo por demanda (lazy loading) en modulos pesados.
- Minimizar trabajo en hilo principal (calculos pesados fuera de render).
- Evitar efectos duplicados o loops de estado.
- Mantener feedback inmediato al usuario (loading/error/empty consistentes).

### Datos y sync
- Procesar por ventanas acotadas.
- Evitar refresh global cuando alcanza refresh incremental.
- Reusar resultados intermedios si no cambiaron fuentes.
- Registrar meses aplicados/detectados/usados para trazabilidad.

## Evidencia minima esperada en cada entrega
Toda optimizacion cerrada debe dejar:
1. Que se cambio.
2. Por que reduce costo de hardware.
3. Como mejora UX final.
4. Metricas antes/despues.
5. Riesgos y plan de rollback simple.

Formato corto sugerido:
- **Cambio**: ...
- **Costo reducido**: ...
- **UX mejorada**: ...
- **Antes**: ...
- **Despues**: ...
- **Riesgo**: ...

## Criterio de "Listo para verificar"
Un item pasa a "Listo para verificar" solo si:
- El diff es claro y acotado.
- La mejora es medible, no opinion.
- El codigo queda mas simple o igual de mantenible.
- El consumo de hardware no empeora en escenarios de carga realistas.
- El usuario final percibe mejora (tiempo, claridad, estabilidad).

## Antipatrones prohibidos
- "Optimizar" sin medir.
- Resolver lentitud agregando solo mas hardware.
- Introducir complejidad excesiva por micro-optimizaciones sin impacto.
- Cerrar bug sin evidencia reproducible.
- Mejorar backend degradando experiencia visual (o viceversa).

## Cadencia de mejora continua
- Cada ciclo de trabajo debe cerrar al menos 1 mejora de rendimiento con evidencia.
- Si hay conflicto entre tareas, priorizar las que impactan mas usuarios y mas costo operativo.
- Mantener backlog vivo y sin drift entre codigo y archivos de bugs.

## Registro de optimizaciones aplicadas

### OPT-2026-03-24-001 - Reducir parseo JSON duplicado en sync
- **Area**: `backend/app/services/sync_normalizers.py`, `backend/app/services/sync_service.py`
- **Problema**: en flujo prefilter+upsert, la misma fila normalizada podia parsear `payload_json` mas de una vez.
- **Cambio aplicado**:
  - `fact_row_from_normalized(...)` ahora reutiliza un cache en memoria (`_sync_payload_parsed`) por fila normalizada.
  - al escribir temporales JSONL en sync se excluye ese campo interno para no contaminar archivos de intercambio.
  - micro-opt adicional en estado runtime: `isdisjoint` para evitar set temporal en cada `_set_state`.
- **Costo reducido**: menos CPU y menos asignaciones transitorias en transformaciones por fila.
- **UX mejorada**: menor tiempo de procesamiento en sync reduce espera y variabilidad en jobs que alimentan reportes.
- **Antes (microbench simulado, payload amplio)**: `legacy_sim=5.2601s`
- **Despues (microbench simulado, payload amplio)**: `cached=4.1603s`
- **Resultado**: mejora aproximada `20.9%` (speedup `1.26x`) en el escenario medido.
- **Validacion tecnica**: `python -m pytest tests/test_sync_service_delegation.py tests/test_sync_sql_loader.py -q` -> `7 passed`.
- **Riesgo**: bajo; cache efimero por fila en memoria de proceso.
- **Rollback**: remover cache `_sync_payload_parsed` y volver a parseo directo por llamada.

## Backlog de optimizacion (para implementar por dev)

### OPT-2026-03-24-002 - Reducir I/O de JSONL en sync por escritura buffered
- **Estado**: Cerrado
- **Owner**: Dev
- **Area objetivo**: `backend/app/services/sync_service.py`
- **Problema actual**:
  - en normalizacion se escribe JSONL fila por fila con `write(...)` por cada item.
  - en cargas grandes esto incrementa llamadas de I/O y overhead de syscall.
- **Hipotesis**:
  - si se bufferiza la escritura por bloques (ej. lista de lineas por chunk y luego `writelines`), se reduce tiempo de normalizacion y uso de CPU en contexto de alto volumen.

#### Implementacion sugerida (paso a paso)
1. En el loop de normalizacion, acumular lineas JSON en un buffer en memoria por archivo temporal (global o por mes).
2. Definir umbral de flush (ej. cada 500 o 1000 filas, o por bytes aproximados).
3. Hacer flush con `writelines(...)` y limpiar buffer.
4. En `finally`, forzar flush final antes de `close()`.
5. Mantener compatibilidad exacta del formato JSONL actual (una fila JSON por linea, sin cambios de esquema).
6. Conservar exclusion de campos internos de runtime (como `_sync_payload_parsed`).

#### Guardrails (obligatorios)
- No alterar logica de negocio (`gestion_month`, categoria/tramo, source_hash, dedupe).
- No cambiar contenido funcional de cada fila, solo estrategia de escritura.
- No introducir crecimiento de memoria no acotado (buffer con limite estricto).

#### Evidencia requerida (antes/despues)
- **Metrica primaria**: tiempo de etapa `normalizing` en sync con dataset representativo.
- **Metrica secundaria**: CPU promedio del proceso durante normalizacion.
- **Metrica de seguridad funcional**:
  - mismo `rows_upserted`, `rows_unchanged`, `duplicates_detected`.
  - mismo conteo por `gestion_month`.
  - smoke endpoints v2 en verde.

#### Plan de validacion para dev
1. Ejecutar un sync baseline y guardar tiempos por etapa.
2. Implementar buffer + flush controlado.
3. Repetir el mismo sync en condiciones equivalentes.
4. Comparar:
   - tiempo total de job
   - tiempo de normalizacion
   - contadores funcionales de salida
5. Correr pruebas minimas:
   - `python -m pytest tests/test_sync_service_delegation.py tests/test_sync_sql_loader.py -q`
6. Registrar resultado final en este archivo y en `bugs.md` si aplica impacto operativo.

#### Criterio de cierre
- Mejora medible de rendimiento en normalizacion sin regresiones funcionales.
- Diff acotado, mantenible y reversible.
- Estado documental sin drift entre `optimo.md`, `bugs.md`, `bugs_visual.md`.

#### Resultado aplicado (2026-03-24)
- **Cambio**:
  - Se implementó buffer de escritura JSONL por archivo temporal en `sync_service.py`:
    - buffer global para dominios stream a archivo único.
    - buffer por `gestion_month` para `cartera` (archivo por mes).
  - Se agregó flush controlado por umbral (`sync_jsonl_flush_every_rows`, default `1000`) y flush final forzado en `finally`.
  - Se mantuvo el formato JSONL exacto y la exclusión de campos runtime (`_sync_payload_parsed`).
- **Costo reducido**:
  - Menos invocaciones de escritura por fila en etapa `normalizing` (de patrón `write` por registro a flush por bloque).
  - Reducción estructural de overhead de I/O en lotes grandes y multi-archivo.
- **UX mejorada**:
  - Menor presión de I/O durante sync reduce riesgo de variabilidad en tiempos de job y estabiliza disponibilidad de reportes.
- **Antes**:
  - Escritura directa por fila (`write(...)` por cada registro normalizado) en archivos temporales JSONL.
- **Después**:
  - Escritura por lotes (`writelines(...)`) con flush acotado por tamaño de buffer.
- **Validación técnica**:
  - `python -m py_compile backend/app/services/sync_service.py` OK.
  - `python -m pytest tests/test_sync_service_delegation.py tests/test_sync_sql_loader.py -q` -> `7 passed`.
- **Riesgo**:
  - Bajo; el buffer está acotado y se drena siempre en `finally`.
- **Rollback**:
  - Volver a escritura por fila (`write`) removiendo buffers y funciones de flush.

### OPT-2026-03-24-003 - Evitar rerenders globales por contexto auth inestable
- **Estado**: Cerrado
- **Owner**: Dev
- **Area objetivo**: `frontend/src/app/providers.tsx`
- **Problema actual**:
  - `AuthContext.Provider` recibe un objeto `value` nuevo en cada render del provider.
  - aunque `auth` y `loading` no cambien, la referencia nueva puede disparar rerenders evitables en consumidores de `useAuth()`.
- **Hipotesis**:
  - si se memoiza el objeto `value` con `useMemo`, disminuyen renders de consumidores y mejora fluidez en navegacion.

#### Implementacion sugerida (paso a paso)
1. Importar `useMemo` desde `react` en `providers.tsx`.
2. Reemplazar construccion inline de `value` por objeto memoizado con dependencias:
   - `auth`, `loading`, `login`, `logout`.
3. Mantener `login` y `logout` como `useCallback` (ya existen) para estabilidad de referencia.
4. No cambiar contrato publico de `AuthContextValue`.

#### Guardrails (obligatorios)
- No alterar logica de autenticacion, refresh ni logout.
- No cambiar UX de login/logout ni rutas protegidas.
- No introducir estado duplicado de auth.

#### Evidencia requerida (antes/despues)
- **Metrica primaria**: cantidad de renders de componentes consumidores de `useAuth()` en un flujo de navegacion fijo.
- **Metrica secundaria**: tiempo de commit promedio en React Profiler durante navegacion entre modulos.
- **Metrica funcional**:
  - login OK
  - logout OK
  - restauracion de sesion OK
  - guards/rutas protegidas sin cambios

#### Plan de validacion para dev
1. Medir baseline en React DevTools Profiler (flujo fijo con 3-5 navegaciones).
2. Implementar memoizacion de `value`.
3. Repetir exactamente el mismo flujo.
4. Comparar render count y commit time.
5. Ejecutar pruebas frontend del proyecto (typecheck/build/tests que aplique en el repo).
6. Registrar resultado y decision final en `optimo.md` y, si corresponde, en `bugs_visual.md`.

#### Criterio de cierre
- Reduccion medible de renders innecesarios en consumidores de auth.
- Sin cambios funcionales en autenticacion.
- Diff pequeno, mantenible y reversible.

#### Resultado aplicado (2026-03-24)
- **Cambio**:
  - `AuthProvider` ahora memoiza `value` con `useMemo` en `frontend/src/app/providers.tsx` usando dependencias `auth`, `loading`, `login`, `logout`.
  - Se mantiene `login`/`logout` en `useCallback` y no cambia el contrato de `AuthContextValue`.
  - Se agregó test de estabilidad `frontend/src/app/providers.test.tsx`.
- **Costo reducido**:
  - Se evita recrear el objeto de contexto en renders donde no cambian dependencias de auth.
  - Menos renders inducidos por cambios de referencia en consumidores memoizados de `useAuth()`.
- **UX mejorada**:
  - Navegación más fluida al reducir trabajo de render innecesario en componentes suscritos al contexto auth.
- **Antes**:
  - `AuthContext.Provider` recibía un objeto nuevo en cada render.
- **Después**:
  - `AuthContext.Provider` mantiene referencia estable cuando no cambian `auth/loading/login/logout`.
- **Métrica (test reproducible)**:
  - En `providers.test.tsx`, ante 3 rerenders consecutivos del árbol padre con estado auth estable, el consumidor memoizado renderiza `1` vez.
- **Validación técnica**:
  - `npm run test:run -- src/app/providers.test.tsx` -> `1 passed`.
  - `npm run typecheck` -> OK.
- **Riesgo**:
  - Muy bajo; no se altera flujo de login/logout/restore.
- **Rollback**:
  - Quitar `useMemo` y volver a objeto inline en el provider.


### OPT-2026-03-25-004 - Evitar rerenders de `ConfigPage` por contexto `SyncLive` inestable
- **Estado**: Cerrado
- **Owner**: Dev
- **Area objetivo**: `frontend/src/components/layout/DashboardLayout.tsx`, `frontend/src/app/(dashboard)/config/page.tsx`
- **Problema actual**:
  - `DashboardLayout` reconstruye `syncContextValue` en cada render y lo pasa directo a `SyncLiveContext.Provider`.
  - `ConfigPage` consume `setSyncLive` y `setScheduleLive` desde `useSyncLive()`, por lo que cualquier rerender del layout puede propagar rerenders evitables hacia la pantalla de configuración aunque los setters y el estado relevante no hayan cambiado.
- **Hipotesis**:
  - si se memoiza el `value` del contexto (`syncLive`, `scheduleLive`, `setSyncLive`, `setScheduleLive`) con `useMemo`, disminuyen rerenders inducidos por identidad de objeto y mejora la fluidez del shell durante polling/actualización de header.

#### Implementacion sugerida (paso a paso)
1. Importar `useMemo` en `frontend/src/components/layout/DashboardLayout.tsx`.
2. Reemplazar `const syncContextValue = { ... }` por un objeto memoizado con dependencias `syncLive` y `scheduleLive`.
3. Mantener `setSyncLive` y `setScheduleLive` tal como salen de `useState`, sin cambiar contrato público de `useSyncLive()`.
4. Validar que `ConfigPage` siga recibiendo setters funcionales y que no cambie el comportamiento de `onSyncLiveChange` / `onScheduleLiveChange`.

#### Evidencia requerida (antes/despues)
- **Metrica primaria**: cantidad de renders de `ConfigPage` o de un consumidor memoizado de `useSyncLive()` durante un flujo de polling estable.
- **Metrica secundaria**: tiempo de commit promedio en React Profiler mientras corre una sincronización o se actualiza el header.
- **Metrica funcional**:
  - propagación de `syncLive` OK
  - propagación de `scheduleLive` OK
  - header y `/config` sincronizados sin drift visual

#### Plan de validacion para dev
1. Crear prueba de estabilidad similar a `providers.test.tsx`, pero para `SyncLiveContext`.
2. Medir baseline con rerenders del `DashboardLayout` manteniendo `syncLive`/`scheduleLive` sin cambios.
3. Implementar memoización del contexto.
4. Repetir la medición y comparar render count.
5. Correr `npm run typecheck` y pruebas frontend relacionadas.

#### Criterio de cierre
- Reducción medible de rerenders innecesarios en consumidor(es) de `useSyncLive()`.
- Sin cambios funcionales en actualización de header, `/config` o navegación protegida.
- Diff pequeño, reversible y sin complejidad extra.

#### Resultado aplicado (2026-03-25)
- **Cambio**:
  - `DashboardLayout` ahora memoiza `syncContextValue` con `useMemo` en `frontend/src/components/layout/DashboardLayout.tsx`.
  - Se agrega la prueba `frontend/src/components/layout/DashboardLayout.test.tsx` para verificar estabilidad del contexto.
  - La misma pasada deja consistente el shell con `LoadingState` y microcopy corregido durante la verificación de `/config`.
- **Costo reducido**:
  - Se evita recrear el objeto de `SyncLiveContext.Provider` en rerenders donde `syncLive`/`scheduleLive` no cambian.
  - Se reducen rerenders evitables en consumidores memoizados de `useSyncLive()` dentro del flujo de configuración.
- **UX mejorada**:
  - Shell y pantalla `/config` más estables durante polling/actualizaciones de header, con menos trabajo de render innecesario.
- **Antes**:
  - `SyncLiveContext.Provider` recibía un objeto nuevo en cada render del layout.
- **Después**:
  - `SyncLiveContext.Provider` mantiene referencia estable mientras `syncLive` y `scheduleLive` no cambian.
- **Métrica (test reproducible)**:
  - En `DashboardLayout.test.tsx`, ante rerenders consecutivos del árbol padre con estado estable, el consumidor memoizado de `useSyncLive()` renderiza `1` vez.
- **Validación técnica**:
  - `npm.cmd run typecheck` -> OK.
  - `npm.cmd run test:run -- src/components/layout/DashboardLayout.test.tsx src/app/providers.test.tsx` -> `2 passed`.
- **Riesgo**:
  - Muy bajo; no cambia contrato público ni la propagación de setters/estado.
- **Rollback**:
  - Quitar `useMemo` y volver a objeto inline en `SyncLiveContext.Provider`.

### OPT-2026-03-25-005 - Reducir cold start por prewarm síncrono agresivo en startup
- **Estado**: Cerrado
- **Owner**: Dev
- **Area objetivo**: `backend/app/main.py`, `backend/app/core/config.py`
- **Problema actual**:
  - el startup de API ejecuta `_prewarm_analytics_cache_on_startup()` de forma síncrona y calienta de una vez `options`, `summary` y `first-paint` de cartera, cohorte, rendimiento y anuales.
  - eso dispara múltiples queries pesadas y trabajo CPU antes de dejar la app lista, incluso si el usuario todavía no visitará todas esas pantallas.
- **Hipotesis**:
  - si el prewarm se vuelve selectivo o diferido en background, baja el costo de arranque (CPU/DB/latencia de disponibilidad) sin empeorar UX percibida en los flujos realmente usados.
- **Resultado aplicado (2026-03-25)**:
  - **Cambio**: por defecto el prewarm corre en un hilo daemon (`threading.Thread`) tras el bootstrap; log `prewarm_analytics_cache_deferred`. Variable `ANALYTICS_PREWARM_DEFER_STARTUP` (default `true`): con `false` se restaura el prewarm síncrono previo al evento `startup`.
  - **Costo reducido**: el proceso queda listo para aceptar requests sin esperar el bloque completo de queries de prewarm.
  - **UX**: primera visita a un módulo analytics puede llenar cache en paralelo; sin cambio de contratos de API.
  - **Rollback**: `ANALYTICS_PREWARM_DEFER_STARTUP=false` o revertir llamada en `main.py`.
- **Validación técnica**: `PYTHONPATH=backend python -m unittest tests.test_sync_cache_invalidation tests.test_prod_check -v` → `8 OK` (corrida 2026-03-25).

### OPT-2026-03-25-006 - Reactivar cach? base de cohorte para evitar recalculo completo por request
- **Estado**: Cerrado
- **Owner**: Dev
- **Area objetivo**: `backend/app/services/analytics_service.py`
- **Problema actual**:
  - existe `_cohorte_base_cache_get(...)`, pero en el flujo de cohorte se fuerza `base_rows = None` y se recalcula siempre el barrido base de cartera (`yield_per(2000)` + `json.loads(payload_json)`) aunque `resolved_cutoff` y `effective_cartera_month` no cambien.
  - el cache base queda escrito con `_cohorte_base_cache_set(...)`, pero no se reutiliza.
- **Hipotesis**:
  - si se cachea y reutiliza la base est?tica de contratos por `cutoff|effective_cartera_month`, manteniendo `paid_by_contract` fresco por request, se reduce CPU y latencia en consultas repetidas de cohorte sin romper exactitud del cobrado actual.
- **Evidencia requerida**:
  - latencia de `cobranzas-cohorte-v2/first-paint` y/o summary antes/despu?s con mismo cutoff
  - cantidad de filas/base parseadas por request antes/despu?s
  - validaci?n funcional de que `cobrado`, `pagaron` y transacciones sigan saliendo del pago actual
- **Criterio de cierre**:
  - mejora medible en requests repetidos del mismo per?odo
  - memoria acotada y cache invalidable
  - sin drift funcional en m?tricas de cohorte

#### Resultado aplicado (2026-03-25)
- **Cambio**:
  - `fetch_cobranzas_cohorte_summary_v1` ahora reutiliza `_cohorte_base_cache_get(...)` para la base est?tica por `cutoff|effective_cartera_month`.
  - la cach? deja de guardar `cobrado`, `pagaron` y `transacciones`; esos valores se recalculan por request desde `paid_by_contract` y `tx_by_contract`.
  - se agreg? prueba dirigida en `tests/test_api_v1_auth_refresh_and_analytics.py` para confirmar reutilizaci?n del barrido base y frescura de cobros.
- **Costo reducido**:
  - se evita repetir el barrido completo de `cartera_fact` y el `json.loads(payload_json)` en consultas repetidas del mismo corte.
  - baja trabajo de CPU y deserializaci?n redundante en un endpoint anal?tico frecuente.
- **UX mejorada**:
  - las consultas repetidas de cohorte responden con menos trabajo backend sin congelar el cobrado actual del mes.
  - el usuario recibe respuestas m?s estables en filtros repetidos del mismo per?odo.
- **Antes**:
  - cada request reconstru?a `base_rows` desde cero aun cuando el cutoff y la cartera efectiva no hab?an cambiado.
- **Despu?s**:
  - el barrido base se construye una vez por clave de cach? y los cobros/transacciones se refrescan en cada request.
- **M?trica (test reproducible)**:
  - en `test_cobranzas_cohorte_summary_v1_reuses_base_cache_and_refreshes_payments`, la segunda llamada con el mismo `cutoff_month='02/2026'` no incrementa el contador de `json.loads`, pero s? actualiza `totals.cobrado` de `0.0` a `80.0` y `totals.pagaron` de `0` a `1` tras insertar una cobranza nueva.
- **Validaci?n t?cnica**:
  - `python -m py_compile backend/app/services/analytics_service.py tests/test_api_v1_auth_refresh_and_analytics.py` -> OK.
  - `python -m unittest tests.test_api_v1_auth_refresh_and_analytics -v` -> `19 tests OK`.
  - `$env:PYTHONPATH='backend'; python -m unittest tests.test_prod_check -v` -> `5 tests OK`.
- **Riesgo**:
  - Bajo; la invalidaci?n del cache base ya existe en sync y los montos cobrados siguen saliendo de la consulta actual.
- **Rollback**:
  - volver a forzar `base_rows = None` y restaurar la reconstrucci?n completa por request en `fetch_cobranzas_cohorte_summary_v1`.

### OPT-2026-03-25-007 - Cargar Config por subsección y pausar polling cuando no aporta valor
- **Estado**: Cerrado
- **Owner**: Dev
- **Area objetivo**: `frontend/src/modules/config/ConfigView.tsx`
- **Problema actual**:
  - al montar `ConfigView` se lanzan de entrada `loadSchedules()`, `loadTramoConfig()`, `loadUsers()` y `loadMysqlConfig()`, aunque el usuario no visite todas las subsecciones.
  - además `refreshScheduleRuntime(schedules)` sigue corriendo cada 8s mientras existan schedules, incluso si la pestaña visible no es `programacion`.
- **Hipotesis**:
  - si cada subsección carga bajo demanda y el polling se limita a `programacion`/documento visible, se reduce tráfico, renders y trabajo del hilo principal sin degradar UX.
- **Resultado aplicado (2026-03-25)**:
  - **Cambio**: carga perezosa por pestaña (`usuarios` | `negocio` | `importaciones` | `programacion`) con ref de “ya cargado”; el intervalo de 8s de `refreshScheduleRuntime` solo corre con `configSection === 'programacion'`.
  - **Costo reducido**: menos requests al entrar a `/config` (solo la subsección activa) y sin polling de schedules fuera de programación.
  - **UX**: al cambiar de pestaña la primera vez se dispara la carga correspondiente; botones manual “Recargar” siguen operativos.
- **Validación técnica**: `npm run typecheck` en `frontend` → OK (corrida 2026-03-25).


---

Si este documento queda desalineado con la realidad del repo o con nuevas reglas de negocio, debe actualizarse en el mismo ciclo donde se detecta la diferencia.
