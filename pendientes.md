# pendientes.md — Voz del cliente ejecutivo (experiencia de uso)

## Propósito

Registrar **cómo percibe la aplicación un directivo o comprador que toma decisiones con datos**, **sin conocimiento técnico**: qué no entiende, qué le falta, qué se ve confuso o poco profesional, y si la **lógica visible** respeta el negocio canónico (**`AGENTS.md`**, **`desacople.md`**, specs de UI).

Este archivo es **handoff al dev**: hallazgos en **primera persona / voz usuario** + evidencia (capturas cuando existan) + vínculo con reglas de negocio.

No sustituye a `bugs.md` (AUD-*), `bugs_visual.md` (V-*) ni `optimo.md`; **complementa** la capa “¿qué diría el cliente en la sala de juntas?”.

## Cómo usarlo (dev)

1. Tomar ítems con estado **Abierto**.
2. Corregir o responder (producto/copy/UX).
3. Pasar a **Listo para verificar** o **Cerrado** con evidencia (captura nueva, texto de pantalla, o nota de diseño aceptado).
4. Si el fondo es puramente código backend, **escalar** a `bugs.md` (AUD-*) manteniendo en `pendientes.md` una línea de impacto para negocio si aplica.

## Estado

- **Abierto**
- **Listo para verificar**
- **Cerrado**

## Convención de ID

- **`PEND-YYYY-MM-DD-NN`** (NN = correlativo del día, ej. `01`, `02`, …).
- Al crear un ítem nuevo, calcular el siguiente número mirando los `PEND-*` ya usados en este archivo.

## Plantilla de ítem

```markdown
### PEND-YYYY-MM-DD-NN — Titular en lenguaje de negocio
- **Estado:** Abierto
- **Pantalla / flujo:** ruta o nombre de sección (ej. Análisis cartera, filtros de gestión)
- **Voz cliente (directivo, no técnico):** “…” (qué siente, qué no entiende, qué le chirría)
- **Usabilidad / estética:** qué dificulta la decisión o da mala impresión
- **Canon de negocio (si aplica):** cita breve de `AGENTS.md` / filtros por gestión vs cierre / LTV / etc.
- **Evidencia:** ruta de imagen (ej. `frontend/tmp/pendientes-*.png`) o pasos para reproducir
- **Relación con otros canónicos (opcional):** V-xxx, AUD-xxx, OPT-xxx si ya existe el mismo tema
```

## Backlog abierto

- **Ninguno**.

## Registro de ítems

### PEND-2026-03-26-06 — El 0 % y “estimando volumen” me generan duda de si el proceso está vivo
- **Estado:** Cerrado
- **Pantalla / flujo:** Configuración → Importaciones → **Ejecutar carga** (especialmente con **Analytics** en cola o varios dominios).
- **Voz cliente (directivo, no técnico):** “Miré la pantalla cinco minutos en **0 %** y mensajes técnicos de volumen; en comité no puedo adivinar si la máquina trabaja o si hay que llamar a alguien.”
- **Usabilidad / estética:** Falta señal de “sigue en curso” comprensible (tiempo orientativo, paso legible en negocio) cuando el backend tarda en el primer avance.
- **Canon de negocio (si aplica):** Operación de sync acorde a `AGENTS.md`; la percepción de gobierno del dato cae si la interfaz no acompaña tiempos largos.
- **Evidencia:** Diagnóstico E2E: con **Analytics + Cartera** el primer dominio puede quedar en fase de estimación; la prueba `importacion-comprador.spec.ts` usa por defecto **solo Cartera** y **un mes** de cierre para obtener resultado más rápido. Capturas previas: `frontend/tmp/experiencia-comprador-importacion-pre-ejecutar-cartera.png`. Resultado final: generar con stack API+MySQL arriba: `cd frontend` → `$env:E2E_BASE_URL='http://localhost:3000'` (o `8080`) → `npx playwright test importacion-comprador.spec.ts --retries=0` → `frontend/tmp/experiencia-comprador-importacion-resultado-cartera.png`.
- **Relación con otros canónicos (opcional):** complementa **PEND-05** (acciones masivas); no es bug lógico auditado en `bugs.md` hasta acotar backend.
- **Cierre (2026-03-26):** En **Importaciones**, mientras la sync está en curso, texto orientativo: con progreso bajo (menos de 5 %) explica que es normal varios minutos en 0 % al inicio y que debe moverse **Últ. actualización**; con más avance, confirma importación en curso. Rótulo **Últ. actualización** (tilde) en panel de progreso. Código: `frontend/src/modules/config/ConfigView.tsx`. Validación: `npm run typecheck` (frontend).

