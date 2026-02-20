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
from app.core.rate_limit import rate_limiter  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.brokers import AnalyticsContractSnapshot, AuthUser, AuthUserState  # noqa: E402

TEST_ADMIN_USER = os.environ.get('TEST_ADMIN_USER', os.environ.get('DEMO_ADMIN_USER', 'admin'))
TEST_ADMIN_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', os.environ.get('DEMO_ADMIN_PASSWORD', 'change_me_demo_admin_password'))
TEST_ANALYST_USER = os.environ.get('TEST_ANALYST_USER', os.environ.get('DEMO_ANALYST_USER', 'analyst'))
TEST_ANALYST_PASSWORD = os.environ.get('TEST_ANALYST_PASSWORD', os.environ.get('DEMO_ANALYST_PASSWORD', 'change_me_demo_analyst_password'))


class ApiV1AuthRefreshAnalyticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db = SessionLocal()
        try:
            db.query(AuthUserState).delete()
            db.query(AuthUser).filter(AuthUser.username.in_([TEST_ADMIN_USER, TEST_ANALYST_USER])).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()
        rate_limiter._events.clear()
        cls.client = TestClient(app)

    def test_login_refresh_revoke_flow(self):
        login = self.client.post('/api/v1/auth/login', json={'username': TEST_ADMIN_USER, 'password': TEST_ADMIN_PASSWORD})
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
        login = self.client.post('/api/v1/auth/login', json={'username': TEST_ADMIN_USER, 'password': TEST_ADMIN_PASSWORD})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        fake_payload = {'total_contracts': 10, 'debt_total': 1000.0, 'expired_total': 100.0, 'charts': {}}
        with patch('app.services.analytics_service.AnalyticsService.fetch_portfolio_summary_v1', return_value=fake_payload):
            r = self.client.post('/api/v1/analytics/portfolio/summary', json={}, headers=headers)
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json().get('total_contracts'), 10)

    def test_analytics_portfolio_options_uses_cache(self):
        login = self.client.post('/api/v1/auth/login', json={'username': TEST_ADMIN_USER, 'password': TEST_ADMIN_PASSWORD})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        fake_options = {
            'options': {
                'uns': ['ODONTOLOGIA'],
                'tramos': ['0', '1'],
                'categories': ['VIGENTE'],
                'months': ['01/2021'],
            },
            'meta': {'source_table': 'cartera_fact', 'generated_at': '2026-01-01T00:00:00'},
        }
        with patch('app.services.analytics_service.AnalyticsService.fetch_portfolio_options_v1', return_value=fake_options) as mocked:
            payload = {'un': ['__CACHE_TEST__']}
            r1 = self.client.post('/api/v1/analytics/portfolio/options', json=payload, headers=headers)
            r2 = self.client.post('/api/v1/analytics/portfolio/options', json=payload, headers=headers)
            self.assertEqual(r1.status_code, 200)
            self.assertEqual(r2.status_code, 200)
            self.assertEqual(r1.json().get('options', {}).get('uns'), ['ODONTOLOGIA'])
            self.assertEqual(mocked.call_count, 1)

    def test_analytics_portfolio_summary_uses_cache_when_include_rows_false(self):
        login = self.client.post('/api/v1/auth/login', json={'username': TEST_ADMIN_USER, 'password': TEST_ADMIN_PASSWORD})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        fake_summary = {'total_contracts': 20, 'debt_total': 200.0, 'expired_total': 20.0, 'charts': {}, 'rows': []}
        with patch('app.services.analytics_service.AnalyticsService.fetch_portfolio_summary_v1', return_value=fake_summary) as mocked:
            payload = {'un': ['__CACHE_SUMMARY__'], 'include_rows': False}
            r1 = self.client.post('/api/v1/analytics/portfolio/summary', json=payload, headers=headers)
            r2 = self.client.post('/api/v1/analytics/portfolio/summary', json=payload, headers=headers)
            self.assertEqual(r1.status_code, 200)
            self.assertEqual(r2.status_code, 200)
            self.assertEqual(r1.json().get('total_contracts'), 20)
            self.assertEqual(mocked.call_count, 1)

    def test_analytics_export_csv_requires_permission(self):
        login = self.client.post('/api/v1/auth/login', json={'username': TEST_ANALYST_USER, 'password': TEST_ANALYST_PASSWORD})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        r = self.client.post(
            '/api/v1/analytics/export/csv',
            json={'endpoint': 'portfolio', 'filters': {}},
            headers=headers,
        )
        self.assertEqual(r.status_code, 403)

    def test_analytics_brokers_summary_v1_native(self):
        db = SessionLocal()
        try:
            db.query(AnalyticsContractSnapshot).delete()
            db.add(
                AnalyticsContractSnapshot(
                    contract_id='1001',
                    sale_month='01/2026',
                    close_month='05/2026',
                    supervisor='FVBROKEREAS',
                    un='MEDICINA ESTETICA',
                    via='COBRADOR',
                    tramo=4,
                    debt=120.0,
                    paid=10.0,
                )
            )
            db.commit()
        finally:
            db.close()

        login = self.client.post('/api/v1/auth/login', json={'username': TEST_ADMIN_USER, 'password': TEST_ADMIN_PASSWORD})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        r = self.client.post('/api/v1/analytics/brokers/summary', json={'supervisor': ['FVBROKEREAS']}, headers=headers)
        self.assertEqual(r.status_code, 200)
        payload = r.json()
        self.assertIn('rows', payload)
        self.assertEqual(payload.get('meta', {}).get('source'), 'api-v1')

    def test_analytics_brokers_summary_does_not_require_legacy(self):
        db = SessionLocal()
        try:
            db.query(AnalyticsContractSnapshot).delete()
            db.add(
                AnalyticsContractSnapshot(
                    contract_id='2001',
                    sale_month='02/2026',
                    close_month='06/2026',
                    supervisor='FVBROKEREASCDE',
                    un='MEDICINA ESTETICA',
                    via='DEBITO',
                    tramo=5,
                    debt=90.0,
                    paid=20.0,
                )
            )
            db.commit()
        finally:
            db.close()

        login = self.client.post('/api/v1/auth/login', json={'username': TEST_ADMIN_USER, 'password': TEST_ADMIN_PASSWORD})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        with patch('app.services.analytics_service.AnalyticsService.fetch_legacy', side_effect=RuntimeError('legacy down')):
            r = self.client.post('/api/v1/analytics/brokers/summary', json={'supervisor': ['FVBROKEREASCDE']}, headers=headers)
            self.assertEqual(r.status_code, 200)
            self.assertIsInstance(r.json().get('rows'), list)

    def test_invalid_payload_includes_trace_id(self):
        login = self.client.post('/api/v1/auth/login', json={'username': TEST_ADMIN_USER, 'password': TEST_ADMIN_PASSWORD})
        token = login.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        r = self.client.post('/api/v1/auth/revoke', json={'refresh_token': 'a'}, headers=headers)
        self.assertEqual(r.status_code, 422)
        payload = r.json()
        self.assertEqual(payload.get('error_code'), 'INVALID_PAYLOAD')
        self.assertTrue(payload.get('trace_id'))


if __name__ == '__main__':
    unittest.main()
