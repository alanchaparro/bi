import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

os.environ.setdefault('DATABASE_URL', 'sqlite:///./data/test_app_v1.db')
os.environ.setdefault('JWT_SECRET_KEY', 'test_secret_key')
os.environ.setdefault('JWT_REFRESH_SECRET_KEY', 'test_refresh_secret')

from app.services.sync_service import _load_sql_with_includes  # noqa: E402


class SyncSqlLoaderTests(unittest.TestCase):
    def setUp(self):
        self.repo_root = ROOT
        self.common_root = self.repo_root / 'sql' / 'common'
        self.v2_root = self.repo_root / 'sql' / 'v2'

    def test_include_simple(self):
        with tempfile.TemporaryDirectory(dir=self.v2_root) as td:
            query_path = Path(td) / 'query_simple.sql'
            query_path.write_text(
                "SELECT (\n-- @include sql/common/un_rules.sql\n) AS un_value;\n",
                encoding='utf-8',
            )
            sql, includes = _load_sql_with_includes(query_path)
            self.assertIn("ODONTOLOGIA TTO", sql)
            self.assertIn('sql/common/un_rules.sql', includes)

    def test_include_nested(self):
        with tempfile.TemporaryDirectory(dir=self.common_root) as td:
            rel_dir = Path(td).resolve().relative_to(self.repo_root.resolve()).as_posix()
            nested = Path(td) / 'nested.sql'
            nested.write_text("SELECT 'ok' AS nested_value;\n", encoding='utf-8')
            first = Path(td) / 'first.sql'
            first.write_text(f"-- @include {rel_dir}/nested.sql\n", encoding='utf-8')
            with tempfile.TemporaryDirectory(dir=self.v2_root) as qd:
                query_path = Path(qd) / 'query_nested.sql'
                query_path.write_text(f"-- @include {rel_dir}/first.sql\n", encoding='utf-8')
                sql, includes = _load_sql_with_includes(query_path)
            self.assertIn("nested_value", sql)
            self.assertIn(f'{rel_dir}/first.sql', includes)
            self.assertIn(f'{rel_dir}/nested.sql', includes)

    def test_include_missing_file(self):
        with tempfile.TemporaryDirectory(dir=self.v2_root) as td:
            query_path = Path(td) / 'query_missing.sql'
            query_path.write_text("-- @include sql/common/does_not_exist.sql\n", encoding='utf-8')
            with self.assertRaises(FileNotFoundError):
                _load_sql_with_includes(query_path)

    def test_include_path_traversal_blocked(self):
        with tempfile.TemporaryDirectory(dir=self.v2_root) as td:
            query_path = Path(td) / 'query_traversal.sql'
            query_path.write_text("-- @include ../tests/test_env_example.py\n", encoding='utf-8')
            with self.assertRaises(ValueError):
                _load_sql_with_includes(query_path)

    def test_include_depth_exceeded(self):
        with tempfile.TemporaryDirectory(dir=self.common_root) as td:
            rel_dir = Path(td).resolve().relative_to(self.repo_root.resolve()).as_posix()
            for idx in range(7):
                current = Path(td) / f'd{idx}.sql'
                if idx == 6:
                    current.write_text("SELECT 1 AS ok;\n", encoding='utf-8')
                else:
                    current.write_text(f"-- @include {rel_dir}/d{idx + 1}.sql\n", encoding='utf-8')
            with tempfile.TemporaryDirectory(dir=self.v2_root) as qd:
                query_path = Path(qd) / 'query_depth.sql'
                query_path.write_text(f"-- @include {rel_dir}/d0.sql\n", encoding='utf-8')
                with self.assertRaises(ValueError):
                    _load_sql_with_includes(query_path)


if __name__ == '__main__':
    unittest.main()
