import unittest

import start_dashboard as app


class AnualesBusinessRulesTests(unittest.TestCase):
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
        ]
        app.DATA_CACHE["rows"]["cobranzas"] = [
            {"_cId": "1", "_feNorm": "01/2025", "monto": "30"},
            {"_cId": "1", "_feNorm": "01/2025", "monto": "30"},
            {"_cId": "1", "_feNorm": "01/2025", "monto": "40"},
            {"_cId": "1", "_feNorm": "02/2025", "monto": "100"},
            {"_cId": "2", "_feNorm": "01/2025", "monto": "200"},
            {"_cId": "2", "_feNorm": "03/2025", "monto": "200"},
        ]
        app.DATA_CACHE["rows"]["contratos"] = [
            {
                "_cId": "1",
                "UN": "MEDICINA ESTETICA",
                "date": "2025-01-10",
                "_contractMonth": "01/2025",
                "_contractYear": "2025",
                "_culminacionMonth": "03/2025",
                "monto_cuota": "100",
            },
            {
                "_cId": "2",
                "UN": "MEDICINA ESTETICA",
                "date": "2025-01-20",
                "_contractMonth": "01/2025",
                "_contractYear": "2025",
                "_culminacionMonth": "04/2025",
                "monto_cuota": "200",
            },
        ]
        app.DATA_CACHE["aggr"]["cob_by_contract_month"] = {
            "1": {"01/2025": 100.0, "02/2025": 100.0},
            "2": {"01/2025": 200.0, "03/2025": 200.0},
        }

    def tearDown(self):
        app.refresh_data_cache = self._refresh_data_cache

    def _row_2025(self):
        payload = app.compute_anuales_summary({"un": ["MEDICINA ESTETICA"]})
        rows = payload.get("rows", [])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].get("year"), "2025")
        return rows[0]

    def test_tkp_pago_is_average_paid_per_contract_month(self):
        row = self._row_2025()
        # (100 + 100 + 200 + 200) / 4 contract-month buckets with payment
        self.assertAlmostEqual(row.get("tkpPago", 0.0), 150.0, places=6)

    def test_culminados_vigentes_and_ltv_for_culminado_vigente(self):
        row = self._row_2025()
        self.assertEqual(row.get("culminados"), 2)
        self.assertEqual(row.get("culminadosVigentes"), 1)
        self.assertAlmostEqual(row.get("tkpPagoCulminadoVigente", 0.0), 100.0, places=6)
        # Contract 1: cobrado=200, deberia=200, months=2 => LTV = 1 * 2 = 2
        self.assertAlmostEqual(row.get("ltvCulminadoVigente", 0.0), 2.0, places=6)


if __name__ == "__main__":
    unittest.main()
