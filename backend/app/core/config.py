from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'cobranzas-api-v1'
    app_env: str = Field(default='dev', alias='APP_ENV')
    app_port: int = Field(default=8000, alias='APP_PORT')

    database_url: str = Field(default='sqlite:///./data/app_v1.db', alias='DATABASE_URL')
    postgres_db: str = Field(default='cobranzas_prod', alias='POSTGRES_DB')
    postgres_user: str = Field(default='cobranzas_user', alias='POSTGRES_USER')
    postgres_password: str = Field(default='', alias='POSTGRES_PASSWORD')
    postgres_host: str = Field(default='postgres', alias='POSTGRES_HOST')
    postgres_port: int = Field(default=5432, alias='POSTGRES_PORT')

    jwt_secret_key: str = Field(default='change_me_jwt_secret', alias='JWT_SECRET_KEY')
    jwt_refresh_secret_key: str = Field(default='change_me_refresh_secret', alias='JWT_REFRESH_SECRET_KEY')
    jwt_algorithm: str = Field(default='HS256', alias='JWT_ALGORITHM')
    jwt_expire_minutes: int = Field(default=120, alias='JWT_EXPIRE_MINUTES')
    jwt_refresh_expire_minutes: int = Field(default=60 * 24 * 30, alias='JWT_REFRESH_EXPIRE_MINUTES')
    auth_max_failed_attempts: int = Field(default=5, alias='AUTH_MAX_FAILED_ATTEMPTS')
    auth_lock_minutes: int = Field(default=15, alias='AUTH_LOCK_MINUTES')
    auth_login_rate_limit: int = Field(default=10, alias='AUTH_LOGIN_RATE_LIMIT')
    auth_login_rate_window_seconds: int = Field(default=60, alias='AUTH_LOGIN_RATE_WINDOW_SECONDS')
    write_rate_limit: int = Field(default=30, alias='WRITE_RATE_LIMIT')
    write_rate_window_seconds: int = Field(default=60, alias='WRITE_RATE_WINDOW_SECONDS')

    cors_origins: str = Field(default='*', alias='CORS_ORIGINS')
    analytics_legacy_base_url: str = Field(default='http://dashboard:5000', alias='ANALYTICS_LEGACY_BASE_URL')
    analytics_legacy_timeout_seconds: int = Field(default=120, alias='ANALYTICS_LEGACY_TIMEOUT_SECONDS')

    demo_admin_user: str = Field(default='admin', alias='DEMO_ADMIN_USER')
    demo_admin_password: str = Field(default='change_me_demo_admin_password', alias='DEMO_ADMIN_PASSWORD')
    demo_analyst_user: str = Field(default='analyst', alias='DEMO_ANALYST_USER')
    demo_analyst_password: str = Field(default='change_me_demo_analyst_password', alias='DEMO_ANALYST_PASSWORD')

    mysql_host: str = Field(default='localhost', alias='MYSQL_HOST')
    mysql_port: int = Field(default=3306, alias='MYSQL_PORT')
    mysql_user: str = Field(default='root', alias='MYSQL_USER')
    mysql_password: str = Field(default='', alias='MYSQL_PASSWORD')
    mysql_database: str = Field(default='', alias='MYSQL_DATABASE')
    sync_window_months: int = Field(default=3, alias='SYNC_WINDOW_MONTHS')
    sync_max_rows: int = Field(default=250000, alias='SYNC_MAX_ROWS')
    sync_max_rows_analytics: int = Field(default=0, alias='SYNC_MAX_ROWS_ANALYTICS')
    sync_max_rows_cartera: int = Field(default=0, alias='SYNC_MAX_ROWS_CARTERA')
    sync_max_rows_cobranzas: int = Field(default=0, alias='SYNC_MAX_ROWS_COBRANZAS')
    sync_max_rows_contratos: int = Field(default=0, alias='SYNC_MAX_ROWS_CONTRATOS')
    sync_max_rows_gestores: int = Field(default=0, alias='SYNC_MAX_ROWS_GESTORES')
    sync_preview_enabled: bool = Field(default=True, alias='SYNC_PREVIEW_ENABLED')
    sync_worker_idle_sleep_seconds: float = Field(default=1.5, alias='SYNC_WORKER_IDLE_SLEEP_SECONDS')
    sync_fetch_batch_size: int = Field(default=5000, alias='SYNC_FETCH_BATCH_SIZE')
    sync_fetch_batch_size_analytics: int = Field(default=0, alias='SYNC_FETCH_BATCH_SIZE_ANALYTICS')
    sync_fetch_batch_size_cartera: int = Field(default=0, alias='SYNC_FETCH_BATCH_SIZE_CARTERA')
    sync_fetch_batch_size_cobranzas: int = Field(default=0, alias='SYNC_FETCH_BATCH_SIZE_COBRANZAS')
    sync_fetch_batch_size_contratos: int = Field(default=0, alias='SYNC_FETCH_BATCH_SIZE_CONTRATOS')
    sync_fetch_batch_size_gestores: int = Field(default=0, alias='SYNC_FETCH_BATCH_SIZE_GESTORES')
    sync_chunk_size: int = Field(default=10000, alias='SYNC_CHUNK_SIZE')
    sync_chunk_size_analytics: int = Field(default=0, alias='SYNC_CHUNK_SIZE_ANALYTICS')
    sync_chunk_size_cartera: int = Field(default=0, alias='SYNC_CHUNK_SIZE_CARTERA')
    sync_chunk_size_cobranzas: int = Field(default=0, alias='SYNC_CHUNK_SIZE_COBRANZAS')
    sync_chunk_size_contratos: int = Field(default=0, alias='SYNC_CHUNK_SIZE_CONTRATOS')
    sync_chunk_size_gestores: int = Field(default=0, alias='SYNC_CHUNK_SIZE_GESTORES')
    sync_mysql_incremental_pushdown: bool = Field(default=True, alias='SYNC_MYSQL_INCREMENTAL_PUSHDOWN')
    sync_staging_retention_days: int = Field(default=14, alias='SYNC_STAGING_RETENTION_DAYS')
    sync_persist_staging_rows: bool = Field(default=False, alias='SYNC_PERSIST_STAGING_ROWS')
    analytics_sync_mode: str = Field(default='incremental', alias='ANALYTICS_SYNC_MODE')
    analytics_sync_window_months: int = Field(default=3, alias='ANALYTICS_SYNC_WINDOW_MONTHS')
    read_from_fact_tables: bool = Field(default=True, alias='READ_FROM_FACT_TABLES')


settings = Settings()
