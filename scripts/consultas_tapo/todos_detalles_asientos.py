#!/usr/bin/env python3
"""
Script para obtener TODOS los detalles de asientos contables de facturacion TAPO.
Enero 2025 - Odontologia - Tratamiento Odontologico

Estructura del asiento:
1. Debito - CAJA (dinero que entra)
2. Credito - IVA DEBITO FISCAL (IVA 10%)
3. Credito - INGRESOS POR TRATAMIENTO (ingresos sin IVA)
"""

import os
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

try:
    import pymysql
except ImportError:
    print("Error: pymysql no esta instalado. Instalar con: pip install pymysql")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("Error: python-dotenv no esta instalado. Instalar con: pip install python-dotenv")
    sys.exit(1)


def get_mysql_connection():
    """Obtiene conexion a MySQL desde variables de entorno."""
    env_path = Path(__file__).parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)

    host = os.getenv("MYSQL_HOST", "localhost")
    port = int(os.getenv("MYSQL_PORT", "3306"))
    user = os.getenv("MYSQL_USER", "root")
    password = os.getenv("MYSQL_PASSWORD", "")
    database = os.getenv("MYSQL_DATABASE", "epem")

    print(f"\nConectando a MySQL:")
    print(f"  Host: {host}:{port}")
    print(f"  Database: {database}")

    connection = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database
