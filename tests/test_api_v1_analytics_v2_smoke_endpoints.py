import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import inspect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

os.environ['DATABASE_URL'] = 'sqlite:///./data/test_app_v1.db'
os.environ['DB_BOOTSTRAP_ON_START'] = 'false'
os.environ['DB_DEMO_PROBE_ON_START'] = 'false'
os.environ.setdefault('JWT_SECRET_KEY', 'test_secret_key')
os.environ.setdefault('JWT_REFRESH_SECRET_KEY', 'test_refresh_secret')

from app.main import app  # noqa: E402
from app.core.rate_limit import rate_limiter  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.brokers import AnalyticsSourceFreshness, AuthSession, AuthUser, AuthUserState  # noqa: E402

SMOKE_ADMIN_USER = os.environ.get('TEST_SMOKE_ADMIN_USER', 'smoke_admin')
SMOKE_ADMIN_PASSWORD = os.environ.get('TEST_SMOKE_ADMIN_PASSWORD', 'change_me_smoke_admin_password')


class ApiV1AnalyticsV2SmokeEndpointsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        def ensure_table(model):
            if not inspect(engine).has_table(model.__tablename__):
                model.__table__.create(bind=engine, checkfirst=True)

        ensure_table(AuthUser)
        ensure_table(AuthUserState)
        ensure_table(AuthSession)
        ensure_table(AnalyticsSourceFreshness)
        cls.client = TestClient(app)
        db = SessionLocal()
        try:
            db.query(AuthUserState).delete()
            row = db.query(AuthUser).filter(AuthUser.username == SMOKE_ADMIN_USER).first()
            if row is None:
                row = AuthUser(
                    username=SMOKE_ADMIN_USER,
                    password_hash=hash_password(SMOKE_ADMIN_PASSWORD),
                    role='admin',
                    is_active=True,
                )
                db.add(row)
            else:
                row.password_hash = hash_password(SMOKE_ADMIN_PASSWORD)
                row.role = 'admin'
                row.is_active = True
            db.commit()
        finally:
            db.close()

    def _auth_headers(self) -> dict[str, str]:
        rate_limiter._events.clear()
        login = self.client.post(
            '/api/v1/auth/login',
            json={'username': SMOKE_ADMIN_USER, 'password': SMOKE_ADMIN_PASSWORD},
        )
        self.assertEqual(login.status_code, 200, login.json())
        token = login.json().get('access_token')
        self.assertTrue(token)
        return {'Authorization': f'Bearer {token}'}

    def _assert_meta_min(self, payload: dict):
        meta = dict(payload.get('meta') or {})
        self.assertIn('source_table', meta)
        self.assertIn('cache_hit', meta)
        self.assertIn('pipeline_version', meta)
        # Puede venir null si no hay freshness cargada aun.
        self.assertIn('data_freshness_at', meta)

    def test_smoke_portfolio_corte_v2_options(self):
        headers = self._auth_headers()
        fake_payload = {'options': {'un': ['ODONTOLOGIA TTO'], 'gestion_month': ['03/2026']}, 'meta': {}}
        with patch('app.services.analytics_service.AnalyticsService.fetch_portfolio_corte_options_v2', return_value=fake_payload):
            r = self.client.post('/api/v1/analytics/portfolio-corte-v2/options', json={}, headers=headers)
        self.assertEqual(r.status_code, 200, r.json())
        body = r.json()
        self.assertIn('options', body)
        self._assert_meta_min(body)

    def test_smoke_portfolio_corte_v2_summary(self):
        headers = self._auth_headers()
        fake_payload = {'kpis': {'contracts_total': 1, 'monto_total': 100.0}, 'charts': {}, 'meta': {}}
        with patch('app.services.analytics_service.AnalyticsService.fetch_portfolio_corte_summary_v2', return_value=fake_payload):
            r = self.client.post('/api/v1/analytics/portfolio-corte-v2/summary', json={'include_rows': False}, headers=headers)
        self.assertEqual(r.status_code, 200, r.json())
        body = r.json()
        self.assertIn('kpis', body)
        self._assert_meta_min(body)

    def test_smoke_rendimiento_v2_options(self):
        headers = self._auth_headers()
        fake_payload = {'options': {'un': ['ODONTOLOGIA TTO'], 'tramo': ['0']}, 'meta': {}}
        with patch('app.services.analytics_service.AnalyticsService.fetch_rendimiento_options_v2', return_value=fake_payload):
            r = self.client.post('/api/v1/analytics/rendimiento-v2/options', json={}, headers=headers)
        self.assertEqual(r.status_code, 200, r.json())
        body = r.json()
        self.assertIn('options', body)
        self._assert_meta_min(body)

    def test_smoke_rendimiento_v2_summary(self):
        headers = self._auth_headers()
        fake_payload = {'kpis': {'contracts_total': 1, 'paid_total': 10.0}, 'rows': [], 'meta': {}}
        with patch('app.services.analytics_service.AnalyticsService.fetch_rendimiento_summary_v2', return_value=fake_payload):
            r = self.client.post('/api/v1/analytics/rendimiento-v2/summary', json={}, headers=headers)
        self.assertEqual(r.status_code, 200, r.json())
        body = r.json()
        self.assertIn('kpis', body)
        self._assert_meta_min(body)


if __name__ == '__main__':
    unittest.main()