### PEND-2026-03-26-05 — “Importar todo” no era obvio: solo veo casillas sueltas
- **Estado:** Cerrado
- **Pantalla / flujo:** Configuración → **Importaciones** (`/config`, pestaña Importaciones); uso con stack en `localhost:8080` (Docker) o `3000` (dev).
- **Voz cliente (directivo, no técnico):** “Quiero traer **todo** de una vez y no sé si tengo que ir tildando uno por uno; si me equivoco creo que ya cargué todo y en realidad solo moví Cartera.”
- **Usabilidad / estética:** Falta de atajo explícito aumenta error operativo y tiempo en sala con TI.
- **Canon de negocio (si aplica):** `AGENTS.md` — sync multi-dominio y guardarraíles de carga; la UI debe guiar sin asumir conocimiento de dominios SQL.
- **Evidencia:** Captura usuario: `frontend/tmp/experiencia-cliente-config-importaciones-usuario-8080-2026-03-26.png`. Prueba automática: `frontend/e2e/importaciones-config.spec.ts`. Contra Docker: `cd frontend; $env:E2E_BASE_URL='http://localhost:8080'; npx playwright test importaciones-config.spec.ts`.
- **Relación con otros canónicos (opcional):** sin AUD (no bug de lógica); mejora producto/UX.
- **Cierre (2026-03-26):** Botones **Seleccionar todos los dominios** y **Solo Analytics (por defecto)** + texto guía bajo las casillas en `ConfigView`. Evidencia: `npm run typecheck`, Vitest, Playwright (`importaciones-config.spec.ts` + `pendientes-evidencia.spec.ts` con `E2E_BASE_URL=http://localhost:3000`).

### PEND-2026-03-26-02 — El título y el recuadro de reglas se ven “sin revisar” para llevarlos a comité
- **Estado:** Cerrado
- **Pantalla / flujo:** Tras login → `/analisis-cartera` (cabecera y bloque de reglas bajo los KPIs).
- **Voz cliente (directivo, no técnico):** “El menú dice **Análisis de Cartera** con tilde, pero el título grande dice **Analisis** sin tilde; abajo leo **via**, **gestion**, **Categorias**, **clasificacion**… Me genera duda de si los números están auditados si el texto visible no está ni ortográficamente cuidado.”
- **Usabilidad / estética:** La confianza en datos se asocia al cuidado del mensaje; inconsistencias minan la percepción de gobierno.
- **Canon de negocio (si aplica):** `AGENTS.md` — reglas de gestión vs cierre, categorías, monto a cobrar; el contenido es correcto pero la **forma** debe reflejar seriedad.
- **Evidencia:** Captura generada (Playwright, `1366×768`): `frontend/tmp/pendientes-analisis-cartera-copy-2026-03-26.png`. Código de referencia: `frontend/src/modules/analisisCartera/AnalisisCarteraView.tsx` (`title`, `subtitle`, labels del `MetricExplainer`). Regenerar (PowerShell, desde `frontend/`): `$env:E2E_BASE_URL='http://localhost:3000'; npx playwright test pendientes-evidencia.spec.ts`.
- **Relación con otros canónicos (opcional):** posible eco en **V-084** (copy Config); aquí el alcance es **Análisis de cartera** principal.
- **Cierre (2026-03-26):** Título **Análisis de cartera**, subtítulo y **MetricExplainer** con ortografía completa (gestión, vía, categorías, clasificación); gráfico *Contratos por vía de cobro*. Evidencia: `npm run typecheck` (frontend).

