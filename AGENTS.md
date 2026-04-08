# AGENTS.md

## Proposito
Fuente unica de verdad para reglas de negocio y criterios operativos del proyecto **EPEM - Cartera de Cobranzas**.
Todo cambio de codigo/SQL debe validarse contra este documento antes de mergear.

## Canonico transversal de desacople
- El desacople entre frontend **nuevo** y **legacy** se rige por `desacople.md`.
- Si el cambio toca navegacion, routing, layout o UI de modulos analiticos, validar obligatoriamente contra `desacople.md`.
- El canon ejecutivo de tableros analytics se rige por `power.md` (incluye obligación de nuevas secciones con el mismo patrón de layout de filtros que las existentes; ver § C.1).
- Si el cambio toca jerarquia de pantalla, header, KPIs, filtros o composicion general de tableros analytics, validar obligatoriamente contra `power.md`.
- El seguimiento operativo del rollout ejecutivo por modulo se registra en `power_avance.md`.
- El canon visual operativo por patrones de UI analytics se rige por `docs/spec-canon-patrones-ui-analytics.md`.
- Si el cambio toca filtros, botones, tablas, densidad desktop, jerarquia o componentes visuales repetidos, validar obligatoriamente contra `docs/spec-canon-patrones-ui-analytics.md`.
- La biblioteca de componentes UI del frontend nuevo (**HeroUI**, `@heroui/react`) y la migración incremental se rigen por `docs/heroui/README.md` y `docs/heroui/PLAN-MIGRACION.md`.
- Si el cambio introduce o altera botones, **menús desplegable (dropdown)**, **select/combobox** de datos, campos de formulario, modales, feedback tipo toast o primitivos equivalentes en el frontend nuevo, validar obligatoriamente contra esos documentos además del spec analytics.
- El inventario de tablas MySQL de extracción, JOINs alineados a los SQL del repo y capas Postgres de sync/analytics se rige por `docs/base.md`.
- El Markdown **no canónico** (planes, runbooks históricos, specs de apoyo, etc.) vive bajo `archive-md-no-canonico/`; ver `archive-md-no-canonico/README.md`. No sustituye a los puntos anteriores ni a los canónicos de seguimiento.

## Canonicos operativos de seguimiento (obligatorios)
- `bugs.md`: backlog tecnico/operativo y estado AUD-*.
- `bugs_visual.md`: backlog UX/UI visual y estado V-*.
- `optimo.md`: backlog/criterios de optimizacion continua (hardware + UX) y evidencia antes/despues.
- `qa.md`: corridas QA tipo usuario final, evidencia, estado por flujo y escalamiento a los canónicos de bugs/visual/óptimo.
- `pendientes.md`: voz del **cliente ejecutivo no técnico** (experiencia de uso, usabilidad percibida, estética y alineación del mensaje con el negocio canónico); estado **PEND-*** y handoff al dev (skill `experiencia-cliente`).
- Skill **`ejecutador`**: ciclo planificado (inventario → plan → implementación → validación) para **cerrar ítems abiertos** en esos canónicos con evidencia y sin drift documental (ver `.cursor/skills/ejecutador/SKILL.md`).
- Skill **`orquesta`**: encadena en orden **`auditor`** → **`audivisual`** → **`experiencia-cliente`** → **`ejecutador`**, y cierra con aviso explícito al usuario (ver `.cursor/skills/orquesta/SKILL.md`).
- La coordinacion entre agentes/equipo se realiza por handoffs en estos `.md`; no dejar decisiones operativas solo en conversaciones.
- Todo ciclo de trabajo debe revisar y mantener alineados estos documentos canónicos, sin drift entre codigo y documentos.

## Reglas de negocio obligatorias
1. **Fecha de cierre != fecha de gestion**.
   - En cartera, `gestion_month` se calcula como **cierre + 1 mes**.
   - Ejemplo: cierre `02/2026` -> gestion `03/2026`.
2. **Reportes operativos trabajan por `gestion_month`**.
   - Cobranzas por corte, rendimiento y anuales deben alinear filtros por gestion.
