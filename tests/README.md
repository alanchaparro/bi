# Tests

Run all tests:

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

## Variables de entorno para tests API v1

Los tests de auth y brokers (`test_api_v1_*.py`) usan credenciales configurables. Por defecto usan usuarios demo (válido con `APP_ENV=dev`):

| Variable | Default | Uso |
|----------|---------|-----|
| `TEST_ADMIN_USER` | `admin` | Usuario con rol admin para login en tests |
| `TEST_ADMIN_PASSWORD` | `admin123` | Contraseña del usuario admin de test |
| `TEST_ANALYST_USER` | `analyst` | Usuario con rol analyst |
| `TEST_ANALYST_PASSWORD` | `analyst123` | Contraseña del usuario analyst |

Para ejecutar tests contra usuarios de base de datos (por ejemplo con `APP_ENV=prod` o sin demo), crear los usuarios en la DB de test y definir estas variables con el usuario/contraseña correspondientes.

Además se usan:
- `DATABASE_URL`: por defecto `sqlite:///./data/test_app_v1.db`
- `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`: valores de test

## Scope actual

- Static regression checks for dashboard structure.
- KPI compliance rule sanity checks.
- Environment template presence checks.
- Golden datasets versioned under `tests/fixtures/golden/` for deterministic business KPI validation.
- Minimal UI regression checks for key cards/canvases and module render entrypoints.
- API v1: auth (login/refresh/revoke), brokers config, analytics (contracts y permisos).
