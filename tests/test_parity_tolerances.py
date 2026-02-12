import unittest

import start_dashboard as app


def pct_diff(expected, actual):
    if expected == 0:
        return 0.0 if actual == 0 else 100.0
    return abs((actual - expected) / expected) * 100.0


class ParityToleranceTests(unittest.TestCase):
    CONTRACT_TOLERANCE = 1
    PCT_TOLERANCE = 0.5

    def setUp(self):
        self._ensure_analytics_index = app.ensure_analytics_index
        self._refresh_data_cache = app.refresh_data_cache
        app.ensure_analytics_index = lambda: None
        app.refresh_data_cache = lambda force=False: None
        app.ANALYTICS_CACHE.clear()

    def tearDown(self):
        app.ensure_analytics_index = self._ensure_analytics_index
        app.refresh_data_cache = self._refresh_data_cache

    def _assert_contract_tolerance(self, expected, actual):
        self.assertLessEqual(abs(int(actual) - int(expected)), self.CONTRACT_TOLERANCE)

    def _assert_pct_tolerance(self, expected, actual):
        self.assertLessEqual(pct_diff(float(expected), float(actual)), self.PCT_TOLERANCE)

    def test_movement_parity_tolerance_contracts_and_percent(self):
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

        payload = app.compute_movement_moroso_trend({"un": ["MEDICINA ESTETICA"], "anio": ["2025"]})
        expected_transitions = [0, 1, 1]
        expected_vigente_base = [3, 2, 1]
        expected_pct = [0.0, 50.0, 100.0]

        for i in range(3):
            self._assert_contract_tolerance(expected_transitions[i], payload["moroso_transition_count"][i])
            self._assert_contract_tolerance(expected_vigente_base[i], payload["vigente_base_count"][i])
            self._assert_pct_tolerance(expected_pct[i], payload["moroso_transition_pct"][i])

    def test_anuales_parity_tolerance_contracts_and_kpis(self):
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
            {"_cId": "1", "_feNorm": "01/2025", "monto": "100"},
            {"_cId": "1", "_feNorm": "02/2025", "monto": "100"},
            {"_cId": "2", "_feNorm": "01/2025", "monto": "200"},
            {"_cId": "2", "_feNorm": "03/2025", "monto": "200"},
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
        ]
        app.DATA_CACHE["aggr"]["cob_by_contract_month"] = {
            "1": {"01/2025": 100.0, "02/2025": 100.0},
            "2": {"01/2025": 200.0, "03/2025": 200.0},
        }

        payload = app.compute_anuales_summary({"un": ["MEDICINA ESTETICA"], "anio": ["2025"]})
        rows = payload.get("rows", [])
        self.assertEqual(len(rows), 1)
        row = rows[0]

        self._assert_contract_tolerance(2, row.get("contracts", 0))
        self._assert_contract_tolerance(2, row.get("culminados", 0))
        self._assert_contract_tolerance(1, row.get("culminadosVigentes", 0))
        self._assert_pct_tolerance(150.0, row.get("tkpPago", 0.0))
        self._assert_pct_tolerance(100.0, row.get("tkpPagoCulminadoVigente", 0.0))


if __name__ == "__main__":
    unittest.main()