3. **Categoria por tramo**:
   - `VIGENTE`: tramos `0..3`
   - `MOROSO`: tramos `>3`
4. **Definicion de tramo**:
   - Regla general: `tramo = cuotas_vencidas`.
   - Excepcion (tope operativo): si `cuotas_vencidas >= 7`, entonces `tramo = 7`.
   - Si `cuotas_vencidas = 0` entonces `tramo = 0`.
   - Si `cuotas_vencidas = 1` entonces `tramo = 1`.
5. **Monto vencido != monto a cobrar**:
   - `monto_vencido` representa solo deuda vencida.
   - `monto_a_cobrar = monto_vencido + monto_cuota`.
5.1. **Monto vencido con mora máxima operativa (`cuotas_vencidas` ≥ 7) y contratos renovados**:
   - El **tramo** visible sigue el tope operativo (regla 4: `cuotas_vencidas >= 7` → `tramo = 7`).
   - Para **`monto_a_cobrar`** (y métricas derivadas: rendimiento por monto, “debería cobrar”, LTV por monto) el **`monto_vencido`** no debe **inflarse** con mora atribuible a **vueltas posteriores** a la **primera vuelta** del plazo firmado.
   - **Primera vuelta** = **`quotas_amount`** cuotas (plazo original del contrato, ej. 18). Tras **renovaciones**, `actual_fee_quantity` puede ser un múltiplo (ej. 72 = cuatro vueltas de 18); el extracto puede traer `monto_vencido` acumulado sobre todo el historial.
   - **Operativo:** si **`cuotas_vencidas >= 7`**, el vencido que entra en **`monto_a_cobrar`** se **acota** al máximo coherente con la primera vuelta. Mientras el extracto no desglose mora por ciclo, la **cota monetaria** aplicada en sync es: **`min(monto_vencido, quotas_amount * monto_cuota)`** (requiere `periodo_cuotas` / `quotas_amount` y `monto_cuota` en la fila de cartera).
   - Ejemplo: plazo **18** cuotas, **`actual_fee_quantity`** 72, contrato en **tramo 7+**: el vencido usable para el denominador no debe asumir cuatro vueltas completas de mora si solo corresponde acotar a la **primera vuelta de 18**.
6. **LTV (Lifetime Value) abreviado**:
   - Se usará siempre la sigla **LTV** para esta métrica.
   - Definición operativa: en una ventana `X`, compara lo que **se debería cobrar** vs lo que **se cobró**.
   - Fórmula de seguimiento:
     - `LTV % = cobrado / deberia_cobrar`.
     - Equivalente por cuotas: `cuotas_pagadas / cuotas_deberian_pagarse`.
   - Ejemplo: contrato que entra en enero; para agosto debería pagar 8 cuotas y pagó 4:
     - `LTV = 50%` (4/8).
7. **UN canonicas**:
   - `ODONTOLOGIA TTO` se mantiene separada de `ODONTOLOGIA`.
   - No consolidar por hardcode en sync; usar tabla de mapeo.
8. **Scope de extraccion MySQL**:
   - Empresas permitidas: `enterprise_id IN (1,2,5)`.
8.1. **Exclusion de contratos en cobranzas**:
   - En sync y queries de cobranzas (MySQL) se excluyen por regla de negocio los contratos `contract_id NOT IN (55411, 55414, 59127, 59532, 60402)`. Este listado está en `query_cobranzas.sql` y en `MYSQL_PRECHECK_QUERIES` de sync; cualquier cambio debe reflejarse en ambos y documentarse aquí.
   - **Ventana de fechas del extracto de pagos:** `payments.date >= '2020-01-01'` en `sql/v2/query_cobranzas.sql` y en el precheck `MYSQL_PRECHECK_QUERIES['cobranzas']`; cualquier cambio de piso temporal debe reflejarse en ambos y en `docs/base.md`.
