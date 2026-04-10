#!/usr/bin/env python3
"""
Script para investigar la relacion entre un voucher y un asiento contable especifico.
Voucher ID: 1923826
Asiento ID: 1765908
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

    print(f"\nConectando a MySQL: {host}:{port}/{database}")

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
    print("INVESTIGACION: VOUCHER vs ASIENTO CONTABLE")
    print("Voucher ID: 1923826 vs Asiento ID: 1765908")
    print("=" * 80)

    voucher_id = 1923826
    asiento_id = 1765908

    try:
        connection = get_mysql_connection()
        cursor = connection.cursor()

        # 1. Ver voucher completo
        print("\n" + "-" * 80)
        print("1. VOUCHER COMPLETO")
        print("-" * 80)

        query_voucher = """
        SELECT * FROM vouchers WHERE id = %s
        """
        cursor.execute(query_voucher, (voucher_id,))
        voucher = cursor.fetchone()

        if voucher:
            for key, value in voucher.items():
                print(f"  {key}: {value}")
        else:
            print("Voucher no encontrado")

        # 2. Ver asiento contable completo
        print("\n" + "-" * 80)
        print("2. ASIENTO CONTABLE COMPLETO")
        print("-" * 80)

        query_asiento = """
        SELECT * FROM accounting_entries WHERE id = %s
        """
        cursor.execute(query_asiento, (asiento_id,))
        asiento = cursor.fetchone()

        if asiento:
            for key, value in asiento.items():
                print(f"  {key}: {value}")
        else:
            print("Asiento no encontrado")

        # 3. Detalles del asiento
        print("\n" + "-" * 80)
        print("3. DETALLES DEL ASIENTO CONTABLE")
        print("-" * 80)

        query_detalles = """
        SELECT
            aed.id,
            aed.accounting_entry_id,
            aed.accounting_plan_id,
            ap.name AS cuenta,
            ap.number AS numero_cuenta,
            at.name AS mayor,
            at.type AS tipo,
            aed.debit,
            aed.credit,
            aed.concept,
            aed.branch_id,
            aed.cost_center_id
        FROM accounting_entry_details aed
        INNER JOIN accounting_plans ap ON aed.accounting_plan_id = ap.id
        INNER JOIN accounting_types at ON ap.accounting_type_id = at.id
        WHERE aed.accounting_entry_id = %s
        ORDER BY aed.id
        """
        cursor.execute(query_detalles, (asiento_id,))
        detalles = cursor.fetchall()

        if detalles:
            total_debit = 0
            total_credit = 0
            print(f"\nTotal detalles: {len(detalles)}")
            print("\nID\t| Cuenta\t\t\t| Mayor\t\t| Debito\t| Credito")
            print("-" * 80)
            for d in detalles:
                cuenta = (d["cuenta"] or "")[:25]
                mayor = (d["mayor"] or "")[:15]
                print(
                    f"{d['id']}\t| {cuenta:<25} | {mayor:<15} | {format_number(d['debit'])}\t| {format_number(d['credit'])}"
                )
                total_debit += d["debit"] or 0
                total_credit += d["credit"] or 0
            print("-" * 80)
            print(
                f"TOTAL:\t| \t\t\t| \t\t| {format_number(total_debit)}\t| {format_number(total_credit)}"
            )

        # 4. Buscar relaciones entre voucher y asiento
        print("\n" + "-" * 80)
        print("4. BUSCAR RELACIONES ENTRE VOUCHER Y ASIENTO")
        print("-" * 80)

        # Por fromable_id
        query_rel1 = """
        SELECT * FROM accounting_entries
        WHERE fromable_id = %s AND fromable_type LIKE '%Voucher%'
        """
        cursor.execute(query_rel1, (voucher_id,))
        rel1 = cursor.fetchall()
        print(f"\nAsientos con fromable_id = {voucher_id}: {len(rel1)}")
        for r in rel1:
            print(f"  - Asiento ID: {r['id']}, Total: {format_number(r['total'])}")

        # Por voucher_number
        if voucher:
            query_rel2 = """
            SELECT * FROM accounting_entries
            WHERE voucher_number = %s
            """
            cursor.execute(query_rel2, (voucher.get("voucher_number"),))
            rel2 = cursor.fetchall()
            print(
                f"\nAsientos con voucher_number = {voucher.get('voucher_number')}: {len(rel2)}"
            )
            for r in rel2:
                print(f"  - Asiento ID: {r['id']}, Total: {format_number(r['total'])}")

        # 5. Voucher details
        print("\n" + "-" * 80)
        print("5. VOUCHER_DETAILS")
        print("-" * 80)

        query_vd = """
        SELECT
            vd.id,
            vd.voucher_id,
            vd.service_invoice_id,
            si.name AS servicio,
            vd.contract_id,
            vd.amount,
            vd.excenta,
            vd.iva5,
            vd.iva10,
            vd.description
        FROM voucher_details vd
        LEFT JOIN service_invoices si ON vd.service_invoice_id = si.id
        WHERE vd.voucher_id = %s
        """
        cursor.execute(query_vd, (voucher_id,))
        vdetails = cursor.fetchall()

        if vdetails:
            print(f"\nTotal detalles: {len(vdetails)}")
            for vd in vdetails:
                print(
                    f"  ID: {vd['id']}, Servicio: {vd['servicio']}, Monto: {format_number(vd['amount'])}"
                )
                print(
                    f"    Excenta: {format_number(vd['excenta'])}, IVA5: {format_number(vd['iva5'])}, IVA10: {format_number(vd['iva10'])}"
                )

        # 6. Voucher payments
        print("\n" + "-" * 80)
        print("6. VOUCHER_PAYMENTS (metodos de pago)")
        print("-" * 80)

        query_vp = """
        SELECT
            vp.id,
            vp.voucher_id,
            vp.payment_method_id,
            pm.name AS metodo_pago,
            pm.financing,
            vp.amount
        FROM voucher_payments vp
        INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
        WHERE vp.voucher_id = %s
        """
        cursor.execute(query_vp, (voucher_id,))
        vpayments = cursor.fetchall()

        if vpayments:
            print(f"\nTotal pagos: {len(vpayments)}")
            for vp in vpayments:
                print(
                    f"  ID: {vp['id']}, Metodo: {vp['metodo_pago']}, Financing: {vp['financing']}, Monto: {format_number(vp['amount'])}"
                )

        # 7. Comparar montos
        print("\n" + "-" * 80)
        print("7. COMPARACION DE MONTOS")
        print("-" * 80)

        if voucher and asiento:
            print(f"\nVoucher amount: {format_number(voucher.get('amount'))}")
            print(f"Asiento total:   {format_number(asiento.get('total'))}")
            print(
                f"Diferencia:      {format_number((voucher.get('amount') or 0) - (asiento.get('total') or 0))}"
            )

        # 8. Buscar asientos del mismo voucher por fecha
        if voucher:
            print("\n" + "-" * 80)
            print("8. ASIENTOS EN LA MISMA FECHA DEL VOUCHER")
            print("-" * 80)

            query_same_date = """
            SELECT
                ae.id,
                ae.date,
                ae.concept,
                ae.total,
                ae.fromable_type,
                ae.fromable_id
            FROM accounting_entries ae
            WHERE ae.date = %s
              AND ae.social_reason_id = 1
            ORDER BY ae.id
            LIMIT 20
            """
            cursor.execute(query_same_date, (voucher.get("date"),))
            same_date = cursor.fetchall()

            if same_date:
                print(f"\nAsientos en fecha {voucher.get('date')}: {len(same_date)}")
                for ae in same_date:
                    print(
                        f"  ID: {ae['id']}, Concepto: {ae['concept'][:50]}, Total: {format_number(ae['total'])}"
                    )

        cursor.close()
        connection.close()

        print("\n" + "=" * 80)
        print("INVESTIGACION FINALIZADA")
        print("=" * 80)

    except Exception as e:
        print(f"\nError: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
