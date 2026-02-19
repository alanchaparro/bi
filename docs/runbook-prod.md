# Runbook Produccion From Zero

Fecha de corte: 2026-02-17

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
