import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class MovementEndpointStaticTests(unittest.TestCase):
    def test_backend_has_movement_endpoint(self):
        content = (ROOT / 'start_dashboard.py').read_text(encoding='utf-8')
        self.assertIn('/analytics/movement/moroso-trend', content)
        self.assertIn('compute_movement_moroso_trend', content)
        self.assertIn('/analytics/anuales/summary', content)
        self.assertIn('compute_anuales_summary', content)
        self.assertIn('anio debe ser YYYY', content)
        self.assertIn('/analytics/ops/metrics', content)
        self.assertIn('/analytics/ops/reset', content)

    def test_api_client_has_movement_method(self):
        content = (ROOT / 'data' / 'api-client.js').read_text(encoding='utf-8')
        self.assertIn('getMovementMorosoTrend', content)
        self.assertIn('getAnualesSummary', content)


if __name__ == '__main__':
    unittest.main()
