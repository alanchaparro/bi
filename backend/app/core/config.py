from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'cobranzas-api-v1'
    app_env: str = Field(default='dev', alias='APP_ENV')
    app_port: int = Field(default=8000, alias='APP_PORT')

    database_url: str = Field(default='sqlite:///./data/app_v1.db', alias='DATABASE_URL')

    jwt_secret_key: str = Field(default='change_me_jwt_secret', alias='JWT_SECRET_KEY')
    jwt_algorithm: str = Field(default='HS256', alias='JWT_ALGORITHM')
    jwt_expire_minutes: int = Field(default=120, alias='JWT_EXPIRE_MINUTES')

    cors_origins: str = Field(default='*', alias='CORS_ORIGINS')

    demo_admin_user: str = Field(default='admin', alias='DEMO_ADMIN_USER')
    demo_admin_password: str = Field(default='admin123', alias='DEMO_ADMIN_PASSWORD')
    demo_analyst_user: str = Field(default='analyst', alias='DEMO_ANALYST_USER')
    demo_analyst_password: str = Field(default='analyst123', alias='DEMO_ANALYST_PASSWORD')


settings = Settings()
