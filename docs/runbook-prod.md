# Runbook Produccion From Zero

Fecha de corte: 2026-02-17

## 0) Arranque rapido (un solo clic)

Para levantar el proyecto con la menor intervencion posible (ideal para quien no tiene experiencia tecnica):

- **Requisito previo:** Tener instalado [Docker Desktop](https://www.docker.com/products/docker-desktop/) (incluye Docker y Docker Compose). En Linux, Docker Engine y Docker Compose V2.

- **Windows:** Doble clic en `INICIAR.bat` en la raiz del proyecto. El script comprueba Docker, crea `.env` si no existe, puede preguntar si desea configurar usuario y contraseña del administrador, y luego ejecuta el bootstrap y levanta todos los servicios. Al final abre el navegador en la URL del dashboard.

- **Linux / Mac:** En una terminal, desde la raiz del proyecto:
  ```bash
  chmod +x iniciar.sh
  ./iniciar.sh
  ```
  Mismo flujo: comprobacion de Docker, `.env`, pregunta opcional de usuario/contraseña admin, bootstrap y arranque. Se abre el navegador si esta disponible (`xdg-open` o `open`).

- **Unica pregunta opcional:** "¿Desea configurar ahora el usuario y contraseña del administrador? (s/N)". Si responde **s**, se pide usuario (por defecto `admin`) y contraseña; si responde **N** o Enter, se usan los valores por defecto del `.env`. El resto es automatico.

- **URL de acceso:** `http://localhost:8080` (frontend). Credenciales: las que configuro o las por defecto del `.env` (ver `DEMO_ADMIN_USER` y `DEMO_ADMIN_PASSWORD`).

---

## 1) Pre-requisitos
- Docker y Docker Compose operativos.
- Archivo `.env` completo con variables PostgreSQL, MySQL, JWT y CORS.
- Ventana de cambio aprobada.

## 2) Decomission legacy obligatorio
1. Verificar tareas Windows relacionadas:
   - `schtasks /Query /FO LIST /V | findstr /I "Sync Cobranzas"`
2. Eliminar scheduler legacy:
   - `schtasks /Delete /TN "CobranzasSyncIncremental" /F`
3. Confirmar que no queden tareas equivalentes activas.
4. Revisar checklist manual para cron/systemd externos en `docs/prod-from-zero-checklist.md`.

## 3) Bootstrap from zero
Ejecutar:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\prod_bootstrap_from_zero.ps1
```

Este script realiza:
1. Levanta `postgres` en perfil `prod`.
2. Espera readiness de DB.
3. Ejecuta `alembic upgrade head`.
4. Ejecuta `bootstrap_auth_users.py`.
5. Ejecuta `migrate_legacy_config_to_db.py`.
6. Ejecuta `verify_legacy_config_migration.py`.
7. Smoke `health` + `login`.

### 3.1) Primer acceso admin (one-shot, Windows/Linux)
Despues del primer deploy, ejecutar una sola vez:

```bash
docker compose --profile prod run --rm dashboard python scripts/first_run_enable_admin_once.py
```

Que hace este comando:
1. Crea o rehabilita usuario admin.
2. Imprime en salida los datos de conexion de PostgreSQL (`host`, `port`, `database`, `user`, `password`, `database_url`) para guardar en vault.
3. Se autodestruye en modo logico: queda bloqueado para reuso (one-shot). Si se necesita repetir, usar `--force`.

Ejemplo re-ejecucion controlada:

```bash
docker compose --profile prod run --rm dashboard python scripts/first_run_enable_admin_once.py --force
```

## 4) Sync dual (nuevo flujo)
Regla unica:
- Si `year_from` viene informado => `full_year` (solo ese anio exacto).
- Si `year_from` no viene => `full_all` (carga completa).
- En ambos casos la escritura es incremental por UPSERT y con verificacion de duplicados.

### 4.1 Ejecutar carga
`POST /api/v1/sync/run`

Ejemplo carga completa:

```json
{ "domain": "analytics" }
```

Ejemplo carga anual exacta:

```json
{ "domain": "analytics", "year_from": 2024 }
```

### 4.2 Consultar estado
`GET /api/v1/sync/status?domain=analytics&job_id=<job_id>`

Campos clave:
- `running`, `stage`, `progress_pct`, `status_message`
- `rows_inserted`, `rows_updated`, `rows_skipped`, `duplicates_detected`
- `error`, `log`

### 4.3 Modo seguro de importaciones
Para servidores modestos mantener estos guardrails activos:

- `SYNC_SAFE_MODE=true`
- `SYNC_PREVIEW_ENABLED=true`
- `SYNC_MAX_ROWS` y/o `SYNC_MAX_ROWS_<DOMINIO>` con valores mayores que cero
- Cola estricta: el sistema procesa un job por vez (`pending/running` unico)

Si un usuario intenta `full_all` sin limite efectivo, la API rechaza la ejecucion con `409`.

### 4.4 Tuning recomendado por RAM (perfil estabilidad)
Usar como base y ajustar con `sync/perf/summary`:

| RAM servidor | SYNC_MAX_ROWS | FETCH_BATCH base | CHUNK_SIZE base | Notas |
|---|---:|---:|---:|---|
| 4 GB | 150000 | 3000 | 5000 | Priorizar ventanas por anio/mes |
| 8 GB | 300000 | 5000 | 10000 | Perfil recomendado por defecto |
| 16 GB | 600000 | 8000 | 16000 | Mantener cola estricta |

Adicional para preview liviano masivo:

- `SYNC_PREVIEW_SAMPLE_ROWS=20000`
- `SYNC_PREVIEW_SAMPLE_TIMEOUT_SECONDS=8`

## 5) Frontend de configuracion
En modulo Configuracion:
- Selector de dominio
- Campo `Ano desde` opcional
- Boton `Ejecutar carga`
- Barra de progreso + log en vivo

## 6) Verificacion minima post-corte
1. `GET /api/v1/health` retorna `ok=true` y `db_ok=true`.
2. Login admin operativo.
3. Sync full_all ejecuta sin duplicados.
4. Sync full_year reemplaza correctamente el anio solicitado.
5. Seccion Cartera carga summary y filtros.

## 7) Rollback operativo
1. Detener ejecucion de sync nuevo (no lanzar nuevos jobs).
2. Mantener PostgreSQL intacto.
3. Revertir uso funcional a lectura legacy segun ventana de contingencia.

## 8) Legacy deprecado
Artefactos previos fueron archivados en:
- `docs/archive/legacy-prod-20260217/`
- `scripts/archive/legacy-prod-20260217/`

No usar scripts legacy para operacion productiva nueva.

## 9) Publicacion LAN (single URL via reverse proxy)
Objetivo: exponer una sola URL interna de red local (ej: `http://192.168.1.20`) y ocultar puertos directos de API/frontend.

### 9.1 Preparacion de entorno
1. Crear `.env` a partir de `.env.prod-lan`:
```powershell
Copy-Item .env.prod-lan .env -Force
```
2. Editar `.env` y ajustar:
- `CORS_ORIGINS`
- `POSTGRES_PASSWORD`
- `JWT_SECRET_KEY`
- `JWT_REFRESH_SECRET_KEY`
- `MYSQL_PASSWORD`

### 9.2 Levantar perfil LAN
```powershell
docker compose --profile prod-lan up -d --build
```

Servicios del perfil:
- `reverse-proxy` (expone solo `LAN_HTTP_PORT`, por defecto 80)
- `api-v1-lan` (interno)
- `sync-worker-lan` (interno)
- `frontend-prod-lan` (interno)
- `postgres` (interno, salvo que se publique manualmente)

### 9.3 Smoke checks LAN
1. Health API via proxy:
```powershell
curl http://<IP_SERVIDOR>/api/v1/health
```
2. Frontend:
```text
http://<IP_SERVIDOR>/
```
3. Login y navegacion completa.
4. Ejecutar una sync desde Configuracion.

### 9.4 Firewall recomendado
1. Permitir puerto 80 solo en subred LAN autorizada.
2. Bloquear 8000/8080/5432 desde LAN para usuarios finales.
3. Si se requiere acceso DB administrativo, permitir 5432 solo desde IP de administracion.

### 9.5 Rollback rapido
1. Bajar perfil LAN:
```powershell
docker compose --profile prod-lan down
```
2. Volver al perfil previo (puertos directos):
```powershell
docker compose --profile prod up -d --build
```
