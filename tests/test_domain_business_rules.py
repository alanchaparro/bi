import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.domain import (  # noqa: E402
    COBRANZAS_EXCLUDED_CONTRACT_IDS,
    ENTERPRISE_SCOPE_IDS,
    canonical_un,
    categoria_from_tramo,
    contract_is_excluded_from_cobranzas,
    enterprise_in_scope,
    monto_a_cobrar,
    rendimiento_cantidad_pct,
    rendimiento_monto_pct,
    tramo_from_cuotas_vencidas,
)
from app.domain.calendar_rules import add_months  # noqa: E402


class DomainBusinessRulesTests(unittest.TestCase):
    def test_close_month_plus_one_is_gestion_month(self):
        self.assertEqual(add_months("02/2026", 1), "03/2026")

    def test_tramo_caps_at_seven(self):
        self.assertEqual(tramo_from_cuotas_vencidas(0), 0)
        self.assertEqual(tramo_from_cuotas_vencidas(1), 1)
        self.assertEqual(tramo_from_cuotas_vencidas(4), 4)
        self.assertEqual(tramo_from_cuotas_vencidas(7), 7)
        self.assertEqual(tramo_from_cuotas_vencidas(10), 7)

    def test_categoria_depends_on_tramo(self):
        self.assertEqual(categoria_from_tramo(0), "VIGENTE")
        self.assertEqual(categoria_from_tramo(3), "VIGENTE")
        self.assertEqual(categoria_from_tramo(4), "MOROSO")

    def test_monto_a_cobrar_rule(self):
        self.assertEqual(monto_a_cobrar(1000, 250), 1250.0)

    def test_rendimiento_rules(self):
        self.assertEqual(rendimiento_monto_pct(500, 800, 200), 0.5)
        self.assertEqual(rendimiento_cantidad_pct(1000, 2000), 0.5)

    def test_canonical_un_keeps_odontologia_tto_separate(self):
        mappings = {"ODONTOLOGIA": "ODONTOLOGIA", "ODONTOLOGIA TTO": "ODONTOLOGIA TTO"}
        self.assertEqual(canonical_un(mappings, "ODONTOLOGIA"), "ODONTOLOGIA")
        self.assertEqual(canonical_un(mappings, "ODONTOLOGIA TTO"), "ODONTOLOGIA TTO")

    def test_exclusion_and_scope_rules(self):
        self.assertTrue(all(enterprise_in_scope(value) for value in ENTERPRISE_SCOPE_IDS))
        self.assertFalse(enterprise_in_scope(9))
        self.assertTrue(all(contract_is_excluded_from_cobranzas(value) for value in COBRANZAS_EXCLUDED_CONTRACT_IDS))
        self.assertFalse(contract_is_excluded_from_cobranzas(12345))


if __name__ == "__main__":
    unittest.main()
