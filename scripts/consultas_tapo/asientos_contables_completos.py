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

        # Consulta principal: Todos los detalles de asientos
        print("\n" + "-" * 80)
        print("DETALLES COMPLETOS DE ASIENTOS CONTABLES")
        print("-" * 80)

        query = """
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
            at.name AS mayor,
            at.type AS tipo,
            CASE at.type
                WHEN 1 THEN 'Ingresos'
                WHEN 2 THEN 'Costos'
                WHEN 3 THEN 'Gastos'
                ELSE 'Otro'
            END AS tipo_nombre,
            aed.debit,
            aed.credit,
            pm.name AS metodo_pago,
            pm.financing
        FROM vouchers v
        INNER JOIN voucher_details vd ON v.id = vd.voucher_id
        INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
        INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
        INNER JOIN accounting_entries ae ON ae.fromable_id = v.id
        INNER JOIN accounting_entry_details aed ON aed.accounting_entry_id = ae.id
        INNER JOIN accounting_plans ap ON aed.accounting_plan_id = ap.id
        INNER JOIN accounting_types at ON ap.accounting_type_id = at.id
        WHERE v.enterprise_id = 1
          AND vd.service_invoice_id = 2
          AND v.date >= '2025-01-01'
          AND v.date <= '2025-01-31'
          AND v.status = 1
          AND pm.financing = 1
          AND ae.fromable_type = 'App\\\\Models\\\\Voucher'
        ORDER BY ae.date, ae.id, at.type, aed.debit DESC, aed.credit DESC
        """

        cursor.execute(query)
        detalles = cursor.fetchall()

        if detalles:
            print(f"\nTotal detalles encontrados: {len(detalles)}")

            # Agrupar por asiento
            asientos = {}
            for d in detalles:
                aid = d["asiento_id"]
                if aid not in asientos:
                    asientos[aid] = {
                        "fecha": d["fecha"],
                        "numero_asiento": d["numero_asiento"],
                        "concept": d["concept"],
                        "total_asiento": d["total_asiento"],
                        "voucher_id": d["voucher_id"],
                        "voucher_number": d["voucher_number"],
                        "monto_voucher": d["monto_voucher"],
                        "detalles": [],
                    }
                asientos[aid]["detalles"].append(d)

            print(f"Total asientos unicos: {len(asientos)}")

            # Mostrar primeros 10 asientos con sus detalles
            print("\n" + "=" * 80)
            print("PRIMEROS 10 ASIENTOS CON DETALLES")
            print("=" * 80)

            for i, (aid, adata) in enumerate(list(asientos.items())[:10]):
                print(f"\n--- Asiento {aid} ---")
                print(f"Fecha: {adata['fecha']}")
                print(f"Concepto: {adata['concept']}")
                print(f"Voucher: {adata['voucher_number']} (ID: {adata['voucher_id']})")
                print(f"Monto Voucher: {format_number(adata['monto_voucher'])}")
                print(f"Total Asiento: {format_number(adata['total_asiento'])}")
                print("\nDetalles:")
                print("Código\t| Cuenta\t\t\t\t| Débito\t| Crédito")
                print("-" * 80)
                total_debito = 0
                total_credito = 0
                for det in adata["detalles"]:
                    cuenta = (det["cuenta"] or "")[:35]
                    codigo = det["codigo_cuenta"] or ""
                    print(
                        f"{codigo}\t| {cuenta:<35} | {format_number(det['debit'])}\t| {format_number(det['credit'])}"
                    )
                    total_debito += det["debit"] or 0
                    total_credito += det["credit"] or 0
                print("-" * 80)
                print(
                    f"TOTAL:\t| \t\t\t\t| {format_number(total_debito)}\t| {format_number(total_credito)}"
                )

            # Resumen por tipo de cuenta
            print("\n" + "=" * 80)
            print("RESUMEN POR TIPO DE CUENTA")
            print("=" * 80)

            from collections import defaultdict

            resumen_cuentas = defaultdict(
                lambda: {"debito": 0, "credito": 0, "cantidad": 0}
            )

            for d in detalles:
                codigo = d["codigo_cuenta"] or ""
                cuenta = d["cuenta"] or ""
                clave = f"{codigo} - {cuenta}"
                resumen_cuentas[clave]["debito"] += d["debit"] or 0
                resumen_cuentas[clave]["credito"] += d["credit"] or 0
                resumen_cuentas[clave]["cantidad"] += 1

            print("\nCódigo\t| Cuenta\t\t\t\t| Cantidad\t| Débito\t\t| Crédito")
            print("-" * 100)

            total_debito = 0
            total_credito = 0

            for clave, datos in sorted(
                resumen_cuentas.items(),
                key=lambda x: x[1]["debito"] + x[1]["credito"],
                reverse=True,
            ):
                partes = clave.split(" - ")
                codigo = partes[0] if partes else ""
                cuenta = partes[1][:40] if len(partes) > 1 else ""
                print(
                    f"{codigo}\t| {cuenta:<40} | {datos['cantidad']}\t\t| {format_number(datos['debito'])}\t| {format_number(datos['credito'])}"
                )
                total_debito += datos["debito"]
                total_credito += datos["credito"]

            print("-" * 100)
            print(
                f"TOTAL:\t| \t\t\t\t| {len(detalles)}\t\t| {format_number(total_debito)}\t| {format_number(total_credito)}"
            )

            # Resumen por categoría (CAJA, IVA, INGRESOS)
            print("\n" + "=" * 80)
            print("RESUMEN POR CATEGORIA")
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

            print("\nCategoria\t| Cantidad\t| Débito\t\t| Crédito")
            print("-" * 60)
            for cat, datos in categorias.items():
                print(
                    f"{cat:<10}\t| {datos['cantidad']}\t\t| {format_number(datos['debito'])}\t| {format_number(datos['credito'])}"
                )

            # Comparacion final
            print("\n" + "=" * 80)
            print("COMPARACION FINAL")
            print("=" * 80)

            total_vouchers = sum(a["monto_voucher"] for a in asientos.values())
            total_asientos = sum(a["total_asiento"] for a in asientos.values())
            total_debito_detalle = sum(d["debit"] or 0 for d in detalles)
            total_credito_detalle = sum(d["credit"] or 0 for d in detalles)

            print(f"\nTotal Vouchers (87 TAPO):     {format_number(total_vouchers)}")
            print(f"Total Asientos:               {format_number(total_asientos)}")
            print(
                f"Suma Débitos Detalles:        {format_number(total_debito_detalle)}"
            )
            print(
                f"Suma Créditos Detalles:       {format_number(total_credito_detalle)}"
            )

            if abs(total_vouchers - total_credito_detalle) < 1000:
                print(
                    "\n✓ COINCIDENCIA: Los vouchers coinciden con el total de créditos"
                )
            else:
                print(
                    f"\n✗ DIFERENCIA: {format_number(abs(total_vouchers - total_credito_detalle))}"
                )

        else:
            print("No se encontraron detalles de asientos")

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