### PEND-2026-03-26-03 — No encuentro “Rolo” si no juego con el menú
- **Estado:** Cerrado
- **Pantalla / flujo:** Barra lateral → ítem **Análisis de Cartera** (grupo “Análisis de Cartera”).
- **Voz cliente (directivo, no técnico):** “Si el rolo mensual es una lectura que esperaba tener a mano, hoy está **debajo** del primer ítem y no aparece como fila propia. Yo entro y sigo en la primera pantalla; nadie me dice que ahí adentro hay otro informe.”
- **Usabilidad / estética:** Reduce descubribilidad de un flujo que puede ser recurrente para dirección.
- **Canon de negocio (si aplica):** Navegación alineada a `desacople.md` / flujo nuevo; sin inventar reglas nuevas.
- **Evidencia:** Captura previa: `frontend/tmp/pendientes-sidebar-rolo-2026-03-26.png`. Implementación: **Rolo de Cartera** es enlace principal de primer nivel en `NAV_ITEMS` (sin anidar bajo otro ítem).
- **Cierre (2026-03-26):** `frontend/src/config/routes.ts` — ítem propio `roloCartera` en grupo **Análisis de Cartera**, mismo nivel que **Análisis de Cartera**.

### PEND-2026-03-26-04 — Dónde queda el tablero “corto” frente al análisis con muchos gráficos
- **Estado:** Cerrado
- **Pantalla / flujo:** Navegación principal tras login (`NAV_ITEMS` en sidebar); comparación mental con un “resumen ejecutivo” vs pantalla de **Análisis de Cartera** con filtros y gráficos.
- **Voz cliente (directivo, no técnico):** “Me explicaron que había un **resumen** de cartera más liviano y un **análisis** profundo. En el menú veo varias líneas de análisis y cohorte, pero **ninguna entrada** que diga claramente ‘resumen’ o ‘tablero ejecutivo’. ¿Está en otro lado o me lo perdí?”
- **Usabilidad / estética:** Expectativa de gobierno del dato sin mapa claro de qué pantalla usar para comité breve vs comité técnico.
- **Canon de negocio (si aplica):** Coherencia con mensajes de producto entregados al cliente; `AGENTS.md` no prescribe nombres de menú pero sí la semántica de reportes por gestión.
- **Evidencia:** Captura previa: `frontend/tmp/pendientes-menu-resumen-vs-analisis-2026-03-26.png` (regenerar tras cambio de menú). Ruta nueva `frontend/src/app/(dashboard)/cartera/page.tsx` monta `CarteraView`.
- **Relación con otros canónicos (opcional):** complementa el cierre operativo de **PEND-2026-03-26-01** / **AUD-2026-03-26-45** desde **voz de descubrimiento en producto**, no desde implementación técnica.
- **Cierre (2026-03-26):** Menú **Resumen de Cartera** → `/cartera` (primer ítem del grupo), luego **Análisis de Cartera** y **Rolo de Cartera**. `desacople.md` §4 actualizado con la ruta. Validación: `npm run typecheck` OK; E2E `menu.spec.ts` ajustado a nuevos enlaces.

### PEND-2026-03-26-01 — No entiendo si «Cartera» y «Análisis cartera» muestran el mismo corte
- **Estado:** Cerrado
- **Pantalla / flujo:** Menú lateral → **Cartera** vs **Análisis cartera** (filtros y rótulos de mes).
- **Voz cliente (directivo, no técnico):** “Veo que una dice Analytics v2 y la otra también habla de cartera, pero los filtros no me cuentan la misma historia: en una parte el equipo habla de **gestión** y **cierre** y acá sólo veo mes y año. No sé cuál llevaría a comité ni si los números son comparables.”
- **Usabilidad / estética:** Dos entradas parecidas generan duda de gobierno del dato; el badge «v2» suena a promesa de estándar que no se siente en la pantalla.
- **Canon de negocio (si aplica):** `AGENTS.md` — reportes operativos alineados a **`gestion_month`** y regla cierre vs gestión.
- **Evidencia:** Pasos: abrir **Cartera** y **Análisis cartera** en `1366x768`, comparar etiquetas de filtros y copy; captura sugerida `frontend/tmp/pendientes-cartera-vs-analisis-2026-03-26.png` (pendiente de generar en entorno con datos).
- **Relación con otros canónicos (opcional):** **AUD-2026-03-26-45**, **AUD-2026-03-26-46**, **V-096**.
- **Cierre (2026-03-26):** **Cartera** queda como resumen agregado v2 con **mes de gestión** explícito y subtítulo que diferencia el uso frente a **Análisis cartera** (detalle por contrato). Evidencia: mismo ciclo dev que AUD-45/46 + typecheck.

