#!/usr/bin/env python3
"""
Script simplificado para identificar asientos contables de facturacion TAPO.
Enfoque directo: obtener vouchers TAPO y buscar sus asientos por fromable_id.
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
    print("ASIENTOS CONTABLES - FACTURACION TAPO (DIRECTO)")
    print("Odontologia - Tratamiento Odontologico - Enero 2025")
    print("=" * 80)

    try:
        connection = get_mysql_connection()
        cursor = connection.cursor()

        # Paso 1: Obtener IDs de vouchers TAPO
        print("\n" + "-" * 80)
        print("PASO 1: OBTENER IDS DE VOUCHERS TAPO")
        print("-" * 80)

        query_vouchers = """
        SELECT DISTINCT v.id AS voucher_id
        FROM vouchers v
        INNER JOIN voucher_details vd ON v.id = vd.voucher_id
        INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
        INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
        WHERE v.enterprise_id = 1
          AND vd.service_invoice_id = 2
          AND v.date >= '2025-01-01'
          AND v.date <= '2025-01-31'
          AND v.status = 1
          AND pm.financing = 1
        ORDER BY v.id;
        """

        cursor.execute(query_vouchers)
        vouchers = cursor.fetchall()
        voucher_ids = [v["voucher_id"] for v in vouchers]

        print(f"\nTotal vouchers TAPO encontrados: {len(voucher_ids)}")

        if not voucher_ids:
            print("No se encontraron vouchers TAPO")
            cursor.close()
            connection.close()
            return

        # Paso 2: Buscar asientos contables por fromable_id
        print("\n" + "-" * 80)
        print("PASO 2: BUSCAR ASIENTOS CONTABLES POR FROMABLE_ID")
        print("-" * 80)

        # Crear lista de placeholders para IN clause
        placeholders = ",".join(["%s"] * len(voucher_ids))

        query_asientos = f"""
        SELECT
            ae.id AS asiento_id,
            ae.date AS fecha_asiento,
            ae.number AS numero_asiento,
            ae.concept,
            ae.total,
            ae.fromable_type,
            ae.fromable_id,
            ae.social_reason_id,
            sr.razon_social
        FROM accounting_entries ae
        LEFT JOIN social_reasons sr ON ae.social_reason_id = sr.id
        WHERE ae.fromable_id IN ({placeholders})
          AND ae.fromable_type = 'App\\\\Models\\\\Voucher'
        ORDER BY ae.date, ae.id;
        """

        cursor.execute(query_asientos, voucher_ids)
        asientos = cursor.fetchall()

        if asientos:
            print(f"\nTotal asientos encontrados: {len(asientos)}")
            total_monto = sum(a["total"] or 0 for a in asientos)
            print(f"Suma total asientos: {format_number(total_monto)}")

            print("\nDetalle de asientos:")
            print("ID\t| Fecha\t\t| Concepto\t\t\t\t| Total")
            print("-" * 80)
            for a in asientos[:30]:
                concepto = (a["concept"] or "")[:35]
                print(
                    f"{a['asiento_id']}\t| {str(a['fecha_asiento'])[:10]}\t| {concepto:<35} | {format_number(a['total'])}"
                )
            if len(asientos) > 30:
                print(f"... y {len(asientos) - 30} mas")
        else:
            print(
                "No se encontraron asientos contables con fromable_type = 'App\\Models\\Voucher'"
            )
            print("Buscando sin filtro de fromable_type...")

            # Buscar sin filtro de fromable_type
            query_asientos_all = f"""
            SELECT
                ae.id AS asiento_id,
                ae.date AS fecha_asiento,
                ae.concept,
                ae.total,
                ae.fromable_type,
                ae.fromable_id
            FROM accounting_entries ae
            WHERE ae.fromable_id IN ({placeholders})
            ORDER BY ae.date, ae.id;
            """

            cursor.execute(query_asientos_all, voucher_ids)
            asientos_all = cursor.fetchall()

            if asientos_all:
                print(
                    f"\nEncontrados {len(asientos_all)} asientos (sin filtro de tipo):"
                )
                print("ID\t| Fecha\t\t| Tipo\t\t\t\t| Concepto\t\t| Total")
                print("-" * 100)
                for a in asientos_all[:20]:
                    concepto = (a["concept"] or "")[:25]
                    tipo = (a["fromable_type"] or "NULL")[:25]
                    print(
                        f"{a['asiento_id']}\t| {str(a['fecha_asiento'])[:10]}\t| {tipo}\t| {concepto}\t| {format_number(a['total'])}"
                    )
                asientos = asientos_all

        # Paso 3: Detalles de asientos
        if asientos:
            print("\n" + "-" * 80)
            print("PASO 3: DETALLES DE ASIENTOS CONTABLES")
            print("-" * 80)

            asiento_ids = [a["asiento_id"] for a in asientos]
            placeholders_det = ",".join(["%s"] * len(asiento_ids))

            query_detalles = f"""
            SELECT
                aed.accounting_entry_id AS asiento_id,
                at.type AS group_type,
                CASE at.type
                    WHEN 1 THEN 'Ingresos'
                    WHEN 2 THEN 'Costos'
                    WHEN 3 THEN 'Gastos'
                    ELSE 'Otro'
                END AS tipo_grupo,
                at.name AS mayor,
                ap.id AS cuenta_id,
                ap.name AS cuenta,
                aed.debit,
                aed.credit
            FROM accounting_entry_details aed
            INNER JOIN accounting_plans ap ON aed.accounting_plan_id = ap.id
            INNER JOIN accounting_types at ON ap.accounting_type_id = at.id
            WHERE aed.accounting_entry_id IN ({placeholders_det})
            ORDER BY aed.accounting_entry_id, at.type, ap.name;
            """

            cursor.execute(query_detalles, asiento_ids)
            detalles = cursor.fetchall()

            if detalles:
                print(f"\nTotal detalles encontrados: {len(detalles)}")

                # Resumen por tipo
                print("\nRESUMEN POR TIPO DE CUENTA:")
                print("Tipo\t\t| Cantidad\t| Debito\t| Credito")
                print("-" * 60)

                from collections import defaultdict

                resumen_tipo = defaultdict(
                    lambda: {"cantidad": 0, "debito": 0, "credito": 0}
                )

                for d in detalles:
                    resumen_tipo[d["tipo_grupo"]]["cantidad"] += 1
                    resumen_tipo[d["tipo_grupo"]]["debito"] += d["debit"] or 0
                    resumen_tipo[d["tipo_grupo"]]["credito"] += d["credit"] or 0

                for tipo, datos in sorted(resumen_tipo.items()):
                    print(
                        f"{tipo:<10}\t| {datos['cantidad']}\t\t| {format_number(datos['debito'])}\t| {format_number(datos['credito'])}"
                    )

                total_debito = sum(d["debit"] or 0 for d in detalles)
                total_credito = sum(d["credit"] or 0 for d in detalles)
                print("-" * 60)
                print(
                    f"TOTAL:\t\t| {len(detalles)}\t\t| {format_number(total_debito)}\t| {format_number(total_credito)}"
                )

                # Detalle completo (primeros 30)
                print("\nDETALLE DE ASIENTOS (primeros 30):")
                print(
                    "Asiento\t| Tipo\t\t| Mayor\t\t\t| Cuenta\t\t\t| Debito\t| Credito"
                )
                print("-" * 100)
                for d in detalles[:30]:
                    mayor = (d["mayor"] or "")[:15]
                    cuenta = (d["cuenta"] or "")[:25]
                    print(
                        f"{d['asiento_id']}\t| {d['tipo_grupo']:<10}\t| {mayor:<15} | {cuenta:<25} | {format_number(d['debit'])}\t| {format_number(d['credit'])}"
                    )
                if len(detalles) > 30:
                    print(f"... y {len(detalles) - 30} detalles mas")

        # Paso 4: Comparacion
        print("\n" + "-" * 80)
        print("PASO 4: COMPARACION FACTURACION vs ASIENTOS")
        print("-" * 80)

        # Monto facturacion
        query_fact = f"""
        SELECT SUM(v.amount) AS total
        FROM vouchers v
        WHERE v.id IN ({placeholders})
        """
        cursor.execute(query_fact, voucher_ids)
        fact_result = cursor.fetchone()
        total_facturacion = fact_result["total"] or 0

        # Monto asientos
        total_asientos = sum(a["total"] or 0 for a in asientos) if asientos else 0

        print(f"\nFacturacion TAPO (vouchers):  {format_number(total_facturacion)}")
        print(f"Asientos contables:           {format_number(total_asientos)}")
        print(
            f"Diferencia:                   {format_number(total_facturacion - total_asientos)}"
        )

        if abs(total_facturacion - total_asientos) < 1000:
            print("\nCOINCIDENCIA: Facturacion y asientos coinciden")
        else:
            print(
                f"\nDIFERENCIA: {format_number(abs(total_facturacion - total_asientos))}"
            )

        cursor.close()
        connection.close()

        print("\n" + "=" * 80)
        print("CONSULTA FINALIZADA")
        print("=" * 80)

    except Exception as e:
        print(f"\nError: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
