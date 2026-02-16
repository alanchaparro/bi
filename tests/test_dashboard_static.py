import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DashboardStaticTests(unittest.TestCase):
    def test_show_tabs_nav_has_no_recursion(self):
        content = (ROOT / 'dashboard.js').read_text(encoding='utf-8')
        m = re.search(r"const showTabsNav = \(\) => \{([\s\S]*?)\n\s*\};", content)
        self.assertIsNotNone(m, 'showTabsNav helper not found')
        body = m.group(1)
        self.assertNotIn('showTabsNav();', body, 'showTabsNav contains recursive call')
        self.assertIn("tabsNav.classList.remove('hidden')", body)

    def test_html_loads_support_modules(self):
        html = (ROOT / 'dashboard.html').read_text(encoding='utf-8')
        self.assertIn('ui/notifications.js', html)
        self.assertIn('data/normalize.js', html)
        self.assertIn('data/feature-flags.js', html)
        self.assertIn('tabs/acaMovimiento-api.js', html)
        self.assertIn('tabs/acaAnuales-api.js', html)
        self.assertIn('tabs/acaMovimiento.js', html)
        self.assertIn('tabs/acaAnuales.js', html)
        self.assertIn('charts/renderers.js', html)
        self.assertIn('id="analytics-fallback-summary"', html)
        self.assertIn('id="analytics-backend-summary"', html)
        self.assertIn('id="refresh-ops-metrics"', html)
        self.assertIn('id="reset-api-outcomes"', html)

    def test_aca_anuales_module_exports_render_helpers(self):
        content = (ROOT / 'tabs' / 'acaAnuales.js').read_text(encoding='utf-8')
        self.assertIn('renderSelectionSummary', content)
        self.assertIn('renderAnualesUI', content)
        self.assertIn('normalizeRows', content)

    def test_analisis_cartera_module_exports_helpers(self):
        content = (ROOT / 'tabs' / 'analisisCartera.js').read_text(encoding='utf-8')
        self.assertIn('buildSelectionSummary', content)
        self.assertIn('renderSelectionSummary', content)
        self.assertIn('prepareViewModel', content)
        self.assertIn('getHeaderValues', content)

    def test_rendimiento_module_exports_helpers(self):
        content = (ROOT / 'tabs' / 'rendimiento.js').read_text(encoding='utf-8')
        self.assertIn('prepareViewModel', content)
        self.assertIn('getHeaderValues', content)
        self.assertIn('renderPerformanceUI', content)

    def test_docs_contracts_exist(self):
        expected = [
            'docs/data-contracts.md',
            'docs/ui-state-model.md',
            'docs/data-validation-rules.md',
            'docs/runbook-local.md',
            'docs/performance-notes.md',
            'docs/api-contracts-v1.md',
        ]
        for rel in expected:
            self.assertTrue((ROOT / rel).exists(), f'missing {rel}')

    def test_start_dashboard_has_v1proxy_brokers_routes(self):
        content = (ROOT / 'start_dashboard.py').read_text(encoding='utf-8')
        self.assertIn('/api/v1proxy/commissions', content)
        self.assertIn('/api/v1proxy/prizes', content)
        self.assertIn('/api/v1proxy/brokers-supervisors', content)
        self.assertIn('call_api_v1_brokers', content)
        self.assertIn('/api/brokers/summary', content)
        self.assertIn('compute_brokers_summary', content)


if __name__ == '__main__':
    unittest.main()
