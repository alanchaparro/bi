import os
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

os.environ.setdefault('DATABASE_URL', 'sqlite:///./data/test_app_v1.db')
os.environ.setdefault('JWT_SECRET_KEY', 'test_secret_key')

from app.main import app  # noqa: E402


class ApiV1BrokersConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        r = cls.client.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'admin123'})
        assert r.status_code == 200
        cls.token = r.json()['access_token']
        cls.headers = {'Authorization': f'Bearer {cls.token}'}

        r2 = cls.client.post('/api/v1/auth/login', json={'username': 'analyst', 'password': 'analyst123'})
        assert r2.status_code == 200
        cls.analyst_headers = {'Authorization': f"Bearer {r2.json()['access_token']}"}

    def test_health(self):
        r = self.client.get('/api/v1/health')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json().get('ok'))

    def test_supervisors_scope_roundtrip(self):
        payload = {'supervisors': ['FVBROKEREAS', 'FVBROKEREASCDE']}
        post_r = self.client.post('/api/v1/brokers/supervisors-scope', json=payload, headers=self.headers)
        self.assertEqual(post_r.status_code, 200)
        get_r = self.client.get('/api/v1/brokers/supervisors-scope', headers=self.headers)
        self.assertEqual(get_r.status_code, 200)
        self.assertIn('FVBROKEREAS', get_r.json()['supervisors'])

    def test_preferences_roundtrip(self):
        payload = {
            'filters': {
                'supervisors': ['FVBROKEREAS'],
                'uns': ['MEDICINA ESTETICA'],
                'vias': ['COBRADOR'],
                'years': ['2026'],
                'months': ['01/2026'],
            }
        }
        post_r = self.client.post('/api/v1/brokers/preferences', json=payload, headers=self.headers)
        self.assertEqual(post_r.status_code, 200)
        get_r = self.client.get('/api/v1/brokers/preferences', headers=self.headers)
        self.assertEqual(get_r.status_code, 200)
        self.assertEqual(get_r.json().get('filters', {}).get('vias'), ['COBRADOR'])

    def test_rbac_negative_on_write(self):
        payload = {'rules': []}
        r = self.client.post('/api/v1/brokers/commissions', json=payload, headers=self.analyst_headers)
        self.assertEqual(r.status_code, 403)

    def test_forbidden_without_token(self):
        r = self.client.get('/api/v1/brokers/commissions')
        self.assertEqual(r.status_code, 401)


if __name__ == '__main__':
    unittest.main()
