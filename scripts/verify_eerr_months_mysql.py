#!/usr/bin/env python3
"""
Cobertura de meses EERR en MySQL (misma semántica que sql/v2/query_eerr.sql).

Ejecuta tres consultas aisladas (solo ventas type=1, solo costos type=2, solo gastos type=3),
lista meses distintos con YEAR(ae.date) entre --year-from y --year-to (por defecto 2020–2026)
y compara con el calendario completo de ese rango.

Uso (desde la raíz del repo):
  python scripts/verify_eerr_months_mysql.py
  python scripts/verify_eerr_months_mysql.py --strict
  python scripts/verify_eerr_months_mysql.py --json
  python scripts/verify_eerr_months_mysql.py --test-logic
  python scripts/verify_eerr_months_mysql.py --docker   # contenedor Python; localhost en .env → host.docker.internal; otra IP en .env se respeta

Requiere .env con MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE (y password si aplica),
igual que scripts/verify_mysql_connectivity.py.

Exit: 0 siempre salvo --strict y algún bloque con meses faltantes (exit 1).
"""
from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys
import unittest

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
os.chdir(_PROJECT_ROOT)

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

BLOCKS: tuple[tuple[str, int], ...] = (
    ("ventas", 1),
    ("costos", 2),
    ("gastos", 3),
)


def expected_calendar_months(year_from: int, year_to: int) -> set[tuple[int, int]]:
    """Todos los pares (año, mes) con mes en 1..12 para cada año en [year_from, year_to]."""
    return {(y, m) for y in range(year_from, year_to + 1) for m in range(1, 13)}


def _get_mysql_config() -> dict:
    return {
        "host": os.getenv("MYSQL_HOST", "localhost").strip(),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root").strip(),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", "").strip(),
        "ssl_disabled": os.getenv("MYSQL_SSL_DISABLED", "true").lower() in ("1", "true", "yes"),
        "connection_timeout": 30,
    }


DISTINCT_MONTHS_SQL = """
SELECT DISTINCT YEAR(ae.date) AS y, MONTH(ae.date) AS m
FROM accounting_entry_details AS aed
INNER JOIN accounting_entries AS ae ON aed.accounting_entry_id = ae.id
INNER JOIN accounting_plans AS ap ON aed.accounting_plan_id = ap.id
INNER JOIN accounting_types AS at ON ap.accounting_type_id = at.id
INNER JOIN social_reasons AS sr ON ap.social_reason_id = sr.id
WHERE YEAR(ae.date) >= %s
  AND YEAR(ae.date) <= %s
  AND sr.id <= 3
  AND at.status = 1
  AND at.`type` = %s
ORDER BY y, m
"""


def fetch_distinct_months_for_type(
    conn,
    *,
    year_from: int,
    year_to: int,
    accounting_type: int,
) -> set[tuple[int, int]]:
    import mysql.connector

    cur = conn.cursor()
    try:
        cur.execute(DISTINCT_MONTHS_SQL, (year_from, year_to, accounting_type))
        rows = cur.fetchall()
    finally:
        cur.close()
    out: set[tuple[int, int]] = set()
    for row in rows:
        if row is None or len(row) < 2:
            continue
        y, m = int(row[0]), int(row[1])
        if 1 <= m <= 12:
            out.add((y, m))
    return out


def _format_months_sorted(months: set[tuple[int, int]]) -> list[str]:
    def key(t: tuple[int, int]) -> int:
        return t[0] * 12 + t[1]

    return [f"{m:02d}/{y}" for y, m in sorted(months, key=key)]


def run_report(
    *,
    year_from: int,
    year_to: int,
    json_output: bool,
    strict: bool,
) -> int:
    expected = expected_calendar_months(year_from, year_to)
    cfg = _get_mysql_config()
    if not cfg["host"] or not cfg["user"] or not cfg["database"]:
        msg = "MYSQL_HOST, MYSQL_USER y MYSQL_DATABASE son obligatorios (.env)."
        if json_output:
            print(json.dumps({"ok": False, "error": "CONFIG", "message": msg}, ensure_ascii=False))
        else:
            print(f"[ERROR] {msg}")
        return 2

    try:
        import mysql.connector
    except ImportError:
        msg = "Instale mysql-connector-python (requirements/runtime.txt)."
        if json_output:
            print(json.dumps({"ok": False, "error": "DEPS", "message": msg}, ensure_ascii=False))
        else:
            print(f"[ERROR] {msg}")
        return 2

    blocks_out: list[dict] = []
    any_strict_fail = False

    try:
        conn = mysql.connector.connect(**cfg)
    except Exception as e:
        msg = f"No se pudo conectar a MySQL: {e}"
        if json_output:
            print(json.dumps({"ok": False, "error": "CONNECT", "message": msg}, ensure_ascii=False))
        else:
            print(f"[ERROR] {msg}")
        return 2

    try:
        for name, atype in BLOCKS:
            present = fetch_distinct_months_for_type(
                conn, year_from=year_from, year_to=year_to, accounting_type=atype
            )
            missing = expected - present
            extra = present - expected
            ok_block = len(missing) == 0
            if strict and not ok_block:
                any_strict_fail = True
            blocks_out.append(
                {
                    "block": name,
                    "accounting_type": atype,
                    "expected_month_slots": len(expected),
                    "distinct_months_present": len(present),
                    "missing_count": len(missing),
                    "extra_outside_range_count": len(extra),
                    "missing_months": _format_months_sorted(missing),
                    "calendar_complete": ok_block,
                }
            )
    finally:
        conn.close()

    payload = {
        "ok": not any_strict_fail,
        "year_from": year_from,
        "year_to": year_to,
        "expected_slots": len(expected),
        "blocks": blocks_out,
    }

    if json_output:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(
            f"Rango calendario esperado: {year_from}–{year_to} ({len(expected)} meses por bloque).\n"
            f"Misma regla que query_eerr: sr.id<=3, at.status=1, at.type en (1|2|3).\n"
        )
        for b in blocks_out:
            print(f"--- {b['block'].upper()} (accounting_types.type={b['accounting_type']}) ---")
            print(f"  Meses distintos con movimiento: {b['distinct_months_present']}/{b['expected_month_slots']}")
            if b["missing_count"]:
                print(f"  Faltan {b['missing_count']} mes(es): {', '.join(b['missing_months'][:24])}")
                if b["missing_count"] > 24:
                    print(f"  ... y {b['missing_count'] - 24} más (ver --json)")
            else:
                print("  OK: todos los meses del rango tienen al menos un movimiento.")
            if b["extra_outside_range_count"]:
                print(f"  Nota: {b['extra_outside_range_count']} pares fuera del rango (no debería pasar con el WHERE)")
            print()

    if strict and any_strict_fail:
        if not json_output:
            print("[STRICT] Hay meses sin movimientos en al menos un bloque (exit 1).")
        return 1
    return 0


