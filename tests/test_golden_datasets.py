import json
import unittest
from pathlib import Path

import start_dashboard as app

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures" / "golden"


def load_fixture(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class GoldenDatasetTests(unittest.TestCase):
    def setUp(self):
        self._ensure_analytics_index = app.ensure_analytics_index
        self._refresh_data_cache = app.refresh_data_cache
        app.ensure_analytics_index = lambda: None
        app.refresh_data_cache = lambda force=False: None
        app.ANALYTICS_CACHE.clear()

    def tearDown(self):
        app.ensure_analytics_index = self._ensure_analytics_index
        app.refresh_data_cache = self._refresh_data_cache

    def test_anuales_golden_case(self):
        fx = load_fixture("anuales_case_2025.json")
        app.DATA_CACHE["rows"]["cartera"] = fx["rows"]["cartera"]
        app.DATA_CACHE["rows"]["cobranzas"] = fx["rows"]["cobranzas"]
        app.DATA_CACHE["rows"]["contratos"] = fx["rows"]["contratos"]
        app.DATA_CACHE["aggr"]["cob_by_contract_month"] = fx["rows"]["aggr"]["cob_by_contract_month"]

        payload = app.compute_anuales_summary(fx["params"])
        exp = fx["expected"]
        self.assertEqual(payload.get("cutoff"), exp["cutoff"])
        rows = payload.get("rows", [])
        self.assertEqual(len(rows), exp["rows_count"])
        row = rows[0]
        self.assertEqual(row.get("year"), exp["year"])
        self.assertEqual(row.get("contracts"), exp["contracts"])
        self.assertEqual(row.get("contractsVigentes"), exp["contractsVigentes"])
        self.assertEqual(row.get("culminados"), exp["culminados"])
        self.assertEqual(row.get("culminadosVigentes"), exp["culminadosVigentes"])
        self.assertAlmostEqual(row.get("tkpContrato", 0.0), exp["tkpContrato"], places=6)
        self.assertAlmostEqual(row.get("tkpPago", 0.0), exp["tkpPago"], places=6)
        self.assertAlmostEqual(row.get("tkpPagoCulminadoVigente", 0.0), exp["tkpPagoCulminadoVigente"], places=6)
        self.assertAlmostEqual(row.get("ltvCulminadoVigente", 0.0), exp["ltvCulminadoVigente"], places=6)

    def test_movement_golden_case(self):
        fx = load_fixture("movement_case_2025.json")
        app.ANALYTICS_INDEX["cartera_entries"] = fx["analytics_index"]["cartera_entries"]
        app.DATA_CACHE["rows"]["cartera"] = fx["rows"]["cartera"]

        payload = app.compute_movement_moroso_trend(fx["params"])
        exp = fx["expected"]
        self.assertEqual(payload.get("labels"), exp["labels"])
        self.assertEqual(payload.get("moroso_transition_count"), exp["moroso_transition_count"])
        self.assertEqual(payload.get("vigente_base_count"), exp["vigente_base_count"])
        self.assertEqual(payload.get("avg_cuota"), exp["avg_cuota"])
        got_pct = payload.get("moroso_transition_pct")
        self.assertEqual(len(got_pct), len(exp["moroso_transition_pct"]))
        for i in range(len(got_pct)):
            self.assertAlmostEqual(got_pct[i], exp["moroso_transition_pct"][i], places=6)


if __name__ == "__main__":
    unittest.main()
