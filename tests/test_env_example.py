import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class EnvExampleTests(unittest.TestCase):
    def test_env_example_exists_and_has_mysql_keys(self):
        env = (ROOT / '.env.example').read_text(encoding='utf-8')
        for key in ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']:
            self.assertIn(key + '=', env)


if __name__ == '__main__':
    unittest.main()
