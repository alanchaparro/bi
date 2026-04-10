#!/usr/bin/env python3
"""
Script para obtener TODOS los detalles de asientos contables de facturacion TAPO.
Enero 2025 - Odontologia - Tratamiento Odontologico

Estructura del asiento (3 detalles):
1. Debito - CAJA (dinero que entra)
2. Credito - IVA DEBITO FISCAL (IVA 10%)
3. Credito - INGRESOS POR TRATAMIENTO (ingresos sin IVA)

IMPORTANTE: Las cuentas de CAJA e IVA tienen accounting_type_id = NULL,
por lo que se debe usar LEFT JOIN con accounting_types.
"""

import os
import sys
from collections import defaultdict
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
    print("ASIENTOS CONTABLES COMPLETOS - FACTURACION TAPO")
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
        ORDER BY v.id
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

        # Paso 2: Obtener TODOS los detalles de los asientos (con LEFT JOIN)
        print("\n" + "-" * 80)
        print("PASO 2: OBTENER TODOS LOS DETALLES DE ASIENTOS")
        print("-" * 80)

        placeholders = ",".join(["%s"] * len(voucher_ids))

        query_detalles = """
        SELECT
            ae.id AS asiento_id,
            ae.date AS fecha,
            ae.number AS numero_asiento,
            ae.concept,
            ae.total AS total_asiento,
            v.id AS voucher_id,
            v.voucher_number,
            v.amount AS monto_voucher,
            aed.id AS detalle_id,
            ap.id AS cuenta_id,
            ap.number AS codigo_cuenta,
            ap.name AS cuenta,
            ap.accounting_type_id,
            at.name AS mayor,
            at.type AS tipo,
            CASE at.type
                WHEN 1 THEN 'Ingresos'
                WHEN 2 THEN 'Costos'
                WHEN 3 THEN 'Gastos'
                WHEN 4 THEN 'Activo'
                WHEN 5 THEN 'Pasivo'
                WHEN 6 THEN 'Patrimonio'
                ELSE 'Otro'
            END AS tipo_nombre,
            aed.debit,
            aed.credit
        FROM vouchers v
        INNER JOIN accounting_entries ae ON ae.fromable_id = v.id
        INNER JOIN accounting_entry_details aed ON aed.accounting_entry_id = ae.id
        INNER JOIN accounting_plans ap ON aed.accounting_plan_id = ap.id
        LEFT JOIN accounting_types at ON ap.accounting_type_id = at.id
        WHERE v.id IN ({})
          AND ae.fromable_type = 'App\\\\Models\\\\Voucher'
        ORDER BY ae.id, aed.debit DESC, aed.credit DESC
        """.format(placeholders)

        cursor.execute(query_detalles, tuple(voucher_ids))
        detalles = cursor.fetchall()

        print(f"\nTotal detalles encontrados: {len(detalles)}")

        # Agrupar por asiento
        asientos = defaultdict(list)
        for d in detalles:
            asientos[d["asiento_id"]].append(d)

        print(f"Total asientos unicos: {len(asientos)}")

        # Mostrar primeros 5 asientos con todos sus detalles
        print("\n" + "=" * 80)
        print("PRIMEROS 5 ASIENTOS CON TODOS LOS DETALLES")
        print("=" * 80)

        for i, (aid, dets) in enumerate(list(asientos.items())[:5]):
            print(f"\n--- Asiento {aid} ({len(dets)} detalles) ---")
            print(f"Fecha: {dets[0]['fecha']}")
            print(f"Concepto: {dets[0]['concept']}")
            print(f"Voucher: {dets[0]['voucher_number']} (ID: {dets[0]['voucher_id']})")
            print(f"Monto Voucher: {format_number(dets[0]['monto_voucher'])}")
            print()
            print("Codigo\t\t| Tipo\t\t| Cuenta\t\t\t\t| Debito\t| Credito")
            print("-" * 100)

            total_debito = 0
            total_credito = 0

            for d in dets:
                cuenta = (d["cuenta"] or "")[:35]
                codigo = d["codigo_cuenta"] or ""
                tipo = d["tipo_nombre"] or "N/A"
                print(
                    f"{codigo}\t\t| {tipo:<10}\t| {cuenta:<35} | {format_number(d['debit'])}\t| {format_number(d['credit'])}"
                )
                total_debito += d["debit"] or 0
                total_credito += d["credit"] or 0

            print("-" * 100)
            print(
                f"TOTAL:\t\t| \t\t| \t\t\t\t| {format_number(total_debito)}\t| {format_number(total_credito)}"
            )

        # Resumen por tipo de cuenta
        print("\n" + "=" * 80)
        print("RESUMEN POR TIPO DE CUENTA")
        print("=" * 80)

        resumen_tipo = defaultdict(lambda: {"debito": 0, "credito": 0, "cantidad": 0})

        for d in detalles:
            tipo = d["tipo_nombre"] or "N/A"
            resumen_tipo[tipo]["debito"] += d["debit"] or 0
            resumen_tipo[tipo]["credito"] += d["credit"] or 0
            resumen_tipo[tipo]["cantidad"] += 1

        print("\nTipo\t\t| Cantidad\t| Debito\t\t| Credito")
        print("-" * 70)

        for tipo, datos in sorted(resumen_tipo.items()):
            print(
                f"{tipo:<10}\t| {datos['cantidad']}\t\t| {format_number(datos['debito'])}\t\t| {format_number(datos['credito'])}"
            )

        total_debito = sum(d["debito"] for d in resumen_tipo.values())
        total_credito = sum(d["credito"] for d in resumen_tipo.values())

        print("-" * 70)
        print(
            f"TOTAL:\t\t| {len(detalles)}\t\t| {format_number(total_debito)}\t\t| {format_number(total_credito)}"
        )

        # Resumen por categoria
        print("\n" + "=" * 80)
        print("RESUMEN POR CATEGORIA (CAJA, IVA, INGRESOS)")
        print("=" * 80)

        categorias = {
            "CAJA": {"debito": 0, "credito": 0, "cantidad": 0},
            "IVA": {"debito": 0, "credito": 0, "cantidad": 0},
            "INGRESOS": {"debito": 0, "credito": 0, "cantidad": 0},
            "OTROS": {"debito": 0, "credito": 0, "cantidad": 0},
        }

        for d in detalles:
            cuenta = (d["cuenta"] or "").upper()
            if "CAJA" in cuenta:
                categorias["CAJA"]["debito"] += d["debit"] or 0
                categorias["CAJA"]["credito"] += d["credit"] or 0
                categorias["CAJA"]["cantidad"] += 1
            elif "IVA" in cuenta:
                categorias["IVA"]["debito"] += d["debit"] or 0
                categorias["IVA"]["credito"] += d["credit"] or 0
                categorias["IVA"]["cantidad"] += 1
            elif "INGRESO" in cuenta or "VENTA" in cuenta:
                categorias["INGRESOS"]["debito"] += d["debit"] or 0
                categorias["INGRESOS"]["credito"] += d["credit"] or 0
                categorias["INGRESOS"]["cantidad"] += 1
            else:
                categorias["OTROS"]["debito"] += d["debit"] or 0
                categorias["OTROS"]["credito"] += d["credit"] or 0
                categorias["OTROS"]["cantidad"] += 1

        print("\nCategoria\t| Cantidad\t| Debito\t\t| Credito")
        print("-" * 70)

        for cat, datos in categorias.items():
            print(
                f"{cat:<10}\t| {datos['cantidad']}\t\t| {format_number(datos['debito'])}\t\t| {format_number(datos['credito'])}"
            )

        # Comparacion final
        print("\n" + "=" * 80)
        print("COMPARACION FINAL")
        print("=" * 80)

        total_vouchers = sum(d[0]["monto_voucher"] for d in asientos.values())
        total_asientos = sum(d[0]["total_asiento"] for d in asientos.values())
        total_debito_detalle = sum(d["debit"] or 0 for d in detalles)
        total_credito_detalle = sum(d["credit"] or 0 for d in detalles)

        print(f"\nTotal Vouchers (87 TAPO):     {format_number(total_vouchers)}")
        print(f"Total Asientos:               {format_number(total_asientos)}")
        print(f"Suma Debitos Detalles:        {format_number(total_debito_detalle)}")
        print(f"Suma Creditos Detalles:       {format_number(total_credito_detalle)}")

        if abs(total_vouchers - total_debito_detalle) < 1000:
            print("\n COINCIDENCIA: Los vouchers coinciden con el total de debitos")
        else:
            print(
                f"\n DIFERENCIA con debitos: {format_number(abs(total_vouchers - total_debito_detalle))}"
            )

        if abs(total_debito_detalle - total_credito_detalle) < 1000:
            print(" COINCIDENCIA: Los debitos coinciden con los creditos")
        else:
            print(
                f" DIFERENCIA entre debito/credito: {format_number(abs(total_debito_detalle - total_credito_detalle))}"
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
