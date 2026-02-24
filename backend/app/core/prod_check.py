"""
Validaciones de seguridad en arranque para APP_ENV=prod.
Si alguna falla, se lanza RuntimeError y la aplicación no inicia.
"""
from app.core.config import settings

# Valores considerados "por defecto" inseguros en producción
INSECURE_DEFAULTS = {
    "JWT_SECRET_KEY": "change_me_jwt_secret",
    "JWT_REFRESH_SECRET_KEY": "change_me_refresh_secret",
}

def validate_production_config() -> None:
    """Comprueba que en producción no se usen CORS *, ni secretos JWT/DB por defecto."""
    if (getattr(settings, "app_env", "dev") or "dev").strip().lower() != "prod":
        return

    errors: list[str] = []

    if not (settings.cors_origins or "").strip():
        errors.append("CORS_ORIGINS no puede estar vacío en producción.")
    elif settings.cors_origins.strip() == "*":
        errors.append(
            "CORS_ORIGINS no puede ser '*' en producción. "
            "Configure una lista explícita de orígenes (ej: https://app.ejemplo.com)."
        )

    if (settings.jwt_secret_key or "").strip() in (
        "",
        INSECURE_DEFAULTS["JWT_SECRET_KEY"],
    ):
        errors.append(
            "JWT_SECRET_KEY debe estar definido y no usar el valor por defecto en producción."
        )
    if (settings.jwt_refresh_secret_key or "").strip() in (
        "",
        INSECURE_DEFAULTS["JWT_REFRESH_SECRET_KEY"],
    ):
        errors.append(
            "JWT_REFRESH_SECRET_KEY debe estar definido y no usar el valor por defecto en producción."
        )

    # En prod con PostgreSQL, la contraseña no puede estar vacía ni ser placeholder
    db_url = (getattr(settings, "database_url", "") or "").strip().lower()
    if db_url.startswith("postgresql"):
        postgres_pwd = (getattr(settings, "postgres_password", "") or "").strip()
        if not postgres_pwd or "change_me" in postgres_pwd:
            errors.append(
                "POSTGRES_PASSWORD debe estar definido y no usar valor por defecto en producción."
            )
        if "change_me" in (settings.database_url or ""):
            errors.append(
                "DATABASE_URL no debe contener contraseña por defecto (change_me) en producción."
            )

    if errors:
        raise RuntimeError(
            "Configuración de producción inválida:\n  - " + "\n  - ".join(errors)
        )
