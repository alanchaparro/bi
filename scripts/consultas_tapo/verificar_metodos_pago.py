#!/usr/bin/env python3
"""
Script para verificar metodos de pago disponibles en la base de datos.
"""

import os
import sys
from pathlib import Path

# Agregar el directorio backend al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

try:
    import pymysql
except ImportError:
    print("Error: pymysql no esta instalado. Instalar con: pip install pymysql")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print(
        "Error: python-dotenv no esta instalado. Instalar con: pip install python-dotenv"
    )
    sys.exit(1)


def get_mysql_connection():
    """Obtiene conexion a MySQL desde variables de entorno."""
    # Cargar .env desde la raiz del proyecto
    env_path = Path(__file__).parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)

    # Variables de entorno para MySQL
    host = os.getenv("MYSQL_HOST", "localhost")
    port = int(os.getenv("MYSQL_PORT", "3306"))
    user = os.getenv("MYSQL_USER", "root")
    password = os.getenv("MYSQL_PASSWORD", "")
    database = os.getenv("MYSQL_DATABASE", "epem")

    print(f"\nConectando a MySQL:")
    print(f"  Host: {host}:{port}")
    print(f"  Database: {database}")
    print(f"  User: {user}")

    connection = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )

    return connection


def format_number(num):
    """Formatea un numero con separador de miles."""
    if num is None:
        return "0"
    return f"{int(num):,}".replace(",", ".")