def _docker_mysql_host_override() -> list[str]:
    """
    Si MySQL en .env apunta a localhost, desde un contenedor hay que usar host.docker.internal.
    Si ya es otra IP u hostname, no sobrescribir.
    """
    raw = os.getenv("MYSQL_HOST", "").strip().lower()
    if raw in ("localhost", "127.0.0.1", ""):
        return ["-e", "MYSQL_HOST=host.docker.internal"]
    return []


def _reexec_in_docker(forward_argv: list[str]) -> int:
    """
    Ejecuta este script en python:3.11-slim-bookworm con el repo montado en /app.
    Carga .env antes de decidir el host: localhost → host.docker.internal; otras IP sin cambio.
    """
    env_file = os.path.join(_PROJECT_ROOT, ".env")
    if not os.path.isfile(env_file):
        print("[ERROR] --docker requiere un archivo .env en la raíz del repo.", file=sys.stderr)
        return 2
    if not shutil.which("docker"):
        print("[ERROR] docker no está en PATH.", file=sys.stderr)
        return 2
    try:
        from dotenv import load_dotenv

        load_dotenv(env_file, override=True)
    except ImportError:
        pass
    mount = os.path.abspath(_PROJECT_ROOT)
    inner = shlex.join(["python", "scripts/verify_eerr_months_mysql.py", *forward_argv])
    bash_cmd = f"pip install -q mysql-connector-python python-dotenv && {inner}"
    cmd = [
        "docker",
        "run",
        "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-v",
        f"{mount}:/app",
        "-w",
        "/app",
        "--env-file",
        env_file,
        *_docker_mysql_host_override(),
        "python:3.11-slim-bookworm",
        "bash",
        "-lc",
        bash_cmd,
    ]
    return subprocess.call(cmd)


def _run_logic_tests() -> None:
    class TestEerrMonthCalendar(unittest.TestCase):
        def test_2020_2026_is_84_months(self) -> None:
            self.assertEqual(len(expected_calendar_months(2020, 2026)), 84)

        def test_endpoints(self) -> None:
            s = expected_calendar_months(2020, 2026)
            self.assertIn((2020, 1), s)
            self.assertIn((2026, 12), s)
            self.assertNotIn((2019, 12), s)
            self.assertNotIn((2027, 1), s)

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(TestEerrMonthCalendar)
    r = unittest.TextTestRunner(verbosity=2).run(suite)
    if not r.wasSuccessful():
        sys.exit(1)


def main() -> None:
    p = argparse.ArgumentParser(description="Verificar cobertura mensual EERR en MySQL por bloque.")
    p.add_argument("--year-from", type=int, default=2020)
    p.add_argument("--year-to", type=int, default=2026)
    p.add_argument("--json", action="store_true", help="Salida JSON")
    p.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 si falta algún mes del rango en algún bloque",
    )
    p.add_argument(
        "--test-logic",
        action="store_true",
        help="Solo ejecuta pruebas unitarias locales (sin MySQL)",
    )
    p.add_argument(
        "--docker",
        action="store_true",
        help="Re-ejecutar dentro de contenedor Python (MySQL en host vía host.docker.internal)",
    )
    raw = sys.argv[1:]
    args = p.parse_args()
    if args.docker:
        forward = [a for a in raw if a != "--docker"]
        sys.exit(_reexec_in_docker(forward))
    if args.test_logic:
        _run_logic_tests()
        return
    if args.year_from > args.year_to:
        print("year-from debe ser <= year-to", file=sys.stderr)
        sys.exit(2)
    sys.exit(
        run_report(
            year_from=args.year_from,
            year_to=args.year_to,
            json_output=args.json,
            strict=args.strict,
        )
    )


if __name__ == "__main__":
    main()