9. **Rendimiento de cartera (dos metricas obligatorias)**:
   - `rendimiento_monto_% = cobrado / monto_a_cobrar`.
   - `monto_a_cobrar = monto_vencido + monto_cuota`, donde `monto_vencido` respeta la regla **5.1** cuando `cuotas_vencidas >= 7`.
   - Ejemplo monto: si `monto_a_cobrar = 1000` y `cobrado = 500`, entonces `rendimiento_monto_% = 50%`.
   - `rendimiento_cantidad_% = contratos_con_cobro / contratos_por_cobrar`.
   - Ejemplo cantidad: si `contratos_por_cobrar = 2000` y `contratos_con_cobro = 1000`, entonces `rendimiento_cantidad_% = 50%`.
   - Debe poder calcularse por:
     - UN (unidad de negocio)
     - categoria (`VIGENTE`/`MOROSO`)
     - tramo
     - via de pago/cobro
10. **Estado de resultado (EERR)** — módulo **EERR** en el frontend (`/eerr`):
   - **Datos canónicos en Postgres:** la carga operativa del cuadro proviene de la tabla **`eerr_fact`** (sync dominio **`eerr`**, SQL `sql/v2/query_eerr.sql` en MySQL). Los KPIs expuestos por API pueden usar heurísticas débito/crédito por bloque hasta cerrar convención contable detallada.
   - **Ventana de años en MySQL (extracto unificado):** los tres bloques (ventas, costos, gastos) usan `YEAR(accounting_entries.date) >= 2020` para incluir el año calendario 2020 completo; cambios de piso deben mantenerse alineados en `query_eerr.sql` y en los SQL de referencia `query_eerr_*.sql`, y documentarse en `docs/base.md`.
   - **Exclusión GESE:** no incluir en el extracto EERR movimientos cuyo **mayor** (`accounting_types.name`) o **cuenta** (`accounting_plans.name`) contenga la subcadena **gese** (sin distinguir mayúsculas). Implementación: fragmento `sql/common/eerr_exclude_mayor_cuenta_gese.sql` incluido en cada bloque de `sql/v2/query_eerr.sql`; los `query_eerr_*.sql` de referencia repiten la misma condición para consultas aisladas.
   - **Presentación:** tabla de composición dinámica (estilo pivot / desglose por partidas) agrupada en bloques **ingresos (ventas)**, **costos** y **gastos**. Los importes deben poder desglosarse y totalizar por periodo y dimensiones que defina el producto (p. ej. UN), sin contradecir las fórmulas siguientes.
   - **Margen (bruto operativo de referencia):** `margen = ingresos - costos` (ingresos netos de ventas menos costos asociados a esas ventas, según el catálogo de partidas vigente).
   - **EBITDA (resultado objetivo del cuadro):** `ebitda = margen - gastos` (gastos operativos / estructura que el modelo clasifique fuera de costos directos de ventas).
   - **Orden de cálculo obligatorio:** primero margen (ingresos − costos), luego EBITDA (margen − gastos). Cualquier API, agregado SQL o KPI visible en este módulo debe respetar este orden y nomenclatura (**margen**, **EBITDA**).
   - **Nota:** si más adelante se incorporan ajustes contables (impuestos, intereses, depreciaciones, etc.), se documentan aquí como reglas adicionales para no redefinir en silos el significado de **margen** y **EBITDA** operativos anteriores.

## Reglas tecnicas de sync y agregados
1. Si hay filas upsert en facts, no puede quedar agg en cero.
2. Meses para refresh se definen por prioridad:
   - `detected_target_months` (manifest)
   - `applied_months` (si hubo upsert)
   - `source_months` (bootstrap: fact vacia + datos normalizados)
3. Guardrail obligatorio:
   - Si `rows_upserted > 0` y `agg_rows_written == 0`, ejecutar fallback de refresh.
