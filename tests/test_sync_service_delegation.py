import os
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

os.environ['DATABASE_URL'] = 'sqlite:///./data/test_app_v1.db'
os.environ.setdefault('JWT_SECRET_KEY', 'test_secret_key')
os.environ.setdefault('JWT_REFRESH_SECRET_KEY', 'test_refresh_secret')

from app.services import sync_service  # noqa: E402


class SyncServiceDelegationTests(unittest.TestCase):
    def test_single_definition_for_sync_normalization_wrappers(self):
        source = Path(sync_service.__file__).read_text(encoding='utf-8')
        normalize_defs = re.findall(r'^\s*def _normalize_record\(', source, flags=re.MULTILINE)
        fact_defs = re.findall(r'^\s*def _fact_row_from_normalized\(', source, flags=re.MULTILINE)
        self.assertEqual(len(normalize_defs), 1)
        self.assertEqual(len(fact_defs), 1)

    def test_wrappers_delegate_to_sync_normalizers(self):
        normalize_src = Path(sync_service.__file__).read_text(encoding='utf-8')
        self.assertIn('def _normalize_record(domain: str, row: dict, seq: int) -> dict:', normalize_src)
        self.assertIn('return normalize_record(domain, row, seq)', normalize_src)
        self.assertIn('def _fact_row_from_normalized(domain: str, normalized: dict) -> dict:', normalize_src)
        self.assertIn('return fact_row_from_normalized(domain, normalized)', normalize_src)


if __name__ == '__main__':
    unittest.main()
