#!/usr/bin/env python3
"""
Script para investigar la relacion entre vouchers y asientos contables.
Explora diferentes formas de relacionar vouchers con accounting_entries.
"""

import os
import sys
from pathlib import Path

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
    print("INVESTIGACION: RELACION VOUCHERS - ASIENTOS CONTABLES")
    print("=" * 80)

    # Lista de IDs de vouchers TAPO (de la consulta anterior)
    voucher_ids = [
        1923826,
        1923964,
        1923965,
        1924563,
        1925076,
        1925113,
        1925693,
        1925708,
        1925873,
        1925929,
        1925944,
        1925985,
        1926676,
        1927426,
        1927530,
        1928776,
        1929792,
        1929962,
        1930703,
        1931278,
    ]

    try:
        connection = get_mysql_connection()
        cursor = connection.cursor()

        # Consulta 1: Valores de fromable_type en accounting_entries
        print("\n" + "-" * 80)
        print("VALORES DE fromable_type EN accounting_entries")
        print("-" * 80)

        query_fromable_types = """
        SELECT
            fromable_type,
            COUNT(*) AS cantidad
        FROM accounting_entries
        WHERE fromable_type IS NOT NULL
        GROUP BY fromable_type
        ORDER BY cantidad DESC
        LIMIT 20;
        """

        cursor.execute(query_fromable_types)
        types = cursor.fetchall()

        if types:
            print("\nTipo\t\t\t\t| Cantidad")
            print("-" * 60)
            for t in types:
                tipo = t["fromable_type"] or "NULL"
                print(f"{tipo:<30}\t| {format_number(t['cantidad'])}")
        else:
            print("No se encontraron tipos")

        # Consulta 2: Asientos contables de enero 2025
        print("\n" + "-" * 80)
        print("ASIENTOS CONTABLES DE ENERO 2025 (muestra)")
        print("-" * 80)

        query_asientos_enero = """
        SELECT
            ae.id,
            ae.date,
            ae.number,
            ae.concept,
            ae.total,
            ae.fromable_type,
            ae.fromable_id,
            ae.social_reason_id,
            sr.razon_social
        FROM accounting_entries ae
        LEFT JOIN social_reasons sr ON ae.social_reason_id = sr.id
        WHERE YEAR(ae.date) = 2025
          AND MONTH(ae.date) = 1
        ORDER BY ae.date, ae.id
        LIMIT 20;
        """

        cursor.execute(query_asientos_enero)
        asientos = cursor.fetchall()

        if asientos:
            print("\nID\t| Fecha\t\t| Concepto\t\t\t\t| Total\t\t| Tipo\t\t| Fromable")
            print("-" * 100)
            for a in asientos:
                concepto = (a["concept"] or "")[:30]
                tipo = (a["fromable_type"] or "NULL")[:15]
                fromable = a["fromable_id"] or "NULL"
                print(
                    f"{a['id']}\t| {str(a['date'])[:10]}\t| {concepto:<30} | {format_number(a['total'])}\t| {tipo}\t| {fromable}"
                )
        else:
            print("No se encontraron asientos en enero 2025")

        # Consulta 3: Buscar asientos por fromable_id = voucher_id
        print("\n" + "-" * 80)
        print("BUSCAR ASIENTOS POR fromable_id = voucher_id")
        print("-" * 80)

        placeholders = ",".join(["%s"] * len(voucher_ids))
        query_by_fromable_id = f"""
        SELECT
            ae.id AS asiento_id,
            ae.date,
            ae.number,
            ae.concept,
            ae.total,
            ae.fromable_type,
            ae.fromable_id,
            v.id AS voucher_id,
            v.voucher_number,
            v.amount
        FROM accounting_entries ae
        INNER JOIN vouchers v ON ae.fromable_id = v.id
        WHERE ae.fromable_id IN ({placeholders})
        LIMIT 20;
        """

        cursor.execute(query_by_fromable_id, voucher_ids)
        asientos_by_fromable = cursor.fetchall()

        if asientos_by_fromable:
            print(f"\nEncontrados: {len(asientos_by_fromable)} asientos")
            print("\nAsiento\t| Fecha\t\t| Concepto\t\t\t| Total\t\t| Voucher ID")
            print("-" * 80)
            for a in asientos_by_fromable:
                concepto = (a["concept"] or "")[:25]
                print(
                    f"{a['asiento_id']}\t| {str(a['date'])[:10]}\t| {concepto:<25} | {format_number(a['total'])}\t| {a['voucher_id']}"
                )
        else:
            print("No se encontraron asientos por fromable_id")

        # Consulta 4: Buscar por voucher_number
        print("\n" + "-" * 80)
        print("BUSCAR ASIENTOS POR voucher_number (numero de comprobante)")
        print("-" * 80)

        query_by_voucher_number = """
        SELECT
            ae.id AS asiento_id,
            ae.date,
            ae.number AS numero_asiento,
            ae.voucher_number,
            ae.concept,
            ae.total,
            v.id AS voucher_id,
            v.voucher_number AS voucher_num
        FROM accounting_entries ae
        INNER JOIN vouchers v ON ae.voucher_number = v.voucher_number
        WHERE v.id IN ({})
        LIMIT 20;
        """.format(placeholders)

        cursor.execute(query_by_voucher_number, voucher_ids)
        asientos_by_number = cursor.fetchall()

        if asientos_by_number:
            print(
                f"\nEncontrados: {len(asientos_by_number)} asientos por voucher_number"
            )
            print("\nAsiento\t| Fecha\t\t| Voucher Number\t| Total\t\t| Voucher ID")
            print("-" * 80)
            for a in asientos_by_number:
                print(
                    f"{a['asiento_id']}\t| {str(a['date'])[:10]}\t| {a['voucher_number']}\t\t| {format_number(a['total'])}\t| {a['voucher_id']}"
                )
        else:
            print("No se encontraron asientos por voucher_number")

        # Consulta 5: Ver estructura de vouchers
        print("\n" + "-" * 80)
        print("ESTRUCTURA DE VOUCHERS (campos relacionados con contabilidad)")
        print("-" * 80)

        query_voucher_structure = """
        SELECT
            v.id,
            v.voucher_number,
            v.amount,
            v.accounting_seated,
            v.ascont_migration,
            v.invoice_id,
            v.payment_id,
            v.contract_id,
            v.date
        FROM vouchers v
        WHERE v.id IN ({})
        LIMIT 5;
        """.format(placeholders)

        cursor.execute(query_voucher_structure, voucher_ids[:5])
        vouchers_structure = cursor.fetchall()

        if vouchers_structure:
            print("\nID\t| Voucher\t| Monto\t\t| Acc. Seated\t| Ascont\t| Invoice ID")
            print("-" * 80)
            for v in vouchers_structure:
                print(
                    f"{v['id']}\t| {v['voucher_number']}\t\t| {format_number(v['amount'])}\t| {v['accounting_seated']}\t\t| {v['ascont_migration']}\t| {v['invoice_id'] or 'NULL'}"
                )

        # Consulta 6: Buscar asientos por concepto que contenga "voucher" o "factura"
        print("\n" + "-" * 80)
        print("BUSCAR ASIENTOS POR CONCEPTO RELACIONADO CON VOUCHERS")
        print("-" * 80)

        query_by_concept = """
        SELECT
            ae.id,
            ae.date,
            ae.concept,
            ae.total,
            ae.voucher_number
        FROM accounting_entries ae
        WHERE YEAR(ae.date) = 2025
          AND MONTH(ae.date) = 1
          AND (ae.concept LIKE '%voucher%'
               OR ae.concept LIKE '%factura%'
               OR ae.concept LIKE '%tratamiento%'
               OR ae.concept LIKE '%odontolog%')
        LIMIT 20;
        """

        cursor.execute(query_by_concept)
        asientos_by_concept = cursor.fetchall()

        if asientos_by_concept:
            print(f"\nEncontrados: {len(asientos_by_concept)} asientos por concepto")
            print("\nID\t| Fecha\t\t| Concepto\t\t\t\t| Total")
            print("-" * 80)
            for a in asientos_by_concept:
                concepto = (a["concept"] or "")[:40]
                print(
                    f"{a['id']}\t| {str(a['date'])[:10]}\t| {concepto:<40} | {format_number(a['total'])}"
                )
        else:
            print("No se encontraron asientos por concepto relacionado")

        # Consulta 7: Buscar por social_reason_id = 1 (IDEM)
        print("\n" + "-" * 80)
        print("ASIENTOS CONTABLES DE IDEM (social_reason_id = 1) - Enero 2025")
        print("-" * 80)

        query_idem_asientos = """
        SELECT
            ae.id,
            ae.date,
            ae.concept,
            ae.total,
            ae.fromable_type,
            ae.fromable_id,
            at.type AS group_type,
            CASE at.type
                WHEN 1 THEN 'Ingresos'
                WHEN 2 THEN 'Costos'
                WHEN 3 THEN 'Gastos'
                ELSE 'Otro'
            END AS tipo_grupo
        FROM accounting_entries ae
        INNER JOIN accounting_entry_details aed ON aed.accounting_entry_id = ae.id
        INNER JOIN accounting_plans ap ON aed.accounting_plan_id = ap.id
        INNER JOIN accounting_types at ON ap.accounting_type_id = at.id
        WHERE ae.social_reason_id = 1
          AND YEAR(ae.date) = 2025
          AND MONTH(ae.date) = 1
        GROUP BY ae.id, ae.date, ae.concept, ae.total, ae.fromable_type, ae.fromable_id, at.type
        ORDER BY ae.date, ae.id
        LIMIT 30;
        """

        cursor.execute(query_idem_asientos)
        idem_asientos = cursor.fetchall()

        if idem_asientos:
            print(f"\nEncontrados: {len(idem_asientos)} asientos de IDEM")
            print("\nID\t| Fecha\t\t| Concepto\t\t\t\t| Total\t\t| Tipo")
            print("-" * 100)
            for a in idem_asientos:
                concepto = (a["concept"] or "")[:35]
                print(
                    f"{a['id']}\t| {str(a['date'])[:10]}\t| {concepto:<35} | {format_number(a['total'])}\t| {a['tipo_grupo']}"
                )
        else:
            print("No se encontraron asientos de IDEM")

        # Consulta 8: Total de asientos por tipo en enero 2025 para IDEM
        print("\n" + "-" * 80)
        print("RESUMEN ASIENTOS IDEM POR TIPO - Enero 2025")
        print("-" * 80)

        query_resumen_idem = """
        SELECT
            at.type AS group_type,
            CASE at.type
                WHEN 1 THEN 'Ingresos'
                WHEN 2 THEN 'Costos'
                WHEN 3 THEN 'Gastos'
                ELSE 'Otro'
            END AS tipo_grupo,
            COUNT(DISTINCT ae.id) AS cantidad_asientos,
            SUM(aed.debit) AS total_debito,
            SUM(aed.credit) AS total_credito
        FROM accounting_entries ae
        INNER JOIN accounting_entry_details aed ON aed.accounting_entry_id = ae.id
        INNER JOIN accounting_plans ap ON aed.accounting_plan_id = ap.id
        INNER JOIN accounting_types at ON ap.accounting_type_id = at.id
        WHERE ae.social_reason_id = 1
          AND YEAR(ae.date) = 2025
          AND MONTH(ae.date) = 1
        GROUP BY at.type
        ORDER BY at.type;
        """

        cursor.execute(query_resumen_idem)
        resumen_idem = cursor.fetchall()

        if resumen_idem:
            print("\nTipo\t\t| Asientos\t| Debito\t\t| Credito")
            print("-" * 60)
            for r in resumen_idem:
                print(
                    f"{r['tipo_grupo']:<10}\t| {format_number(r['cantidad_asientos'])}\t| {format_number(r['total_debito'])}\t| {format_number(r['total_credito'])}"
                )

            total_debito = sum(r["total_debito"] or 0 for r in resumen_idem)
            total_credito = sum(r["total_credito"] or 0 for r in resumen_idem)
            print("-" * 60)
            print(
                f"TOTAL:\t\t| {sum(r['cantidad_asientos'] or 0 for r in resumen_idem)}\t\t| {format_number(total_debito)}\t| {format_number(total_credito)}"
            )

        cursor.close()
        connection.close()

        print("\n" + "=" * 80)
        print("INVESTIGACION FINALIZADA")
        print("=" * 80)

    except Exception as e:
        print(f"\nError al ejecutar la consulta: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
