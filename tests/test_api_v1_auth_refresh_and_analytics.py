import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

os.environ.setdefault('DATABASE_URL', 'sqlite:///./data/test_app_v1.db')
os.environ.setdefault('JWT_SECRET_KEY', 'test_secret_key')
os.environ.setdefault('JWT_REFRESH_SECRET_KEY', 'test_refresh_secret')

from app.main import app  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.brokers import AuthUser  # noqa: E402


class ApiV1AuthRefreshAnalyticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_login_refresh_revoke_flow(self):
        login = self.client.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'admin123'})
        self.assertEqual(login.status_code, 200)
        payload = login.json()
        self.assertIn('access_token', payload)
        self.assertIn('refresh_token', payload)

        refresh = self.client.post('/api/v1/auth/refresh', json={'refresh_token': payload['refresh_token']})
        self.assertEqual(refresh.status_code, 200)
        refreshed = refresh.json()
        self.assertNotEqual(refreshed.get('refresh_token'), payload['refresh_token'])

        revoke = self.client.post('/api/v1/auth/revoke', json={'refresh_token': refreshed['refresh_token']})
        self.assertEqual(revoke.status_code, 200)
        self.assertTrue(revoke.json().get('ok'))

    def test_login_with_db_user(self):
        db = SessionLocal()
        try:
            row = db.query(AuthUser).filter(AuthUser.username == 'db_admin').first()
            if row is None:
                db.add(
                    AuthUser(
                        username='db_admin',
                        password_hash=hash_password('db_admin_123'),
                        role='admin',
                        is_active=True,
                    )
                )
                db.commit()
        finally:
            db.close()

        login = self.client.post('/api/v1/auth/login', json={'username': 'db_admin', 'password': 'db_admin_123'})
        self.assertEqual(login.status_code, 200)
        payload = login.json()
        self.assertEqual(payload.get('role'), 'admin')
        self.assertIn('brokers:write_config', payload.get('permissions', []))

    def test_analytics_portfolio_summary(self):
        login = self.client.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'admin123'})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        fake_payload = {'total': 10, 'vigente': 8, 'moroso': 2}
        with patch('app.services.analytics_service.AnalyticsService.fetch_legacy', return_value=fake_payload):
            r = self.client.post('/api/v1/analytics/portfolio/summary', json={}, headers=headers)
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json().get('total'), 10)

    def test_analytics_export_csv_requires_permission(self):
        login = self.client.post('/api/v1/auth/login', json={'username': 'analyst', 'password': 'analyst123'})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        r = self.client.post(
            '/api/v1/analytics/export/csv',
            json={'endpoint': 'portfolio', 'filters': {}},
            headers=headers,
        )
        self.assertEqual(r.status_code, 403)

    def test_invalid_payload_includes_trace_id(self):
        login = self.client.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'admin123'})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        r = self.client.post('/api/v1/auth/revoke', json={'refresh_token': 'a'}, headers=headers)
        self.assertEqual(r.status_code, 422)
        payload = r.json()
        self.assertEqual(payload.get('error_code'), 'INVALID_PAYLOAD')
        self.assertTrue(payload.get('trace_id'))


if __name__ == '__main__':
    unittest.main()