4. `cartera` usa estrategia estable de upsert compatible con particionado (sin depender de UNIQUE runtime en parent con expresiones).
5. **Seguridad operativa en limpieza local (obligatoria)**:
   - Prohibido ejecutar comandos de borrado masivo ambiguos (`rd /s /q`, `del /s`, `rm -rf`, `Remove-Item -Recurse -Force`) fuera de una ruta validada y acotada.
   - Antes de limpiar temporales, validar la ruta exacta y usar un script/loop con allowlist explicita de carpetas objetivo.
   - Si hay `Permission denied` en temporales de `sql/*`, no escalar a borrados globales; registrar hallazgo y resolver con procedimiento controlado.
   - **Lista negra (nunca ejecutar):** comandos `cmd /c` con borrado recursivo interpolando rutas entre comillas escapadas (riesgo de expansión vacía o path truncado).  
     Ejemplo prohibido que causó incidente: `cmd /c "rd /s /q \"$d\""` dentro de una cadena con variables PowerShell.
   - Para limpieza de `tmp*` usar solo iteración segura con `Get-ChildItem` + `Remove-Item -LiteralPath` sobre rutas absolutas validadas una por una, sin pasar por `cmd /c`.

## Despliegue canonico (un clic)
0. **Comprobar / instalar requisitos** (Docker + Compose V2):
   - Windows: `VERIFICAR_REQUISITOS.bat` (comprueba) o `VERIFICAR_REQUISITOS.bat -Install` (intenta `winget` Docker Desktop; puede pedir UAC).
   - Linux: `./verificar_requisitos.sh` **intenta instalar** Docker y el plugin Compose con apt/dnf/pacman si faltan (requiere `sudo`; use `./verificar_requisitos.sh --no-install` para solo comprobar). Tras unir al grupo `docker`, cierre sesion o `newgrp docker`.
   - macOS: comprobar Docker Desktop manualmente; el script no instala paquetes del sistema en macOS (solo informa).
1. **Entrada oficial** para levantar stack:
   - Windows: `INICIAR.bat` (raiz) -> `scripts/start_one_click.ps1`.
   - Linux/macOS: `iniciar.sh` (raiz).
2. **Bajar stack**:
   - Windows: `DETENER.bat` -> `scripts/stop_stack.ps1` -> `docker compose --profile "*" down --remove-orphans`.
   - Linux/macOS: `detener.sh` -> mismo comando con `--profile "*"`.
3. **Reinicio limpio (rebuild)**:
   - Windows: `REINICIAR.bat` -> `scripts/restart_stack_fresh.ps1`.
   - Linux/macOS: `reiniciar.sh`.
   - Flujo: down con `--rmi local`, `docker builder prune -f`, `build --pull --no-cache`, `up -d` perfil prod.
3.1. **Reinicio limpio LAN (rebuild prod-lan)**:
   - Windows: `REINICIAR_LAN.bat` -> `scripts/restart_stack_fresh_lan.ps1` (pregunta `LAN_HTTP_PORT` y lo guarda en `.env`, como `INICIAR_LAN`; opcional `REINICIAR_LAN.bat -LanPort 8088`).
   - Linux/macOS: `reiniciar_lan.sh` (misma pregunta vía `scripts/lan_port_prompt.sh`).
   - Flujo: mismo que el reinicio prod, pero `build`/`up` contra el perfil `prod-lan` (nginx + API + front para LAN).
4. **Acceso por red local (LAN), una sola URL**:
   - Windows: `INICIAR_LAN.bat` -> `scripts/start_lan.ps1` -> perfil `prod-lan` (pregunta el puerto y guarda `LAN_HTTP_PORT` en `.env`; nginx publica ahí; front con API bajo `/api/v1` mismo origen). Sin pregunta: `INICIAR_LAN.bat -LanPort 8088`.
   - Linux/macOS: `iniciar_lan.sh` (raiz; misma pregunta).
   - **Primera instalación**: conviene completar bootstrap con `INICIAR.bat` / `iniciar.sh` (perfil `prod`) al menos una vez; luego `INICIAR_LAN` puede sustituir el `up` diario para uso desde otras PCs en la LAN.
   - **Bajar todo**: igual que siempre — `DETENER.bat` / `detener.sh` (`--profile "*"`).
5. Estos launchers son contrato operativo: cambios en compose/bootstrap/env no deben romperlos.

## Contratos y UX
1. Frontend analytics consume rutas v2 por defecto.
2. Metadata minima por respuesta analytics:
   - `source_table`
   - `data_freshness_at`
   - `cache_hit`
   - `pipeline_version`
