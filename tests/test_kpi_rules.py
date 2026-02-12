import unittest


def compliance_pct(denominator, numerator):
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


class KPIComputationTests(unittest.TestCase):
    def test_compliance_amounts(self):
        self.assertEqual(compliance_pct(100, 50), 50.0)
        self.assertEqual(compliance_pct(0, 10), 0.0)

    def test_compliance_contracts(self):
        self.assertEqual(compliance_pct(250, 175), 70.0)


if __name__ == '__main__':
    unittest.main()
