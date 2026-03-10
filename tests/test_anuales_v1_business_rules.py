import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ["DATABASE_URL"] = "sqlite:///./data/test_app_v1.db"

from app.services.analytics_service import AnalyticsService  # noqa: E402


def s(mm_yyyy: str) -> int:
    month, year = mm_yyyy.split("/")
    return int(year) * 12 + int(month)


class AnualesV1BusinessRulesTests(unittest.TestCase):
    def setUp(self):
        self.cartera_rows = [
            {"contract_id": "1", "gestion_month": "01/2025", "tramo": 2, "monto_cuota": 100.0, "cuota_has_value": True},
            {"contract_id": "1", "gestion_month": "02/2025", "tramo": 2, "monto_cuota": 100.0, "cuota_has_value": True},
            {"contract_id": "1", "gestion_month": "03/2025", "tramo": 2, "monto_cuota": 100.0, "cuota_has_value": True},
            {"contract_id": "1", "gestion_month": "04/2025", "tramo": 5, "monto_cuota": 100.0, "cuota_has_value": True},
            {"contract_id": "2", "gestion_month": "01/2025", "tramo": 2, "monto_cuota": 200.0, "cuota_has_value": True},
            {"contract_id": "2", "gestion_month": "02/2025", "tramo": 2, "monto_cuota": 200.0, "cuota_has_value": True},
            {"contract_id": "2", "gestion_month": "03/2025", "tramo": 2, "monto_cuota": 200.0, "cuota_has_value": True},
            {"contract_id": "2", "gestion_month": "04/2025", "tramo": 4, "monto_cuota": 200.0, "cuota_has_value": True},
        ]
        self.contract_rows = [
            {
                "contract_id": "1",
                "un": "MEDICINA ESTETICA",
                "sale_month": "01/2025",
                "sale_year": "2025",
                "culm_month": "03/2025",
                "contract_date": "2025-01-10",
                "monto_cuota": 100.0,
            },
            {
                "contract_id": "2",
                "un": "MEDICINA ESTETICA",
                "sale_month": "01/2025",
                "sale_year": "2025",
                "culm_month": "04/2025",
                "contract_date": "2025-01-20",
                "monto_cuota": 200.0,
            },
        ]
        self.payment_by_contract_month = {
            "1": {s("01/2025"): {"amount": 100.0, "tx": 3}, s("02/2025"): {"amount": 100.0, "tx": 1}},
            "2": {s("01/2025"): {"amount": 200.0, "tx": 1}, s("03/2025"): {"amount": 200.0, "tx": 1}},
        }
        self.cob_by_contract_month = {
            "1": {"01/2025": 100.0, "02/2025": 100.0},
            "2": {"01/2025": 200.0, "03/2025": 200.0},
        }

    def test_core_tkp_and_ltv_rules(self):
        rows = AnalyticsService._compute_anuales_rows_v1(
            contract_rows=self.contract_rows,
            cartera_rows=self.cartera_rows,
            payment_by_contract_month=self.payment_by_contract_month,
            cob_by_contract_month=self.cob_by_contract_month,
            cutoff_month="04/2025",
            sel_un={"MEDICINA ESTETICA"},
            sel_anio=set(),
            sel_contract_month=set(),
        )
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row.get("year"), "2025")
        self.assertAlmostEqual(float(row.get("tkpPago", 0.0)), 150.0, places=6)
        self.assertEqual(int(row.get("culminados", 0)), 2)
        self.assertEqual(int(row.get("culminadosVigentes", 0)), 1)
        self.assertAlmostEqual(float(row.get("tkpPagoCulminadoVigente", 0.0)), 100.0, places=6)
        self.assertAlmostEqual(float(row.get("ltvCulminadoVigente", 0.0)), 1.0, places=6)

    def test_filter_by_contract_month_and_year(self):
        rows = AnalyticsService._compute_anuales_rows_v1(
            contract_rows=self.contract_rows,
            cartera_rows=self.cartera_rows,
            payment_by_contract_month=self.payment_by_contract_month,
            cob_by_contract_month=self.cob_by_contract_month,
            cutoff_month="04/2025",
            sel_un={"MEDICINA ESTETICA"},
            sel_anio={"2025"},
            sel_contract_month={"01/2025"},
        )
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(int(row.get("contracts", 0)), 2)
        self.assertAlmostEqual(float(row.get("tkpPago", 0.0)), 150.0, places=6)

    def test_tkp_transaccional_counts_zero_amount_transactions(self):
        payment_with_zero_tx = {
            "1": {s("01/2025"): {"amount": 100.0, "tx": 2}},  # una tx de 100 + una tx de 0
        }
        rows = AnalyticsService._compute_anuales_rows_v1(
            contract_rows=[
                {
                    "contract_id": "1",
                    "un": "MEDICINA ESTETICA",
                    "sale_month": "01/2025",
                    "sale_year": "2025",
                    "culm_month": "",
                    "contract_date": "2025-01-10",
                    "monto_cuota": 100.0,
                }
            ],
            cartera_rows=[
                {"contract_id": "1", "gestion_month": "01/2025", "tramo": 2, "monto_cuota": 100.0, "cuota_has_value": True},
            ],
            payment_by_contract_month=payment_with_zero_tx,
            cob_by_contract_month={"1": {"01/2025": 100.0}},
            cutoff_month="01/2025",
            sel_un={"MEDICINA ESTETICA"},
            sel_anio={"2025"},
            sel_contract_month={"01/2025"},
        )
        self.assertEqual(len(rows), 1)
        # legacy: tkpTransaccional = total pagado / total tx = 100 / 2 = 50
        self.assertAlmostEqual(float(rows[0].get("tkpTransaccional", 0.0)), 50.0, places=6)

    def test_culminados_vigentes_only_if_culmination_year_matches_row_year(self):
        rows = AnalyticsService._compute_anuales_rows_v1(
            contract_rows=[
                {
                    "contract_id": "10",
                    "un": "MEDICINA ESTETICA",
                    "sale_month": "01/2025",
                    "sale_year": "2025",
                    "culm_month": "01/2026",  # culmina otro año
                    "contract_date": "2025-01-10",
                    "monto_cuota": 100.0,
                }
            ],
            cartera_rows=[
                {"contract_id": "10", "gestion_month": "01/2025", "tramo": 2, "monto_cuota": 100.0, "cuota_has_value": True},
                {"contract_id": "10", "gestion_month": "01/2026", "tramo": 2, "monto_cuota": 100.0, "cuota_has_value": True},
            ],
            payment_by_contract_month={"10": {s("01/2025"): {"amount": 50.0, "tx": 1}}},
            cob_by_contract_month={"10": {"01/2025": 50.0}},
            cutoff_month="02/2026",
            sel_un={"MEDICINA ESTETICA"},
            sel_anio={"2025"},
            sel_contract_month={"01/2025"},
        )
        self.assertEqual(len(rows), 1)
        row = rows[0]
        # fila 2025 no debe contar culminado de 2026
        self.assertEqual(int(row.get("culminados", 0)), 0)
        self.assertEqual(int(row.get("culminadosVigentes", 0)), 0)


if __name__ == "__main__":
    unittest.main()
