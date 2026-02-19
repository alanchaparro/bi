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

TEST_ADMIN_USER = os.environ.get('TEST_ADMIN_USER', 'admin')
TEST_ADMIN_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'change_me_demo_admin_password')


class ApiV1SyncTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        login = cls.client.post('/api/v1/auth/login', json={'username': TEST_ADMIN_USER, 'password': TEST_ADMIN_PASSWORD})
        assert login.status_code == 200, login.json()
        cls.headers = {'Authorization': f"Bearer {login.json()['access_token']}"}

    def test_sync_run_contract(self):
        with patch('app.api.v1.endpoints.sync.SyncService.start') as mocked:
            mocked.return_value = {
                'job_id': 'job-1',
                'domain': 'analytics',
                'mode': 'full_all',
                'year_from': None,
                'started_at': '2026-02-17T00:00:00+00:00',
                'status': 'accepted',
            }
            r = self.client.post('/api/v1/sync/run', json={'domain': 'analytics'}, headers=self.headers)
            self.assertEqual(r.status_code, 202)
            self.assertEqual(r.json().get('job_id'), 'job-1')

    def test_sync_status_contract(self):
        with patch('app.api.v1.endpoints.sync.SyncService.status') as mocked:
            mocked.return_value = {
                'job_id': 'job-1',
                'domain': 'analytics',
                'running': False,
                'stage': 'completed',
                'progress_pct': 100,
                'status_message': 'ok',
                'mode': 'full_all',
                'year_from': None,
                'rows_inserted': 10,
                'rows_updated': 0,
                'rows_skipped': 0,
                'duplicates_detected': 0,
                'error': None,
                'log': ['ok'],
                'started_at': '2026-02-17T00:00:00+00:00',
                'finished_at': '2026-02-17T00:01:00+00:00',
                'duration_sec': 60,
            }
            r = self.client.get('/api/v1/sync/status?domain=analytics&job_id=job-1', headers=self.headers)
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json().get('rows_inserted'), 10)


if __name__ == '__main__':
    unittest.main()