## Historial

| Fecha | Acción |
|---|---|
| 2026-03-26 | **ejecutador** + **experiencia-cliente:** **PEND-2026-03-26-06 Cerrado** — copy reasurance 0 % / MySQL + «Últ. actualización» en panel de sync (`ConfigView`). Sigue recomendable correr `importacion-comprador.spec.ts` con stack arriba para PNG `experiencia-comprador-importacion-resultado-*.png`. |
| 2026-03-26 | **Continuidad (experiencia-cliente):** spec `importacion-comprador.spec.ts` — solo dominio **Cartera** + **un mes** de cierre por defecto; espera en paralelo **resultado** (OK/ERROR) o **Sincronizando…**; doc `E2E_IMPORT_FULL_YEAR=1` para rango ancho. Apertura **PEND-06** (voz comprador: 0 % / estimación). |
| 2026-03-26 | **experiencia-cliente** + **ejecutador**: **PEND-2026-03-26-05 Cerrado** — atajo «importar todo» en Importaciones; spec `importaciones-config.spec.ts`; evidencia captura usuario `frontend/tmp/experiencia-cliente-config-importaciones-usuario-8080-2026-03-26.png`. **Auditor:** sin nuevos AUD (comportamiento técnico correcto; brecha era UX). |
| 2026-03-26 | Regeneradas capturas `frontend/tmp/pendientes-*.png` vía `npx playwright test pendientes-evidencia.spec.ts` (`E2E_BASE_URL=http://localhost:3000`); reflejan menú **Resumen de Cartera** + copy ortográfico en **Análisis de cartera**. |
| 2026-03-26 | **ejecutador** (asistencia a voz **experiencia-cliente**): **PEND-02/03/04 Cerrados** — ortografía **Análisis de cartera**; menú con **Resumen de Cartera** (`/cartera`), **Análisis de Cartera**, **Rolo de Cartera** como filas propias; página Next `app/(dashboard)/cartera/page.tsx`; `desacople.md` §4. |
| 2026-03-26 | **experiencia-cliente:** capturas en `frontend/tmp/` (`pendientes-analisis-cartera-copy-…`, `pendientes-sidebar-rolo-…`, `pendientes-menu-resumen-vs-analisis-…`, `pendientes-config-importaciones-…`). Flujo **Config → Importaciones**: selección de todos los dominios + captura `pendientes-config-importaciones-todos-dominios-…`; tras **Ejecutar carga** en dev, evidencia `pendientes-config-sync-iniciado-sin-modal-…` (API sin modal de riesgo alto en esta corrida). Spec: `frontend/e2e/pendientes-evidencia.spec.ts` con `E2E_BASE_URL=http://localhost:3000`. |
| 2026-03-26 | **experiencia-cliente:** apertura **PEND-2026-03-26-02**, **-03**, **-04** (copy/comité, descubribilidad Rolo, mapa resumen vs análisis en menú). |
| 2026-03-26 | Dev (**ejecutador**): **PEND-2026-03-26-01 Cerrado** — copy y contrato v2 en `CarteraView` clarifican rol vs Análisis cartera. |
| 2026-03-26 | **Orquesta / experiencia-cliente:** apertura **PEND-2026-03-26-01** (voz ejecutiva: dualidad Cartera vs Análisis cartera y semántica cierre/gestión). |
| 2026-03-26 | Creación del canónico `pendientes.md` y skill `experiencia-cliente` en el repo. |
