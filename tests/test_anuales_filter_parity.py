import unittest
from collections import defaultdict

import start_dashboard as app


class AnualesFilterParityTests(unittest.TestCase):
    def setUp(self):
        self._refresh_data_cache = app.refresh_data_cache
        app.refresh_data_cache = lambda force=False: None
        app.ANALYTICS_CACHE.clear()

        app.DATA_CACHE["rows"]["cartera"] = [
            {"_cId": "1", "_feNorm": "01/2025", "tramo": "2", "monto_cuota": "100"},
            {"_cId": "1", "_feNorm": "02/2025", "tramo": "2", "monto_cuota": "100"},
            {"_cId": "1", "_feNorm": "03/2025", "tramo": "2", "monto_cuota": "100"},
            {"_cId": "1", "_feNorm": "04/2025", "tramo": "5", "monto_cuota": "100"},
            {"_cId": "2", "_feNorm": "01/2025", "tramo": "2", "monto_cuota": "200"},
            {"_cId": "2", "_feNorm": "02/2025", "tramo": "2", "monto_cuota": "200"},
            {"_cId": "2", "_feNorm": "03/2025", "tramo": "2", "monto_cuota": "200"},
            {"_cId": "2", "_feNorm": "04/2025", "tramo": "4", "monto_cuota": "200"},
            {"_cId": "3", "_feNorm": "02/2025", "tramo": "2", "monto_cuota": "500"},
            {"_cId": "3", "_feNorm": "03/2025", "tramo": "2", "monto_cuota": "500"},
            {"_cId": "3", "_feNorm": "04/2025", "tramo": "2", "monto_cuota": "500"},
        ]
        app.DATA_CACHE["rows"]["cobranzas"] = [
            {"_cId": "1", "_feNorm": "01/2025", "monto": "100"},
            {"_cId": "1", "_feNorm": "02/2025", "monto": "100"},
            {"_cId": "2", "_feNorm": "01/2025", "monto": "200"},
            {"_cId": "2", "_feNorm": "03/2025", "monto": "200"},
            {"_cId": "3", "_feNorm": "02/2025", "monto": "500"},
        ]
        app.DATA_CACHE["rows"]["contratos"] = [
            {
                "_cId": "1",
                "UN": "MEDICINA ESTETICA",
                "_contractMonth": "01/2025",
                "_contractYear": "2025",
                "_culminacionMonth": "03/2025",
                "date": "2025-01-10",
                "monto_cuota": "100",
            },
            {
                "_cId": "2",
                "UN": "MEDICINA ESTETICA",
                "_contractMonth": "01/2025",
                "_contractYear": "2025",
                "_culminacionMonth": "04/2025",
                "date": "2025-01-20",
                "monto_cuota": "200",
            },
            {
                "_cId": "3",
                "UN": "MEDICINA ESTETICA",
                "_contractMonth": "02/2025",
                "_contractYear": "2025",
                "_culminacionMonth": "04/2025",
                "date": "2025-02-05",
                "monto_cuota": "500",
            },
        ]
        app.DATA_CACHE["aggr"]["cob_by_contract_month"] = {
            "1": {"01/2025": 100.0, "02/2025": 100.0},
            "2": {"01/2025": 200.0, "03/2025": 200.0},
            "3": {"02/2025": 500.0},
        }

    def tearDown(self):
        app.refresh_data_cache = self._refresh_data_cache

    def test_combined_filters_match_reference_tkp_pago(self):
        params = {
            "un": ["MEDICINA ESTETICA"],
            "anio": ["2025"],
            "contract_month": ["01/2025"],
        }
        payload = app.compute_anuales_summary(params)
        rows = payload.get("rows", [])
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row.get("year"), "2025")
        self.assertEqual(row.get("contracts"), 2)

        selected_contracts = {"1", "2"}
        month_amount = defaultdict(float)
        for r in app.DATA_CACHE["rows"]["cobranzas"]:
            c_id = str(r.get("_cId", ""))
            mm = str(r.get("_feNorm", ""))
            if c_id in selected_contracts and mm.endswith("/2025"):
                month_amount[(c_id, mm)] += app.to_float(r.get("monto"), 0.0)
        expected_tkp_pago = sum(month_amount.values()) / len(month_amount)

        self.assertAlmostEqual(row.get("tkpPago", 0.0), expected_tkp_pago, places=6)
        self.assertAlmostEqual(row.get("tkpPago", 0.0), 150.0, places=6)


if __name__ == "__main__":
    unittest.main()
