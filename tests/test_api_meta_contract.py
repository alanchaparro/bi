import unittest

import start_dashboard as app


class ApiMetaContractTests(unittest.TestCase):
    def test_infer_cutoff_month_orders_months(self):
        cutoff = app.infer_cutoff_month(["03/2025", "12/2024", "01/2026", "foo"])
        self.assertEqual(cutoff, "01/2026")

    def test_build_response_meta_has_standard_keys(self):
        params = {
            "un": ["MEDICINA ESTETICA"],
            "anio": ["2025"],
            "gestion_month": ["02/2025", "01/2025"],
            "debug": ["1"],
        }
        meta = app.build_response_meta("/analytics/portfolio/summary", params, "02/2025")
        self.assertEqual(meta.get("source"), "api")
        self.assertEqual(meta.get("cutoff"), "02/2025")
        self.assertTrue(str(meta.get("signature", "")).startswith("/analytics/portfolio/summary|"))
        filters = meta.get("filters", {})
        self.assertEqual(filters.get("un"), ["MEDICINA ESTETICA"])
        self.assertEqual(filters.get("anio"), ["2025"])
        self.assertEqual(filters.get("gestion_month"), ["01/2025", "02/2025"])

    def test_filter_count_snapshot_counts_repeatable_filters(self):
        params = {
            "un": ["A,B"],
            "anio": ["2025"],
            "gestion_month": ["01/2025", "02/2025"],
        }
        counts = app.filter_count_snapshot(params)
        self.assertEqual(counts.get("un"), 2)
        self.assertEqual(counts.get("anio"), 1)
        self.assertEqual(counts.get("gestion_month"), 2)


if __name__ == "__main__":
    unittest.main()
