#!/usr/bin/env python3
"""
Script para identificar asientos contables de facturacion TAPO - Enero 2025
Relaciona los vouchers de tratamientos odontologicos financiados por TAPO
con sus asientos contables correspondientes.

Filtros de facturacion:
    - enterprise_id = 1 (Odontologia)
    - service_invoice_id = 2 (Tratamiento Odontologico)
    - Fecha: Enero 2025 (01/01/2025 - 31/01/2025)
    - status = 1 (Activo)
    - Via de pago: FINANCIACION DE PRESUPUESTO (financing = 1)

Facturacion identificada: 139,867,750 (87 vouchers)
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
    print("ASIENTOS CONTABLES - FACTURACION TAPO")
    print("Odontologia - Tratamiento Odontologico - Enero 2025")
    print("=" * 80)

    # Consulta 1: Vouchers TAPO con su estado de asiento contable
    query_vouchers_asientos = """
    SELECT
        v.id AS voucher_id,
        v.date AS fecha,
        v.voucher_number,
        v.amount AS monto_voucher,
        v.accounting_seated,
        pm.name AS metodo_pago,
        CASE v.accounting_seated
            WHEN 1 THEN 'SI'
            ELSE 'NO'
        END AS tiene_asiento
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
    ORDER BY v.date, v.id;
    """

    # Consulta 2: Asientos contables relacionados con vouchers TAPO
    query_asientos = """
    SELECT
        ae.id AS asiento_id,
        ae.date AS fecha_asiento,
        ae.number AS numero_asiento,
        ae.concept,
        ae.total,
        ae.fromable_type,
        ae.fromable_id,
        v.id AS voucher_id,
        v.voucher_number,
        v.amount AS monto_voucher,
        sr.id AS social_reason_id,
        sr.razon_social
    FROM accounting_entries ae
    INNER JOIN vouchers v ON ae.fromable_id = v.id
    INNER JOIN enterprises e ON v.enterprise_id = e.id
    INNER JOIN social_reasons sr ON e.social_reason_id = sr.id
    INNER JOIN voucher_details vd ON v.id = vd.voucher_id
    INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
    INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
    WHERE v.enterprise_id = 1
      AND vd.service_invoice_id = 2
      AND v.date >= '2025-01-01'
      AND v.date <= '2025-01-31'
      AND v.status = 1
      AND pm.financing = 1
      AND ae.fromable_type = 'App\\Models\\Voucher'
    ORDER BY ae.date, ae.id;
    """

    # Consulta 3: Detalles de asientos contables
    query_detalles = """
    SELECT
        ae.id AS asiento_id,
        ae.date AS fecha,
        ae.concept,
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
        aed.credit,
        v.id AS voucher_id,
        v.voucher_number,
        v.amount AS monto_voucher,
        sr.razon_social
    FROM accounting_entries ae
    INNER JOIN accounting_entry_details aed ON aed.accounting_entry_id = ae.id
    INNER JOIN accounting_plans ap ON aed.accounting_plan_id = ap.id
    INNER JOIN accounting_types at ON ap.accounting_type_id = at.id
    INNER JOIN vouchers v ON ae.fromable_id = v.id
    INNER JOIN enterprises e ON v.enterprise_id = e.id
    INNER JOIN social_reasons sr ON e.social_reason_id = sr.id
    INNER JOIN voucher_details vd ON v.id = vd.voucher_id
    INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
    INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
    WHERE v.enterprise_id = 1
      AND vd.service_invoice_id = 2
      AND v.date >= '2025-01-01'
      AND v.date <= '2025-01-31'
      AND v.status = 1
      AND pm.financing = 1
      AND ae.fromable_type = 'App\\Models\\Voucher'
    ORDER BY ae.id, at.type, ap.name;
    """

    # Consulta 4: Resumen por tipo de cuenta (Ingresos, Costos, Gastos)
    query_resumen_tipo = """
    SELECT
        at.type AS group_type,
        CASE at.type
            WHEN 1 THEN 'Ingresos'
            WHEN 2 THEN 'Costos'
            WHEN 3 THEN 'Gastos'
            ELSE 'Otro'
        END AS tipo_grupo,
        at.name AS mayor,
        COUNT(DISTINCT ae.id) AS cantidad_asientos,
        SUM(aed.debit) AS total_debito,
        SUM(aed.credit) AS total_credito
    FROM accounting_entries ae
    INNER JOIN accounting_entry_details aed ON aed.accounting_entry_id = ae.id
    INNER JOIN accounting_plans ap ON aed.accounting_plan_id = ap.id
    INNER JOIN accounting_types at ON ap.accounting_type_id = at.id
    INNER JOIN vouchers v ON ae.fromable_id = v.id
    INNER JOIN voucher_details vd ON v.id = vd.voucher_id
    INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
    INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
    WHERE v.enterprise_id = 1
      AND vd.service_invoice_id = 2
      AND v.date >= '2025-01-01'
      AND v.date <= '2025-01-31'
      AND v.status = 1
      AND pm.financing = 1
      AND ae.fromable_type = 'App\\Models\\Voucher'
    GROUP BY at.type, at.name
    ORDER BY at.type;
    """

    # Consulta 5: Resumen por cuenta contable
    query_resumen_cuenta = """
    SELECT
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
        COUNT(DISTINCT ae.id) AS cantidad_asientos,
        SUM(aed.debit) AS total_debito,
        SUM(aed.credit) AS total_credito
    FROM accounting_entries ae
    INNER JOIN accounting_entry_details aed ON aed.accounting_entry_id = ae.id
    INNER JOIN accounting_plans ap ON aed.accounting_plan_id = ap.id
    INNER JOIN accounting_types at ON ap.accounting_type_id = at.id
    INNER JOIN vouchers v ON ae.fromable_id = v.id
    INNER JOIN voucher_details vd ON v.id = vd.voucher_id
    INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
    INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
    WHERE v.enterprise_id = 1
      AND vd.service_invoice_id = 2
      AND v.date >= '2025-01-01'
      AND v.date <= '2025-01-31'
      AND v.status = 1
      AND pm.financing = 1
      AND ae.fromable_type = 'App\\Models\\Voucher'
    GROUP BY at.type, at.name, ap.id, ap.name
    ORDER BY at.type, total_credito DESC, total_debito DESC;
    """

    # Consulta 6: Comparacion facturacion vs asientos
    query_comparacion = """
    SELECT
        'FACTURACION_TAPO' AS origen,
        COUNT(DISTINCT v.id) AS cantidad,
        SUM(v.amount) AS monto
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

    UNION ALL

    SELECT
        'ASIENTOS_CONTABLES' AS origen,
        COUNT(DISTINCT ae.id) AS cantidad,
        SUM(ae.total) AS monto
    FROM accounting_entries ae
    INNER JOIN vouchers v ON ae.fromable_id = v.id
    INNER JOIN voucher_details vd ON v.id = vd.voucher_id
    INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
    INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
    WHERE v.enterprise_id = 1
      AND vd.service_invoice_id = 2
      AND v.date >= '2025-01-01'
      AND v.date <= '2025-01-31'
      AND v.status = 1
      AND pm.financing = 1
      AND ae.fromable_type = 'App\\Models\\Voucher'
    """

    try:
        connection = get_mysql_connection()
        cursor = connection.cursor()

        # Consulta 1: Vouchers y su estado de asiento
        print("\n" + "-" * 80)
        print("VOUCHERS TAPO Y ESTADO DE ASIENTO CONTABLE")
        print("-" * 80)

        cursor.execute(query_vouchers_asientos)
        vouchers = cursor.fetchall()

        if vouchers:
            con_asiento = sum(1 for v in vouchers if v["accounting_seated"] == 1)
            sin_asiento = sum(1 for v in vouchers if v["accounting_seated"] != 1)
            total_monto = sum(v["monto_voucher"] or 0 for v in vouchers)

            print(f"\nTotal vouchers: {len(vouchers)}")
            print(f"Con asiento contable: {con_asiento}")
            print(f"Sin asiento contable: {sin_asiento}")
            print(f"Monto total: {format_number(total_monto)}")

            print("\nDetalle de vouchers:")
            print("ID\t| Fecha\t\t| Voucher\t| Monto\t\t| Asiento")
            print("-" * 80)
            for v in vouchers[:20]:  # Mostrar primeros 20
                print(
                    f"{v['voucher_id']}\t| {str(v['fecha'])[:10]}\t| {v['voucher_number']}\t| {format_number(v['monto_voucher'])}\t| {v['tiene_asiento']}"
                )
            if len(vouchers) > 20:
                print(f"... y {len(vouchers) - 20} mas")
        else:
            print("No se encontraron vouchers")

        # Consulta 2: Asientos contables relacionados
        print("\n" + "-" * 80)
        print("ASIENTOS CONTABLES RELACIONADOS")
        print("-" * 80)

        cursor.execute(query_asientos)
        asientos = cursor.fetchall()

        if asientos:
            print(f"\nTotal asientos encontrados: {len(asientos)}")
            total_asientos = sum(a["total"] or 0 for a in asientos)
            print(f"Suma total asientos: {format_number(total_asientos)}")

            print("\nDetalle de asientos:")
            print("ID\t| Fecha\t\t| Concepto\t\t\t\t| Total")
            print("-" * 80)
            for a in asientos[:20]:
                concepto = (a["concept"] or "")[:40]
                print(
                    f"{a['asiento_id']}\t| {str(a['fecha_asiento'])[:10]}\t| {concepto:<40} | {format_number(a['total'])}"
                )
            if len(asientos) > 20:
                print(f"... y {len(asientos) - 20} mas")
        else:
            print("No se encontraron asientos contables relacionados")
            print("Posibles causas:")
            print("  - Los vouchers no tienen asiento contable generado")
            print("  - El campo fromable_type no es 'Voucher'")
            print("  - Los asientos no estan relacionados")

        # Consulta 3: Detalles de asientos
        print("\n" + "-" * 80)
        print("DETALLES DE ASIENTOS CONTABLES")
        print("-" * 80)

        cursor.execute(query_detalles)
        detalles = cursor.fetchall()

        if detalles:
            print(f"\nTotal detalles encontrados: {len(detalles)}")

            print("\nDetalle completo:")
            print("Asiento\t| Tipo\t\t| Mayor\t\t\t| Cuenta\t\t\t| Debito\t| Credito")
            print("-" * 100)
            for d in detalles[:30]:
                mayor = (d["mayor"] or "")[:20]
                cuenta = (d["cuenta"] or "")[:25]
                print(
                    f"{d['asiento_id']}\t| {d['tipo_grupo']:<10}\t| {mayor:<20} | {cuenta:<25} | {format_number(d['debit'])}\t| {format_number(d['credit'])}"
                )
            if len(detalles) > 30:
                print(f"... y {len(detalles) - 30} mas")
        else:
            print("No se encontraron detalles de asientos")

        # Consulta 4: Resumen por tipo de cuenta
        print("\n" + "-" * 80)
        print("RESUMEN POR TIPO DE CUENTA (Ingresos/Costos/Gastos)")
        print("-" * 80)

        cursor.execute(query_resumen_tipo)
        resumen_tipo = cursor.fetchall()

        if resumen_tipo:
            print("\nTipo\t\t| Mayor\t\t\t\t| Asientos\t| Debito\t| Credito")
            print("-" * 80)
            for r in resumen_tipo:
                mayor = (r["mayor"] or "")[:25]
                print(
                    f"{r['tipo_grupo']:<10}\t| {mayor:<25} | {format_number(r['cantidad_asientos'])}\t| {format_number(r['total_debito'])}\t| {format_number(r['total_credito'])}"
                )
        else:
            print("No se encontro resumen por tipo")

        # Consulta 5: Resumen por cuenta contable
        print("\n" + "-" * 80)
        print("RESUMEN POR CUENTA CONTABLE")
        print("-" * 80)

        cursor.execute(query_resumen_cuenta)
        resumen_cuenta = cursor.fetchall()

        if resumen_cuenta:
            print("\nCuenta ID\t| Mayor\t\t\t| Cuenta\t\t\t| Debito\t| Credito")
            print("-" * 100)
            for r in resumen_cuenta[:20]:
                mayor = (r["mayor"] or "")[:15]
                cuenta = (r["cuenta"] or "")[:30]
                print(
                    f"{r['cuenta_id']}\t\t| {mayor:<15} | {cuenta:<30} | {format_number(r['total_debito'])}\t| {format_number(r['total_credito'])}"
                )
            if len(resumen_cuenta) > 20:
                print(f"... y {len(resumen_cuenta) - 20} mas")
        else:
            print("No se encontro resumen por cuenta")

        # Consulta 6: Comparacion facturacion vs asientos
        print("\n" + "-" * 80)
        print("COMPARACION: FACTURACION vs ASIENTOS CONTABLES")
        print("-" * 80)

        cursor.execute(query_comparacion)
        comparacion = cursor.fetchall()

        if comparacion:
            print("\nOrigen\t\t\t| Cantidad\t| Monto")
            print("-" * 60)
            for c in comparacion:
                print(
                    f"{c['origen']:<20}\t| {format_number(c['cantidad'])}\t| {format_number(c['monto'])}"
                )

            if len(comparacion) == 2:
                facturacion = comparacion[0]["monto"] or 0
                asientos = comparacion[1]["monto"] or 0
                diferencia = facturacion - asientos
                print("-" * 60)
                print(f"DIFERENCIA:\t\t\t| {format_number(diferencia)}")

                if abs(diferencia) < 1000:
                    print("\nCOINCIDENCIA: Facturacion y asientos coinciden")
                else:
                    print(
                        f"\nDIFERENCIA de {format_number(abs(diferencia))} entre facturacion y asientos"
                    )

        cursor.close()
        connection.close()

        print("\n" + "=" * 80)
        print("CONSULTA DE ASIENTOS CONTABLES FINALIZADA")
        print("=" * 80)

    except Exception as e:
        print(f"\nError al ejecutar la consulta: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
