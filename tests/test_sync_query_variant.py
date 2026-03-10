import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

os.environ.setdefault('DATABASE_URL', 'sqlite:///./data/test_app_v1.db')
os.environ.setdefault('JWT_SECRET_KEY', 'test_secret_key')
os.environ.setdefault('JWT_REFRESH_SECRET_KEY', 'test_refresh_secret')

from app.core.config import settings  # noqa: E402
from app.services import sync_service  # noqa: E402


class SyncQueryVariantTests(unittest.TestCase):
    def test_default_v1_for_cartera(self):
        with patch.object(settings, 'sync_query_variant_cartera', 'v1'):
            self.assertEqual(sync_service._query_variant_for_domain('cartera'), 'v1')
            self.assertEqual(sync_service._query_file_for('cartera'), 'query.sql')

    def test_v2_variant_for_cartera(self):
        with patch.object(settings, 'sync_query_variant_cartera', 'v2'):
            self.assertEqual(sync_service._query_variant_for_domain('cartera'), 'v2')
            self.assertEqual(sync_service._query_file_for('cartera'), 'sql/v2/query_cartera.sql')
            self.assertTrue(sync_service._query_path_for('cartera').as_posix().endswith('sql/v2/query_cartera.sql'))

    def test_v2_variant_for_all_supported_domains(self):
        with patch.object(settings, 'sync_query_variant_cartera', 'v2'):
            with patch.object(settings, 'sync_query_variant_cobranzas', 'v2'):
                with patch.object(settings, 'sync_query_variant_contratos', 'v2'):
                    with patch.object(settings, 'sync_query_variant_gestores', 'v2'):
                        self.assertEqual(sync_service._query_file_for('cartera'), 'sql/v2/query_cartera.sql')
                        self.assertEqual(sync_service._query_file_for('cobranzas'), 'sql/v2/query_cobranzas.sql')
                        self.assertEqual(sync_service._query_file_for('contratos'), 'sql/v2/query_contratos.sql')
                        self.assertEqual(sync_service._query_file_for('gestores'), 'sql/v2/query_gestores.sql')

    def test_invalid_variant_falls_back_to_v1(self):
        with patch.object(settings, 'sync_query_variant_cartera', 'invalid'):
            with self.assertLogs('app.services.sync_service', level='WARNING') as logs:
                variant = sync_service._query_variant_for_domain('cartera')
            self.assertEqual(variant, 'v1')
            self.assertIn('fallback=v1', '\n'.join(logs.output))


if __name__ == '__main__':
    unittest.main()
