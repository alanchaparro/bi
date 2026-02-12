import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class UiRegressionMinimalTests(unittest.TestCase):
    def test_html_has_key_cards_and_canvas_ids(self):
        html = (ROOT / "dashboard.html").read_text(encoding="utf-8")
        required_ids = [
            "aca-total",
            "aca-vigente",
            "aca-moroso",
            "aca-cobrador",
            "aca-debito",
            "acaMoneyChart",
            "acaContractsChart",
            "acaMovementMorosoChart",
            "acaMovementCulVigChart",
            "acaa-table-body",
            "perf-recovery-rate",
            "perf-total-contracts",
            "perf-total-debt",
            "perf-total-contracts-paid",
            "perf-total-paid",
            "perfTrendChart",
            "perfTrendCountChart",
            "perfTramoChart",
            "perfUnChart",
            "perfViaCobroChart",
        ]
        for element_id in required_ids:
            self.assertIn(f'id="{element_id}"', html)

    def test_modules_keep_main_render_entrypoints(self):
        aca_mov = (ROOT / "tabs" / "acaMovimiento.js").read_text(encoding="utf-8")
        aca_an = (ROOT / "tabs" / "acaAnuales.js").read_text(encoding="utf-8")
        ana_car = (ROOT / "tabs" / "analisisCartera.js").read_text(encoding="utf-8")
        rend = (ROOT / "tabs" / "rendimiento.js").read_text(encoding="utf-8")
        self.assertIn("renderMovementUI", aca_mov)
        self.assertIn("renderAnualesUI", aca_an)
        self.assertIn("prepareViewModel", ana_car)
        self.assertIn("renderPerformanceUI", rend)


if __name__ == "__main__":
    unittest.main()