def main():
    """Funcion principal."""
    print("=" * 80)
    print("VERIFICACION DE METODOS DE PAGO")
    print("=" * 80)

    try:
        connection = get_mysql_connection()
        cursor = connection.cursor()

        # Consulta 1: Todos los metodos de pago
        print("\n" + "-" * 80)
        print("TODOS LOS METODOS DE PAGO")
        print("-" * 80)

        query_all = """
        SELECT
            pm.id,
            pm.name,
            pm.financing,
            pm.type,
            pm.type_method,
            pm.status
        FROM payment_methods pm
        ORDER BY pm.id
        """

        cursor.execute(query_all)
        metodos = cursor.fetchall()

        if metodos:
            print(f"\nTotal de metodos de pago: {len(metodos)}")
            print("\nID\t| Nombre\t\t\t\t| Financing | Type | Status")
            print("-" * 80)
            for m in metodos:
                name = m["name"][:40] if m["name"] else ""
                print(
                    f"{m['id']}\t| {name:<40} | {m['financing']}\t    | {m['type']}\t  | {m['status']}"
                )
        else:
            print("No se encontraron metodos de pago")

        # Consulta 2: Metodos de pago con financiacion
        print("\n" + "-" * 80)
        print("METODOS DE PAGO CON FINANCIAMIENTO (financing = 1)")
        print("-" * 80)

        query_financing = """
        SELECT
            pm.id,
            pm.name,
            pm.financing,
            COUNT(DISTINCT vp.voucher_id) AS cantidad_vouchers,
            SUM(vp.amount) AS monto_total
        FROM payment_methods pm
        LEFT JOIN voucher_payments vp ON pm.id = vp.payment_method_id
        LEFT JOIN vouchers v ON vp.voucher_id = v.id
        WHERE pm.financing = 1
          AND YEAR(v.date) = 2025
          AND MONTH(v.date) = 1
          AND v.status = 1
        GROUP BY pm.id, pm.name, pm.financing
        """

        cursor.execute(query_financing)
        metodos_fin = cursor.fetchall()

        if metodos_fin:
            print(f"\nTotal: {len(metodos_fin)}")
            print("\nID\t| Nombre\t\t\t\t| Vouchers\t| Monto")
            print("-" * 80)
            for m in metodos_fin:
                name = m["name"][:40] if m["name"] else ""
                print(
                    f"{m['id']}\t| {name:<40} | {format_number(m['cantidad_vouchers'])}\t| {format_number(m['monto_total'])}"
                )
        else:
            print("No se encontraron metodos de pago con financiamiento en Enero 2025")

        # Consulta 3: Metodos de pago que contienen "PRESUPUESTO" o "FINANCIADO"
        print("\n" + "-" * 80)
        print("METODOS DE PAGO CON 'PRESUPUESTO' o 'FINANCIADO'")
        print("-" * 80)

        query_presupuesto = """
        SELECT
            pm.id,
            pm.name,
            pm.financing,
            COUNT(DISTINCT vp.voucher_id) AS cantidad_vouchers,
            SUM(vp.amount) AS monto_total
        FROM payment_methods pm
        LEFT JOIN voucher_payments vp ON pm.id = vp.payment_method_id
        LEFT JOIN vouchers v ON vp.voucher_id = v.id
        WHERE (pm.name LIKE '%PRESUPUESTO%' OR pm.name LIKE '%FINANCIADO%')
          AND YEAR(v.date) = 2025
          AND MONTH(v.date) = 1
          AND v.status = 1
        GROUP BY pm.id, pm.name, pm.financing
        """

        cursor.execute(query_presupuesto)
        metodos_pres = cursor.fetchall()

        if metodos_pres:
            print(f"\nTotal: {len(metos_pres)}")
            print("\nID\t| Nombre\t\t\t\t| Financing\t| Vouchers\t| Monto")
            print("-" * 80)
            for m in metodos_pres:
                name = m["name"][:40] if m["name"] else ""
                print(
                    f"{m['id']}\t| {name:<40} | {m['financing']}\t\t| {format_number(m['cantidad_vouchers'])}\t| {format_number(m['monto_total'])}"
                )
        else:
            print(
                "No se encontraron metodos con 'PRESUPUESTO' o 'FINANCIADO' en Enero 2025"
            )

        # Consulta 4: Top 10 metodos de pago mas usados en Enero 2025
        print("\n" + "-" * 80)
        print("TOP 10 METODOS DE PAGO MAS USADOS - ENERO 2025")
        print("-" * 80)

        query_top = """
        SELECT
            pm.id,
            pm.name,
            pm.financing,
            COUNT(DISTINCT vp.voucher_id) AS cantidad_vouchers,
            SUM(vp.amount) AS monto_total
        FROM payment_methods pm
        INNER JOIN voucher_payments vp ON pm.id = vp.payment_method_id
        INNER JOIN vouchers v ON vp.voucher_id = v.id
        WHERE YEAR(v.date) = 2025
          AND MONTH(v.date) = 1
          AND v.status = 1
        GROUP BY pm.id, pm.name, pm.financing
        ORDER BY monto_total DESC
        LIMIT 10
        """

        cursor.execute(query_top)
        metodos_top = cursor.fetchall()

        if metodos_top:
            print(f"\nTotal: {len(metodos_top)}")
            print("\nID\t| Nombre\t\t\t\t| Financing\t| Vouchers\t| Monto")
            print("-" * 80)
            for m in metodos_top:
                name = m["name"][:40] if m["name"] else ""
                print(
                    f"{m['id']}\t| {name:<40} | {m['financing']}\t\t| {format_number(m['cantidad_vouchers'])}\t| {format_number(m['monto_total'])}"
                )

        # Consulta 5: Metodos de pago para vouchers con service_invoice_id = 2
        print("\n" + "-" * 80)
        print("METODOS DE PAGO PARA TRATAMIENTO ODONTOLOGICO - ENERO 2025")
        print("-" * 80)

        query_odonto = """
        SELECT
            pm.id,
            pm.name,
            pm.financing,
            COUNT(DISTINCT v.id) AS cantidad_vouchers,
            SUM(v.amount) AS monto_total
        FROM payment_methods pm
        INNER JOIN voucher_payments vp ON pm.id = vp.payment_method_id
        INNER JOIN vouchers v ON vp.voucher_id = v.id
        INNER JOIN voucher_details vd ON v.id = vd.voucher_id
        WHERE vd.service_invoice_id = 2
          AND v.enterprise_id = 1
          AND YEAR(v.date) = 2025
          AND MONTH(v.date) = 1
          AND v.status = 1
        GROUP BY pm.id, pm.name, pm.financing
        ORDER BY monto_total DESC
        """

        cursor.execute(query_odonto)
        metodos_odonto = cursor.fetchall()

        if metodos_odonto:
            print(f"\nTotal: {len(metodos_odonto)}")
            print("\nID\t| Nombre\t\t\t\t| Financing\t| Vouchers\t| Monto")
            print("-" * 80)
            for m in metodos_odonto:
                name = m["name"][:40] if m["name"] else ""
                print(
                    f"{m['id']}\t| {name:<40} | {m['financing']}\t\t| {format_number(m['cantidad_vouchers'])}\t| {format_number(m['monto_total'])}"
                )
        else:
            print("No se encontraron metodos de pago para Tratamiento Odontologico")

        cursor.close()
        connection.close()

        print("\n" + "=" * 80)
        print("VERIFICACION FINALIZADA")
        print("=" * 80)

    except Exception as e:
        print(f"\nError al ejecutar la consulta: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
