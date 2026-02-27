#!/usr/bin/env python3
"""
Diagnóstico de conectividad para sync/import.
Comprueba: API reachable, MySQL, y variables de entorno.

Uso:
  python scripts/diagnose_sync_connectivity.py
  python scripts/diagnose_sync_connectivity.py --api-url http://localhost:8000/api/v1
"""
from __future__ import annotations

import argparse
import json
import os
import sys

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
os.chdir(_PROJECT_ROOT)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def check_api(base_url: str) -> dict:
    """Verifica que la API responda en /health."""
    result = {'ok': False, 'url': f'{base_url.rstrip("/")}/health', 'error': None, 'db_ok': None, 'mysql_ok': None}
    try:
        import urllib.request
        req = urllib.request.Request(result['url'], method='GET')
        req.add_header('Accept', 'application/json')
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            result['ok'] = data.get('ok') is True
            result['db_ok'] = data.get('db_ok')
            result['mysql_ok'] = data.get('mysql_ok')
    except Exception as e:
        result['error'] = str(e)
    return result


def check_mysql() -> dict:
    """Ejecuta verify_mysql_connectivity.py y captura resultado."""
    import subprocess
    script = os.path.join(_PROJECT_ROOT, 'scripts', 'verify_mysql_connectivity.py')
    try:
        r = subprocess.run(
            [sys.executable, script],
            capture_output=True,
            text=True,
            timeout=15,
            cwd=_PROJECT_ROOT,
        )
        output = (r.stdout or '') + (r.stderr or '')
        return {'ok': r.returncode == 0, 'output': output.strip()}
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': 'Timeout (15s)'}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def main() -> int:
    parser = argparse.ArgumentParser(description='Diagnóstico de conectividad para sync')
    parser.add_argument('--api-url', default=os.getenv('VITE_API_BASE_URL', 'http://localhost:8000/api/v1'),
                        help='URL base de la API')
    parser.add_argument('--json', action='store_true', help='Salida JSON')
    args = parser.parse_args()

    api_result = check_api(args.api_url)
    mysql_result = check_mysql()

    if args.json:
        out = {
            'api': api_result,
            'mysql': mysql_result,
            'env_check': {
                'MYSQL_HOST': bool(os.getenv('MYSQL_HOST')),
                'MYSQL_USER': bool(os.getenv('MYSQL_USER')),
                'MYSQL_DATABASE': bool(os.getenv('MYSQL_DATABASE')),
                'VITE_API_BASE_URL': os.getenv('VITE_API_BASE_URL'),
            },
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
    else:
        print('=== Diagnóstico de conectividad sync/import ===\n')
        print('1. API:')
        if api_result['ok']:
            print(f'   OK - {api_result["url"]}')
            print(f'   db_ok={api_result.get("db_ok")}, mysql_ok={api_result.get("mysql_ok")}')
        else:
            print(f'   FALLO - {api_result["url"]}')
            print(f'   Error: {api_result.get("error", "?")}')
            print('   Sugerencia: Verifique que la API esté corriendo y que VITE_API_BASE_URL sea correcto.')

        print('\n2. MySQL:')
        if mysql_result['ok']:
            print('   OK - Conexión verificada')
        else:
            print('   FALLO')
            if mysql_result.get('output'):
                print(f'   {mysql_result["output"]}')
            if mysql_result.get('error'):
                print(f'   Error: {mysql_result["error"]}')
            print('   Sugerencia: Si usa Docker, pruebe MYSQL_HOST=host.docker.internal en .env')

        print('\n3. Variables .env:')
        for k in ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE']:
            v = os.getenv(k, '')
            status = 'OK' if v else 'FALTA'
            print(f'   {k}={v or "(vacío)"} [{status}]')

    all_ok = api_result['ok'] and mysql_result['ok']
    return 0 if all_ok else 1


if __name__ == '__main__':
    sys.exit(main())
