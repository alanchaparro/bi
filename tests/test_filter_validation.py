import unittest

import start_dashboard as app


class FilterValidationTests(unittest.TestCase):
    def test_validate_month_set(self):
        self.assertTrue(app.validate_month_set(set()))
        self.assertTrue(app.validate_month_set({"01/2025", "12/2030"}))
        self.assertFalse(app.validate_month_set({"1/2025"}))
        self.assertFalse(app.validate_month_set({"2025/01"}))
        self.assertFalse(app.validate_month_set({"AA/2025"}))

    def test_validate_year_set(self):
        self.assertTrue(app.validate_year_set(set()))
        self.assertTrue(app.validate_year_set({"2023", "2024", "2025"}))
        self.assertFalse(app.validate_year_set({"23"}))
        self.assertFalse(app.validate_year_set({"2025-01"}))
        self.assertFalse(app.validate_year_set({"ABCD"}))


if __name__ == "__main__":
    unittest.main()
