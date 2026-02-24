"""Tests para validación de configuración de producción (prod_check)."""
import unittest
from unittest.mock import patch

from app.core.prod_check import INSECURE_DEFAULTS, validate_production_config


class TestProdCheck(unittest.TestCase):
    """Validación en arranque para APP_ENV=prod."""

    @patch("app.core.prod_check.settings")
    def test_skip_validation_when_not_prod(self, mock_settings):
        mock_settings.app_env = "dev"
        mock_settings.cors_origins = "*"
        validate_production_config()  # no raise

    @patch("app.core.prod_check.settings")
    def test_prod_fails_when_cors_is_wildcard(self, mock_settings):
        mock_settings.app_env = "prod"
        mock_settings.cors_origins = "*"
        mock_settings.jwt_secret_key = "a-secret"
        mock_settings.jwt_refresh_secret_key = "b-secret"
        mock_settings.database_url = "postgresql://u:p@h/d"
        mock_settings.postgres_password = "safe"
        with self.assertRaises(RuntimeError) as ctx:
            validate_production_config()
        self.assertIn("CORS_ORIGINS", str(ctx.exception))

    @patch("app.core.prod_check.settings")
    def test_prod_fails_when_jwt_defaults(self, mock_settings):
        mock_settings.app_env = "prod"
        mock_settings.cors_origins = "https://app.example.com"
        mock_settings.jwt_secret_key = INSECURE_DEFAULTS["JWT_SECRET_KEY"]
        mock_settings.jwt_refresh_secret_key = "other"
        mock_settings.database_url = "postgresql://u:p@h/d"
        mock_settings.postgres_password = "safe"
        with self.assertRaises(RuntimeError) as ctx:
            validate_production_config()
        self.assertIn("JWT_SECRET_KEY", str(ctx.exception))

    @patch("app.core.prod_check.settings")
    def test_prod_fails_when_postgres_password_placeholder(self, mock_settings):
        mock_settings.app_env = "prod"
        mock_settings.cors_origins = "https://app.example.com"
        mock_settings.jwt_secret_key = "secret"
        mock_settings.jwt_refresh_secret_key = "refresh"
        mock_settings.database_url = "postgresql://u:change_me@h/d"
        mock_settings.postgres_password = "change_me_postgres"
        with self.assertRaises(RuntimeError) as ctx:
            validate_production_config()
        self.assertIn("POSTGRES_PASSWORD", str(ctx.exception))

    @patch("app.core.prod_check.settings")
    def test_prod_passes_with_valid_config(self, mock_settings):
        mock_settings.app_env = "prod"
        mock_settings.cors_origins = "https://app.example.com,https://other.example.com"
        mock_settings.jwt_secret_key = "a-strong-secret"
        mock_settings.jwt_refresh_secret_key = "another-strong-secret"
        mock_settings.database_url = "postgresql://u:strongpwd@host/db"
        mock_settings.postgres_password = "strongpwd"
        validate_production_config()  # no raise
