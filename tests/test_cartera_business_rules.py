import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.sync_service import _fact_row_from_normalized, _normalize_record  # noqa: E402


class CarteraBusinessRulesTests(unittest.TestCase):
    def test_tramo_comes_from_cuotas_vencidas(self):
        row = {
            "contract_id": "C-1",
            "fecha_cierre": "2026-02-28",
            "cuotas_vencidas": "1",
            "tramo": "7",
            "UN": "ODONTOLOGIA",
            "Supervisor": "SUP",
            "via_de_cobro": "COBRADOR",
        }
        normalized = _normalize_record("cartera", row, seq=1)
        self.assertEqual(normalized["tramo"], 1)

    def test_tramo_zero_when_cuotas_vencidas_zero(self):
        row = {
            "contract_id": "C-2",
            "fecha_cierre": "2026-02-28",
            "cuotas_vencidas": "0",
            "UN": "ODONTOLOGIA",
            "Supervisor": "SUP",
            "via_de_cobro": "COBRADOR",
        }
        normalized = _normalize_record("cartera", row, seq=2)
        self.assertEqual(normalized["tramo"], 0)

    def test_monto_a_cobrar_formula_uses_vencido_plus_cuota(self):
        payload = {
            "monto_vencido": "1000",
            "monto_cuota": "250",
            "total_saldo": "5000",
        }
        normalized = {
            "domain": "cartera",
            "contract_id": "C-3",
            "gestion_month": "03/2026",
            "supervisor": "SUP",
            "un": "ODONTOLOGIA",
            "via": "COBRADOR",
            "tramo": 2,
            "close_date": "2026-02-28",
            "close_month": "02/2026",
            "source_hash": "abc",
            "payload_json": json.dumps(payload),
        }
        fact_row = _fact_row_from_normalized("cartera", normalized)
        monto_vencido = float(fact_row["monto_vencido"] or 0.0)
        cuota = float(fact_row["cuota_amount"] or 0.0)
        monto_a_cobrar = monto_vencido + cuota
        self.assertEqual(monto_vencido, 1000.0)
        self.assertEqual(cuota, 250.0)
        self.assertEqual(monto_a_cobrar, 1250.0)
        self.assertNotEqual(monto_a_cobrar, monto_vencido)


if __name__ == "__main__":
    unittest.main()
