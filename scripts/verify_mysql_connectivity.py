#!/usr/bin/env python3
"""
Verifica que el servidor pueda conectarse a MySQL e importar datos.
Ejecutar desde la raíz del proyecto: python scripts/verify_mysql_connectivity.py

Útil para validar antes de sync/import en cualquier servidor (virgen o no).
Exit 0 = OK, exit 1 = fallo.
"""
from __future__ import annotations

import os
import sys
import json

# Cargar .env desde raíz del proyecto
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
os.chdir(_PROJECT_ROOT)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv opcional


def _check_mysql_connector() -> str | None:
    """Verifica que mysql-connector-python esté instalado."""
    try:
        import mysql.connector  # noqa: F401
        return None
    except ImportError:
        return (
            "mysql-connector-python no instalado. Ejecute: pip install -r requirements/runtime.txt"
        )


def _get_mysql_config() -> dict:
    """Obtiene config MySQL desde variables de entorno."""
    return {
        'host': os.getenv('MYSQL_HOST', 'localhost').strip(),
        'port': int(os.getenv('MYSQL_PORT', '3306')),
        'user': os.getenv('MYSQL_USER', 'root').strip(),
        'password': os.getenv('MYSQL_PASSWORD', ''),
        'database': os.getenv('MYSQL_DATABASE', '').strip(),
        'ssl_disabled': os.getenv('MYSQL_SSL_DISABLED', 'true').lower() in ('1', 'true', 'yes'),
        'connection_timeout': 10,
    }


def verify_mysql_connectivity(json_output: bool = False) -> int:
    """
    Verifica conexión a MySQL. Retorna 0 si OK, 1 si falla.
    """
    result = {
        'ok': False,
        'mysql_ok': False,
        'message': '',
        'latency_ms': None,
        'config_check': None,
        'error': None,
    }

    # 1. Verificar dependencia
    err = _check_mysql_connector()
    if err:
        result['message'] = err
        result['error'] = 'MYSQL_CONNECTOR_MISSING'
        if json_output:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print(f"[ERROR] {err}")
        return 1

    # 2. Verificar variables mínimas
    cfg = _get_mysql_config()
    if not cfg['host'] or not cfg['user'] or not cfg['database']:
        result['message'] = (
            'MYSQL_HOST, MYSQL_USER y MYSQL_DATABASE son obligatorios en .env. '
            'Copie .env.example a .env y configure las variables.'
        )
        result['error'] = 'MYSQL_CONFIG_INCOMPLETE'
        result['config_check'] = {
            'host_set': bool(cfg['host']),
            'user_set': bool(cfg['user']),
            'database_set': bool(cfg['database']),
        }
        if json_output:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print(f"[ERROR] {result['message']}")
            print("  Variables actuales: host={!r}, user={!r}, database={!r}".format(
                cfg['host'] or '(vacío)', cfg['user'] or '(vacío)', cfg['database'] or '(vacío)'
            ))
        return 1

    # 3. Intentar conexión
    import time
    import mysql.connector

    try:
        started = time.perf_counter()
        conn = mysql.connector.connect(**cfg)
        try:
            cursor = conn.cursor()
            cursor.execute('SELECT 1')
            cursor.fetchone()
            cursor.close()
        finally:
            conn.close()
        latency_ms = int((time.perf_counter() - started) * 1000)

        result['ok'] = True
        result['mysql_ok'] = True
        result['message'] = 'Conexion MySQL OK. Listo para importar.'
        result['latency_ms'] = latency_ms

        if json_output:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print(f"[OK] {result['message']} (latencia: {latency_ms} ms)")
        return 0

    except Exception as e:
        result['message'] = str(e)
        result['error'] = 'MYSQL_CONNECTION_FAILED'
        if json_output:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print(f"[ERROR] No se pudo conectar a MySQL: {e}")
            print(f"  Host: {cfg['host']}:{cfg['port']}, DB: {cfg['database']}")
            print("  Sugerencia: Si MySQL está en el host y la app en Docker, use MYSQL_HOST=host.docker.internal")
        return 1


if __name__ == '__main__':
    json_out = '--json' in sys.argv or '-j' in sys.argv
    sys.exit(verify_mysql_connectivity(json_output=json_out))
