import unittest

import start_dashboard as app


class MovementBusinessRulesTests(unittest.TestCase):
    def setUp(self):
        self._ensure_analytics_index = app.ensure_analytics_index
        self._refresh_data_cache = app.refresh_data_cache
        app.ensure_analytics_index = lambda: None
        app.refresh_data_cache = lambda force=False: None
        app.ANALYTICS_CACHE.clear()

        app.ANALYTICS_INDEX["cartera_entries"] = [
            {"c_id": "1", "fe": "01/2025", "un": "MEDICINA ESTETICA", "via_c": "COBRADOR", "sup": "SUP A", "tramo_num": 2},
            {"c_id": "1", "fe": "02/2025", "un": "MEDICINA ESTETICA", "via_c": "COBRADOR", "sup": "SUP A", "tramo_num": 2},
            {"c_id": "1", "fe": "03/2025", "un": "MEDICINA ESTETICA", "via_c": "COBRADOR", "sup": "SUP A", "tramo_num": 5},
            {"c_id": "2", "fe": "01/2025", "un": "MEDICINA ESTETICA", "via_c": "DEBITO", "sup": "SUP B", "tramo_num": 2},
            {"c_id": "2", "fe": "02/2025", "un": "MEDICINA ESTETICA", "via_c": "DEBITO", "sup": "SUP B", "tramo_num": 4},
            {"c_id": "2", "fe": "03/2025", "un": "MEDICINA ESTETICA", "via_c": "DEBITO", "sup": "SUP B", "tramo_num": 4},
            {"c_id": "3", "fe": "01/2025", "un": "MEDICINA ESTETICA", "via_c": "COBRADOR", "sup": "SUP A", "tramo_num": 2},
            {"c_id": "3", "fe": "02/2025", "un": "MEDICINA ESTETICA", "via_c": "COBRADOR", "sup": "SUP A", "tramo_num": 2},
            {"c_id": "3", "fe": "03/2025", "un": "MEDICINA ESTETICA", "via_c": "COBRADOR", "sup": "SUP A", "tramo_num": 2},
        ]
        app.DATA_CACHE["rows"]["cartera"] = [
            {"_cId": "1", "_feNorm": "01/2025", "monto_cuota": "100"},
            {"_cId": "1", "_feNorm": "02/2025", "monto_cuota": "100"},
            {"_cId": "1", "_feNorm": "03/2025", "monto_cuota": "100"},
            {"_cId": "2", "_feNorm": "01/2025", "monto_cuota": "200"},
            {"_cId": "2", "_feNorm": "02/2025", "monto_cuota": "200"},
            {"_cId": "2", "_feNorm": "03/2025", "monto_cuota": "200"},
            {"_cId": "3", "_feNorm": "01/2025", "monto_cuota": "150"},
            {"_cId": "3", "_feNorm": "02/2025", "monto_cuota": "150"},
            {"_cId": "3", "_feNorm": "03/2025", "monto_cuota": "150"},
        ]

    def tearDown(self):
        app.ensure_analytics_index = self._ensure_analytics_index
        app.refresh_data_cache = self._refresh_data_cache

    def test_movement_returns_complete_month_series_and_percent_formula(self):
        payload = app.compute_movement_moroso_trend({"un": ["MEDICINA ESTETICA"], "anio": ["2025"]})
        self.assertEqual(payload.get("labels"), ["01/2025", "02/2025", "03/2025"])
        self.assertEqual(payload.get("moroso_transition_count"), [0, 1, 1])
        self.assertEqual(payload.get("vigente_base_count"), [3, 2, 1])

        pct = payload.get("moroso_transition_pct")
        self.assertAlmostEqual(pct[0], 0.0, places=3)
        self.assertAlmostEqual(pct[1], 50.0, places=3)
        self.assertAlmostEqual(pct[2], 100.0, places=3)

    def test_movement_avg_cuota_is_only_for_contracts_that_transition(self):
        payload = app.compute_movement_moroso_trend({"un": ["MEDICINA ESTETICA"], "anio": ["2025"]})
        # 01/2025 has no transitions => 0; 02/2025 transitioned contract 2 => 200; 03/2025 contract 1 => 100.
        self.assertEqual(payload.get("avg_cuota"), [0.0, 200.0, 100.0])


if __name__ == "__main__":
    unittest.main()