3. Filtros deben mostrar todas las UN disponibles segun politica canonica vigente.
4. Los controles interactivos nuevos en el frontend analytics deben **priorizar `@heroui/react`** según `docs/heroui/README.md` (incluye **Dropdown** para acciones, **Select** / **ComboBox** para elección de valores), salvo excepciones explícitas en `docs/spec-canon-patrones-ui-analytics.md` o en `docs/heroui/PLAN-MIGRACION.md` (p. ej. segmented nativo canónico).
5. El avance por fases de migración UI (botones, formularios, feedback, tablas, overlays) se coordina con `docs/heroui/PLAN-MIGRACION.md`; al cerrar un bloque de fase, actualizar ese plan en el mismo cambio que el código.

## Politicas de seguridad Git (obligatorias)
1. **Secretos prohibidos en repositorio**:
   - Nunca subir: API keys, tokens JWT, passwords, DSN reales, credenciales MySQL/Postgres, certificados privados, llaves SSH, secretos de terceros.
   - Nunca subir archivos de secretos: `.env`, `.env.*`, `secrets.*`, `*.pem`, `*.key`, `id_rsa`, `credentials.json` con valores reales.
2. **Configuracion segura por defecto**:
   - Solo se versiona `.env.example` con valores ficticios/placeholders.
   - Toda credencial real se inyecta por variables de entorno o secret manager fuera de Git.
3. **Codigo y SQL sin hardcode sensible**:
   - Prohibido hardcodear usuarios/passwords/hosts sensibles en codigo, scripts o `.sql`.
   - Logs y errores no deben exponer secretos ni encabezados `Authorization`.
3.1. **Autenticacion (JWT y contraseñas)**:
   - Access token JWT debe incluir `typ: 'access'`; refresh token `typ: 'refresh'`. Las rutas protegidas validan que el token sea de tipo access.
   - Contraseñas de usuarios (AuthUser): se hashean con **passlib** usando el esquema configurado (p. ej. `pbkdf2_sha256`). No cambiar el esquema sin plan de migración de hashes existentes.
4. **Control obligatorio antes de commit/push**:
   - Ejecutar escaneo de secretos (ej: `gitleaks` o equivalente) antes de push.
   - Si el escaneo detecta secretos: bloquear push hasta corregir.
5. **Control en CI/CD**:
   - Todo PR debe pasar escaneo de secretos y dependencias vulnerables.
   - Si falla seguridad, no se mergea.
6. **Respuesta a incidente (si se filtro un secreto)**:
   - Rotar/revocar inmediatamente el secreto comprometido.
   - Eliminarlo del historial del repo y reescribir historial segun procedimiento del equipo.
   - Registrar incidente, alcance, fecha/hora y acciones de mitigacion.
7. **Revision de terceros y datos**:
   - No commitear dumps de BD ni exports con datos sensibles sin anonimizar.
   - Revisar archivos nuevos/grandes antes de push para evitar exposicion accidental.

## Checklist obligatorio por cambio
1. Validar que no se rompa la semantica de `gestion_month`.
2. Validar que `options` no queden vacias tras sync exitoso.
3. Validar paridad de KPIs clave en muestra controlada.
   - Incluir rendimiento por monto y rendimiento por cantidad.
   - Incluir corte por UN, categoria, tramo y via de pago/cobro.
4. Ejecutar smoke API:
   - `portfolio-corte-v2/options`
   - `portfolio-corte-v2/summary`
   - `rendimiento-v2/options`
   - `rendimiento-v2/summary`
5. Verificar logs de sync:
   - meses detectados
   - meses aplicados
   - meses usados para refresh
   - fallback (si aplico)
6. Ejecutar control de seguridad previo a push:
   - escaneo de secretos sin hallazgos
   - confirmacion de que no hay credenciales reales en diffs
   - confirmacion de que `.env`/llaves no forman parte del commit
