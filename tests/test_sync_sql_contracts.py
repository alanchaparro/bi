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

from app.services.sync_service import _load_sql_with_includes  # noqa: E402


DOMAIN_V1_FILES = {
    'cartera': 'query.sql',
    'cobranzas': 'query_cobranzas.sql',
    'contratos': 'query_contratos.sql',
    'gestores': 'query_gestores.sql',
}
DOMAIN_V2_FILES = {
    'cartera': 'sql/v2/query_cartera.sql',
    'cobranzas': 'sql/v2/query_cobranzas.sql',
    'contratos': 'sql/v2/query_contratos.sql',
    'gestores': 'sql/v2/query_gestores.sql',
}
REQUIRED_TOKENS = {
    'cartera': ['id_contrato', 'fecha_cierre', 'cuotas_vencidas', 'monto_vencido', 'via_de_cobro', 'supervisor', 'un'],
    'cobranzas': ['payment_way_id', 'contract_id', 'monto', 'actualizado_al', 'vp', 'un'],
    'contratos': ['c.id', 'c.updated_at', 'supervisor', 'un'],
    'gestores': ['gestor', 'contract_id', 'from_date'],
}


class SyncSqlContractsTests(unittest.TestCase):
    def _v1_sql(self, domain: str) -> str:
        return (ROOT / DOMAIN_V1_FILES[domain]).read_text(encoding='utf-8').lower()

    def _v2_sql(self, domain: str) -> str:
        sql, _ = _load_sql_with_includes(ROOT / DOMAIN_V2_FILES[domain])
        return sql.lower()

    def test_required_tokens_exist_in_v1_and_v2(self):
        for domain, tokens in REQUIRED_TOKENS.items():
            with self.subTest(domain=domain, variant='v1'):
                sql = self._v1_sql(domain)
                for token in tokens:
                    self.assertIn(token, sql)
            with self.subTest(domain=domain, variant='v2'):
                sql = self._v2_sql(domain)
                for token in tokens:
                    self.assertIn(token, sql)

    def test_v2_keeps_enterprise_scope(self):
        scope_re = re.compile(r'in\s*\(\s*1\s*,\s*2\s*,\s*5\s*\)')
        for domain in ['cartera', 'cobranzas', 'contratos', 'gestores']:
            with self.subTest(domain=domain):
                sql = self._v2_sql(domain)
                self.assertRegex(sql, scope_re)


if __name__ == '__main__':
    unittest.main()
