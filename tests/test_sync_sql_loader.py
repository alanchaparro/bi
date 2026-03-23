import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))

os.environ['DATABASE_URL'] = 'sqlite:///./data/test_app_v1.db'
os.environ.setdefault('JWT_SECRET_KEY', 'test_secret_key')
os.environ.setdefault('JWT_REFRESH_SECRET_KEY', 'test_refresh_secret')

from app.services.sync_service import _load_sql_with_includes  # noqa: E402


class SyncSqlLoaderTests(unittest.TestCase):
    def setUp(self):
        self.repo_root = ROOT
        self.common_root = self.repo_root / 'sql' / 'common'
        self.v2_root = self.repo_root / 'sql' / 'v2'
        self.temp_files: list[Path] = []
        self.addCleanup(self._cleanup_temp_files)

    def _new_temp_sql_file_in(self, parent: Path, prefix: str) -> Path:
        fd, raw = tempfile.mkstemp(dir=parent, prefix=prefix, suffix='.sql')
        os.close(fd)
        path = Path(raw)
        self.temp_files.append(path)
        return path

    def _cleanup_temp_files(self) -> None:
        for path in reversed(self.temp_files):
            try:
                path.unlink(missing_ok=True)
            except Exception:
                pass
        self.temp_files.clear()

    def test_include_simple(self):
        query_path = self._new_temp_sql_file_in(self.v2_root, 'tmp_query_simple_')
        query_path.write_text(
            "SELECT (\n-- @include sql/common/un_rules.sql\n) AS un_value;\n",
            encoding='utf-8',
        )
        sql, includes = _load_sql_with_includes(query_path)
        self.assertIn("ODONTOLOGIA TTO", sql)
        self.assertIn('sql/common/un_rules.sql', includes)

    def test_include_nested(self):
        nested = self._new_temp_sql_file_in(self.common_root, 'tmp_nested_')
        first = self._new_temp_sql_file_in(self.common_root, 'tmp_first_')
        rel_nested = nested.resolve().relative_to(self.repo_root.resolve()).as_posix()
        rel_first = first.resolve().relative_to(self.repo_root.resolve()).as_posix()
        nested.write_text("SELECT 'ok' AS nested_value;\n", encoding='utf-8')
        first.write_text(f"-- @include {rel_nested}\n", encoding='utf-8')
        query_path = self._new_temp_sql_file_in(self.v2_root, 'tmp_query_nested_')
        query_path.write_text(f"-- @include {rel_first}\n", encoding='utf-8')
        sql, includes = _load_sql_with_includes(query_path)
        self.assertIn("nested_value", sql)
        self.assertIn(rel_first, includes)
        self.assertIn(rel_nested, includes)

    def test_include_missing_file(self):
        query_path = self._new_temp_sql_file_in(self.v2_root, 'tmp_query_missing_')
        query_path.write_text("-- @include sql/common/does_not_exist.sql\n", encoding='utf-8')
        with self.assertRaises(FileNotFoundError):
            _load_sql_with_includes(query_path)

    def test_include_path_traversal_blocked(self):
        query_path = self._new_temp_sql_file_in(self.v2_root, 'tmp_query_traversal_')
        query_path.write_text("-- @include ../tests/test_env_example.py\n", encoding='utf-8')
        with self.assertRaises(ValueError):
            _load_sql_with_includes(query_path)

    def test_include_depth_exceeded(self):
        chain = [self._new_temp_sql_file_in(self.common_root, f'tmp_d{idx}_') for idx in range(7)]
        rel_chain = [p.resolve().relative_to(self.repo_root.resolve()).as_posix() for p in chain]
        for idx, current in enumerate(chain):
            if idx == len(chain) - 1:
                current.write_text("SELECT 1 AS ok;\n", encoding='utf-8')
            else:
                current.write_text(f"-- @include {rel_chain[idx + 1]}\n", encoding='utf-8')
        query_path = self._new_temp_sql_file_in(self.v2_root, 'tmp_query_depth_')
        query_path.write_text(f"-- @include {rel_chain[0]}\n", encoding='utf-8')
        with self.assertRaises(ValueError):
            _load_sql_with_includes(query_path)


if __name__ == '__main__':
    unittest.main()
