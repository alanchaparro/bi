import unittest

from start_dashboard import month_from_date


class NormalizeRulesTests(unittest.TestCase):
    def test_month_from_date_supports_multiple_formats(self):
        self.assertEqual(month_from_date('01/2026'), '01/2026')
        self.assertEqual(month_from_date('2026-02-28'), '02/2026')
        self.assertEqual(month_from_date('28/02/2026'), '02/2026')
        self.assertEqual(month_from_date('2026/02/28'), '02/2026')

    def test_month_from_date_invalid(self):
        self.assertEqual(month_from_date(''), '')
        self.assertEqual(month_from_date('not-a-date'), '')


if __name__ == '__main__':
    unittest.main()