7. Si el cambio toca Docker/compose/bootstrap/scripts: validar `INICIAR.bat`/`iniciar.sh`, `INICIAR_LAN.bat`/`iniciar_lan.sh`, `DETENER.bat`/`detener.sh`, `REINICIAR.bat`/`reiniciar.sh` y `REINICIAR_LAN.bat`/`reiniciar_lan.sh`.
8. Si el cambio toca frontend de analytics, validar fronteras de `desacople.md` (sin marcadores legacy en flujo nuevo).
8.1. Si el cambio **añade una nueva sección** de tablero analytics (vista/ruta nueva comparable a Cartera, Análisis, Rendimiento, Cohorte): registrar la sección en `frontend/src/config/analyticsFilterLayouts.ts` (`macro` / `micro` / `floating` como las demás), usar `DashboardFiltersLayout` + `FloatingQuickFilters` / `DashboardFloatingFiltersLayout` + `buildEffectiveFilterLayout`, y mantener alineado el espejo en backend de normalización de layouts si aplica (`dashboard_filter_layouts.py`). Criterio canónico: `power.md` § C.1 y `docs/spec-canon-patrones-ui-analytics.md` (layout por sección).
9. Validar `optimo.md` como canónico de pendientes: registrar impacto en hardware/UX, evidencia antes/despues y estado consistente con `bugs.md`/`bugs_visual.md`.
10. Si el cambio requiere validación funcional o de regresión, registrar la corrida en `qa.md` con evidencia y enlazar cualquier hallazgo a su canónico correspondiente.
11. Si el cambio altera copy, métricas visibles o flujos de decision con datos para perfiles no técnicos: revisar coherencia con `pendientes.md` (ítems abiertos/cerrados) y con la voz de negocio de `AGENTS.md`.
12. Si el cambio toca `sql/v2/*`, `sql/common/*`, `query_analytics.sql` o el inventario de tablas/capas documentado para importaciones: actualizar `docs/base.md` para evitar drift respecto al código.
13. Si el cambio toca UI del frontend nuevo con primitivos interactivos: validar adopción respecto a `docs/heroui/README.md` y el estado de `docs/heroui/PLAN-MIGRACION.md`; marcar ítems del plan cuando el PR cierre una tarea de fase explícita.

## Cuando actualizar este archivo
Actualizar inmediatamente si cambia:
1. Definicion de categorias por tramo.
2. Politica canonica de UN.
3. Reglas de calendario (cierre/gestion/corte).
4. Listado de contratos excluidos en cobranzas (sync/MySQL).
5. Contratos de endpoints v2 o criterios de performance/SLA.
6. Definicion de rendimiento de cartera (monto/cantidad) o sus dimensiones de corte, o regla **5.1** (tope `monto_vencido` primera vuelta con mora >= 7).
7. Politicas de seguridad de repositorio, CI/CD o manejo de secretos.
8. Esquema de hashing de contraseñas o validacion de tipo de token JWT.
9. Fronteras de desacople entre frontend nuevo y legacy (`desacople.md`).
10. Criterios de optimizacion continua y politica de seguimiento de pendientes en `optimo.md`.
11. Politica o formato del canónico de experiencia ejecutiva en `pendientes.md` (PEND-*).
12. Inventario de extracción MySQL / referencias en `docs/base.md` si las reglas anteriores alteran los SQL de sync o el grafo documentado de tablas.
13. Catálogo de códigos legacy: si el monolito PHP cambia mapeos id→etiqueta, actualizar el **Apéndice A** dentro de `docs/base.md` (y §10–§11 si cambia semántica de columnas en extractos v2).
14. Política de adopción HeroUI o reglas operativas en `docs/heroui/README.md` / `docs/heroui/PLAN-MIGRACION.md` (incluidas excepciones temporales o decisiones de fase, p. ej. tablas).
15. Definición del **Estado de resultado (EERR)**: estructura de la tabla dinámica, clasificación ingresos/costos/gastos y fórmulas **margen** y **EBITDA** (regla **10** de negocio).
16. Política de **nuevas secciones** de tablero analytics: registro en `analyticsFilterLayouts.ts`, mismos componentes de layout/FAB y espejo backend de normalización (`power.md` § C.1, spec patrones UI analytics).
