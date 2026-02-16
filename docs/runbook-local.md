# Local Runbook

## Prerequisites
- Python 3.10+
- CSV files in project root when using sync mode:
  - `cartera.csv`
  - `cobranzas_prepagas.csv`
  - `gestores.csv`
  - `contratos.csv` (optional but recommended)

## Install
```powershell
pip install -r requirements.txt
```
- Runtime only:
```powershell
pip install -r requirements/runtime.txt
```
- Future dev tooling bucket:
```powershell
pip install -r requirements/dev.txt
```

## Environment
1. Copy `.env.example` to `.env`.
2. Set MySQL values (`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`).

## Run Dashboard
```powershell
python start_dashboard.py
```
- Open `http://localhost:5000`.
- Use Config tab to run SQL exports or sync local files.
- Analytics API is enabled by default in frontend (`USE_ANALYTICS_API=true` implicit).
- If analytics endpoint fails, critical tabs fallback to local computation.
- Debug traces: append `?debug=1` to URL.

## Auth (Frontend v1)
- Login: `POST /api/v1/auth/login` con `username`/`password`; respuesta incluye `access_token`, `refresh_token`, `role`, `permissions`.
- Access token se envía en header `Authorization: Bearer <access_token>`; tiene vida corta (p. ej. 120 min).
- Refresh token se guarda en `sessionStorage` (solo en la pestaña actual). Ante 401, el frontend llama a `POST /api/v1/auth/refresh` con `refresh_token` y renueva ambos tokens; si falla, cierra sesión y muestra pantalla de login.
- Cerrar sesión: el frontend limpia `sessionStorage` y deja de enviar Bearer; opcionalmente llamar `POST /api/v1/auth/revoke` con el refresh token para invalidarlo en el servidor.

## Feature Flags (frontend)
- `FF_MOVEMENT_SERIES_V2` (default `true`)
- `FF_LINE_LABELS_SMART_LAYOUT` (default `true`)
- `FF_API_ANALISIS_CARTERA` (default `true`)
- `FF_API_MOVIMIENTO` (default `true`)
- `FF_API_ANUALES` (default `true`)
- `FF_API_RENDIMIENTO` (default `true`)

## Smoke Checklist
1. Open app with empty cache.
2. Sync local files from Config.
3. Validate all tabs load without console errors.
4. Apply and reset filters in each analytics tab.
5. Open/close sidebar and navigate all tabs.

## Troubleshooting
- If stale frontend code appears, hard refresh (`Ctrl+F5`).
- If CSV load fails, check validation messages and required columns.
- If export endpoint fails, inspect server terminal output.

## Tests
```powershell
python -m unittest discover -s tests -p "test_*.py"
```

## Docker
```powershell
docker compose build --no-cache
docker compose up -d
```

## Docker Validation (No Host Python Required)
- Compile check:
```powershell
.\scripts\docker-compile.ps1
```
- Test suite:
```powershell
.\scripts\docker-test.ps1
```
- Smoke checks:
```powershell
.\scripts\docker-smoke.ps1
```
- Full pipeline (build + compile + tests + smoke):
```powershell
.\scripts\docker-validate.ps1
```

## Optional Makefile Targets
If your environment has `make`:
- `make docker-build`
- `make docker-up`
- `make docker-compile`
- `make docker-test`
- `make docker-smoke`
- `make docker-validate`

## CI (GitHub Actions)
- Workflow: `.github/workflows/docker-ci.yml`
- Runs on `push`, `pull_request`, and manual trigger (`workflow_dispatch`).
- Pipeline: `docker compose build` + `up` + `py_compile` + `unittest` + smoke HTTP checks.

## Safe Push (No Sensitive Data)
1. Run safety check before push:
```powershell
.\scripts\pre-push-safety.ps1
```
2. Confirm sensitive files are ignored:
- `.env`, `.env.*` (except `.env.example`)
- `*.csv`, `*.xlsx`, `analytics_meta.json`
3. Push only code/docs to your repo:
```powershell
git remote set-url origin https://github.com/alanchaparro/bi.git
git push origin <branch>
```
