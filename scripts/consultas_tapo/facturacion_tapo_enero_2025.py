#!/usr/bin/env python3
"""
Script para ejecutar consulta de facturacion TAPO - Enero 2025
Facturacion de tratamientos odontologicos financiados por TAPO en IDEM.

Filtros:
    - enterprise_id = 1 (Odontologia)
    - service_invoice_id = 2 (Tratamiento Odontologico)
    - Fecha: Enero 2025 (01/01/2025 - 31/01/2025)
    - status = 1 (Activo)
    - Via de pago: FINANCIACIÓN DE PRESUPUESTO (financing = 1)
    - Subtotal con IVA (voucher_details.amount)

Resultado esperado: ~738,477,150
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
    print("FACTURACION TAPO - ENERO 2025")
    print("Odontologia - Tratamiento Odontologico - FINANCIACION DE PRESUPUESTO")
    print("=" * 80)

    # Consulta SQL principal - CORREGIDA con filtro correcto
    query_principal = """
    SELECT
        'ENERO_2025_ODONTOLOGIA_TAPO' AS periodo,
        COUNT(DISTINCT v.id) AS cantidad_facturas,
        COUNT(DISTINCT vd.id) AS cantidad_detalles,
        SUM(vd.amount) AS subtotal_con_iva,
        SUM(vd.excenta) AS excenta,
        SUM(vd.iva5) AS iva5,
        SUM(vd.iva10) AS iva10
    FROM vouchers v
    INNER JOIN voucher_details vd ON v.id = vd.voucher_id
    INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
    INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
    WHERE
        -- Filtro 1: Empresa Odontologia
        v.enterprise_id = 1
        -- Filtro 2: Servicio Tratamiento Odontologico
        AND vd.service_invoice_id = 2
        -- Filtro 3: Rango de fechas Enero 2025
        AND v.date >= '2025-01-01'
        AND v.date <= '2025-01-31'
        -- Filtro 4: Estado activo
        AND v.status = 1
        -- Filtro 5: Via de pago FINANCIACION DE PRESUPUESTO (financing = 1)
        AND pm.financing = 1;
    """

    # Consulta de verificacion de metodos de pago
    query_metodos = """
    SELECT
        pm.id,
        pm.name,
        pm.financing,
        COUNT(DISTINCT v.id) AS cantidad_vouchers,
        SUM(v.amount) AS monto_total
    FROM payment_methods pm
    INNER JOIN voucher_payments vp ON pm.id = vp.payment_method_id
    INNER JOIN vouchers v ON vp.voucher_id = v.id
    WHERE pm.financing = 1
      AND YEAR(v.date) = 2025
      AND MONTH(v.date) = 1
      AND v.status = 1
    GROUP BY pm.id, pm.name, pm.financing
    ORDER BY monto_total DESC;
    """

    # Consulta de verificacion de service_invoice_id
    query_servicio = """
    SELECT
        si.id,
        si.name,
        COUNT(DISTINCT v.id) AS cantidad_vouchers,
        SUM(vd.amount) AS monto_total
    FROM service_invoices si
    LEFT JOIN voucher_details vd ON si.id = vd.service_invoice_id
    LEFT JOIN vouchers v ON vd.voucher_id = v.id
    WHERE si.id = 2
      AND YEAR(v.date) = 2025
      AND MONTH(v.date) = 1
      AND v.status = 1
    GROUP BY si.id, si.name;
    """

    # Consulta combinada: Tratamiento Odontologico + Financiamiento
    query_combinada = """
    SELECT
        'COMBINADO' AS tipo,
        COUNT(DISTINCT v.id) AS cantidad_facturas,
        SUM(vd.amount) AS subtotal_con_iva
    FROM vouchers v
    INNER JOIN voucher_details vd ON v.id = vd.voucher_id
    INNER JOIN voucher_payments vp ON v.id = vp.voucher_id
    INNER JOIN payment_methods pm ON vp.payment_method_id = pm.id
    WHERE v.enterprise_id = 1
      AND vd.service_invoice_id = 2
      AND v.date >= '2025-01-01'
      AND v.date <= '2025-01-31'
      AND v.status = 1
      AND pm.financing = 1;
    """

    # Consulta sin filtro de financiamiento (para comparar)
    query_sin_financiamiento = """
    SELECT
        'SIN_FINANCIAMIENTO' AS tipo,
        COUNT(DISTINCT v.id) AS cantidad_facturas,
        SUM(vd.amount) AS subtotal_con_iva
    FROM vouchers v
    INNER JOIN voucher_details vd ON v.id = vd.voucher_id
    WHERE v.enterprise_id = 1
      AND vd.service_invoice_id = 2
      AND v.date >= '2025-01-01'
      AND v.date <= '2025-01-31'
      AND v.status = 1;
    """

    try:
        connection = get_mysql_connection()

        # Ejecutar consulta principal
        print("\n" + "-" * 80)
        print("CONSULTA PRINCIPAL: Facturacion TAPO Enero 2025")
        print("(Filtro: enterprise_id=1, service_invoice_id=2, financing=1)")
        print("-" * 80)

        cursor = connection.cursor()
        cursor.execute(query_principal)
        result = cursor.fetchone()

        if result:
            print(f"\nRESULTADO:")
            print(f"  Periodo: {result['periodo']}")
            print(
                f"  Cantidad de facturas: {format_number(result['cantidad_facturas'])}"
            )
            print(
                f"  Cantidad de detalles: {format_number(result['cantidad_detalles'])}"
            )
            print(f"  SUBTOTAL CON IVA: {format_number(result['subtotal_con_iva'])}")
            print(f"  Excenta: {format_number(result['excenta'])}")
            print(f"  IVA 5%: {format_number(result['iva5'])}")
            print(f"  IVA 10%: {format_number(result['iva10'])}")

            # Mostrar resultado esperado vs obtenido
            subtotal = result["subtotal_con_iva"] or 0
            esperado = 738477150
            diferencia = subtotal - esperado
            porcentaje = (subtotal / esperado * 100) if esperado > 0 else 0

            print(f"\n  RESULTADO ESPERADO: {format_number(esperado)}")
            print(f"  RESULTADO OBTENIDO: {format_number(subtotal)}")
            print(f"  DIFERENCIA: {format_number(diferencia)} ({porcentaje:.2f}%)")

            if abs(diferencia) < 1000:
                print(f"\n  COINCIDE con el valor esperado!")
            else:
                print(f"\n  NO COINCIDE - Revisar filtros")
        else:
            print("No se encontraron resultados.")

        # Ejecutar consulta combinada
        print("\n" + "-" * 80)
        print("CONSULTA COMBINADA: Tratamiento Odontologico + Financiamiento")
        print("-" * 80)

        cursor.execute(query_combinada)
        result_comb = cursor.fetchone()

        if result_comb:
            print(f"\nRESULTADO COMBINADO:")
            print(
                f"  Cantidad de facturas: {format_number(result_comb['cantidad_facturas'])}"
            )
            print(
                f"  Subtotal con IVA: {format_number(result_comb['subtotal_con_iva'])}"
            )

        # Ejecutar consulta sin financiamiento
        print("\n" + "-" * 80)
        print("CONSULTA SIN FILTRO DE FINANCIAMIENTO (para comparar)")
        print("-" * 80)

        cursor.execute(query_sin_financiamiento)
        result_sin = cursor.fetchone()

        if result_sin:
            print(f"\nRESULTADO SIN FILTRO DE FINANCIAMIENTO:")
            print(
                f"  Cantidad de facturas: {format_number(result_sin['cantidad_facturas'])}"
            )
            print(
                f"  Subtotal con IVA: {format_number(result_sin['subtotal_con_iva'])}"
            )

        # Ejecutar consulta de verificacion de metodos de pago
        print("\n" + "-" * 80)
        print("VERIFICACION: Metodos de pago con FINANCIACION (financing = 1)")
        print("-" * 80)

        cursor.execute(query_metodos)
        metodos = cursor.fetchall()

        if metodos:
            total_vouchers = 0
            total_monto = 0
            print(f"\nTotal de metodos de financiamiento: {len(metodos)}")
            print("\nID\t| Nombre\t\t\t\t| Vouchers\t| Monto")
            print("-" * 80)
            for m in metodos:
                name = m["name"][:40] if m["name"] else ""
                print(
                    f"{m['id']}\t| {name:<40} | {format_number(m['cantidad_vouchers'])}\t| {format_number(m['monto_total'])}"
                )
                total_vouchers += m["cantidad_vouchers"] or 0
                total_monto += m["monto_total"] or 0
            print("-" * 80)
            print(
                f"TOTAL:\t| {len(metodos)} metodos\t\t\t| {format_number(total_vouchers)}\t| {format_number(total_monto)}"
            )
        else:
            print("  No se encontraron metodos de pago con financiamiento")

        # Ejecutar consulta de verificacion de service_invoice_id
        print("\n" + "-" * 80)
        print("VERIFICACION: Service Invoice ID = 2 (Tratamiento Odontologico)")
        print("-" * 80)

        cursor.execute(query_servicio)
        servicio = cursor.fetchone()

        if servicio:
            print(f"  ID: {servicio['id']}, Nombre: {servicio['name']}")
            print(
                f"  Vouchers: {format_number(servicio['cantidad_vouchers'])}, Monto: {format_number(servicio['monto_total'])}"
            )
        else:
            print("  No se encontro el service_invoice_id = 2")

        cursor.close()
        connection.close()

        print("\n" + "=" * 80)
        print("CONSULTA FINALIZADA")
        print("=" * 80)

    except Exception as e:
        print(f"\nError al ejecutar la consulta: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
