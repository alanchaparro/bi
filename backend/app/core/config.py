from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'cobranzas-api-v1'
    app_env: str = Field(default='dev', alias='APP_ENV')
    app_port: int = Field(default=8000, alias='APP_PORT')

    database_url: str = Field(default='sqlite:///./data/app_v1.db', alias='DATABASE_URL')

    jwt_secret_key: str = Field(default='change_me_jwt_secret', alias='JWT_SECRET_KEY')
    jwt_refresh_secret_key: str = Field(default='change_me_refresh_secret', alias='JWT_REFRESH_SECRET_KEY')
    jwt_algorithm: str = Field(default='HS256', alias='JWT_ALGORITHM')
    jwt_expire_minutes: int = Field(default=120, alias='JWT_EXPIRE_MINUTES')
    jwt_refresh_expire_minutes: int = Field(default=60 * 24 * 30, alias='JWT_REFRESH_EXPIRE_MINUTES')
    auth_max_failed_attempts: int = Field(default=5, alias='AUTH_MAX_FAILED_ATTEMPTS')
    auth_lock_minutes: int = Field(default=15, alias='AUTH_LOCK_MINUTES')

    cors_origins: str = Field(default='*', alias='CORS_ORIGINS')
    analytics_legacy_base_url: str = Field(default='http://dashboard:5000', alias='ANALYTICS_LEGACY_BASE_URL')

    demo_admin_user: str = Field(default='admin', alias='DEMO_ADMIN_USER')
    demo_admin_password: str = Field(default='admin123', alias='DEMO_ADMIN_PASSWORD')
    demo_analyst_user: str = Field(default='analyst', alias='DEMO_ANALYST_USER')
    demo_analyst_password: str = Field(default='analyst123', alias='DEMO_ANALYST_PASSWORD')


settings = Settings()
