#!/usr/bin/env python3
"""
Paridad de cobertura mensual EERR: MySQL (origen) vs Postgres eerr_fact (proyecto).

Compara, por bloque ventas/costos/gastos, el conjunto de meses (MM/YYYY) con al menos
un movimiento en MySQL (misma semántica que verify_eerr_months_mysql.py) contra los
gestion_month distintos presentes en public.eerr_fact.

Uso (raíz del repo, credenciales vía .env o variables de entorno):
  python scripts/verify_eerr_postgres_mysql_parity.py
  python scripts/verify_eerr_postgres_mysql_parity.py --year-from 2020 --year-to 2026

Requiere: mysql-connector-python, psycopg2-binary, python-dotenv (requirements/runtime.txt).
No escribe secretos en disco.
"""
from __future__ import annotations

import argparse
import os
import sys
from urllib.parse import urlparse, unquote

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
os.chdir(_PROJECT_ROOT)

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

BLOCK_TYPE: tuple[tuple[str, int], ...] = (
    ("ventas", 1),
    ("costos", 2),
    ("gastos", 3),
)

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
"""


def _mysql_config() -> dict:
    return {
        "host": os.getenv("MYSQL_HOST", "localhost").strip(),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root").strip(),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", "epem").strip(),
        "ssl_disabled": os.getenv("MYSQL_SSL_DISABLED", "true").lower() in ("1", "true", "yes"),
        "connection_timeout": 30,
    }


def _pg_dsn() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if url:
        return url
    host = os.getenv("POSTGRES_HOST", "localhost").strip()
    port = os.getenv("POSTGRES_PORT", "5432").strip()
    user = os.getenv("POSTGRES_USER", "cobranzas_user").strip()
    pwd = os.getenv("POSTGRES_PASSWORD", "")
    db = os.getenv("POSTGRES_DB", "cobranzas_prod").strip()
    return f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{db}"


def _pg_connect_params(dsn: str) -> dict:
    """DATABASE_URL puede ser postgresql+psycopg2://...; psycopg2.connect usa postgresql://."""
    u = dsn.replace("postgresql+psycopg2://", "postgresql://", 1)
    parsed = urlparse(u)
    db = (parsed.path or "").lstrip("/") or "postgres"
    user = unquote(parsed.username or "")
    password = unquote(parsed.password or "") if parsed.password else ""
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432
    return {"host": host, "port": port, "user": user, "password": password, "dbname": db}


def mysql_months_per_block(conn, year_from: int, year_to: int) -> dict[str, set[str]]:
    import mysql.connector

    out: dict[str, set[str]] = {}
    cur = conn.cursor()
    try:
        for name, atype in BLOCK_TYPE:
            cur.execute(DISTINCT_MONTHS_SQL, (year_from, year_to, atype))
            s: set[str] = set()
            for row in cur.fetchall():
                y, m = int(row[0]), int(row[1])
                if 1 <= m <= 12:
                    s.add(f"{m:02d}/{y}")
            out[name] = s
    finally:
        cur.close()
    return out


def postgres_months_per_block(conn, year_from: int, year_to: int) -> dict[str, set[str]]:
    import psycopg2

    out: dict[str, set[str]] = {}
    cur = conn.cursor()
    try:
        for name, _ in BLOCK_TYPE:
            cur.execute(
                """
                SELECT DISTINCT gestion_month
                FROM eerr_fact
                WHERE eerr_block = %s
                  AND calendar_year >= %s
                  AND calendar_year <= %s
                ORDER BY 1
                """,
                (name, year_from, year_to),
            )
            out[name] = {str(r[0]).strip() for r in cur.fetchall() if r and r[0]}
    finally:
        cur.close()
    return out


def main() -> int:
    p = argparse.ArgumentParser(description="Paridad meses EERR MySQL vs Postgres eerr_fact")
    p.add_argument("--year-from", type=int, default=2020)
    p.add_argument("--year-to", type=int, default=2026)
    p.add_argument("--json", action="store_true")
    args = p.parse_args()
    y0, y1 = args.year_from, args.year_to
    if y0 > y1:
        print("year-from debe ser <= year-to", file=sys.stderr)
        return 2

    try:
        import mysql.connector
        import psycopg2
    except ImportError as e:
        print(f"[ERROR] Falta dependencia: {e}", file=sys.stderr)
        return 2

    mc = _mysql_config()
    if not mc["host"] or not mc["user"] or not mc["database"]:
        print("[ERROR] MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE requeridos.", file=sys.stderr)
        return 2

    dsn = _pg_dsn()
    if not dsn:
        print("[ERROR] DATABASE_URL o POSTGRES_* requeridos.", file=sys.stderr)
        return 2

    try:
        mconn = mysql.connector.connect(**mc)
    except Exception as e:
        print(f"[ERROR] MySQL: {e}", file=sys.stderr)
        return 2

    try:
        pconn = psycopg2.connect(**_pg_connect_params(dsn))
    except Exception as e:
        mconn.close()
        print(f"[ERROR] Postgres: {e}", file=sys.stderr)
        return 2

    try:
        mysql_sets = mysql_months_per_block(mconn, y0, y1)
        pg_sets = postgres_months_per_block(pconn, y0, y1)
    finally:
        mconn.close()
        pconn.close()

    if args.json:
        import json

        report = {}
        for name, _ in BLOCK_TYPE:
            ms, ps = mysql_sets[name], pg_sets[name]
            report[name] = {
                "mysql_only": sorted(ms - ps),
                "postgres_only": sorted(ps - ms),
                "intersection": len(ms & ps),
                "mysql_count": len(ms),
                "postgres_count": len(ps),
            }
        print(json.dumps({"year_from": y0, "year_to": y1, "blocks": report}, ensure_ascii=False, indent=2))
        return 0

    print(f"Paridad EERR por bloque (años calendario {y0}–{y1}, meses MM/YYYY).\n")
    all_ok = True
    for name, _ in BLOCK_TYPE:
        ms, ps = mysql_sets[name], pg_sets[name]
        only_m = ms - ps
        only_p = ps - ms
        ok = len(only_m) == 0 and len(only_p) == 0
        all_ok = all_ok and ok
        print(f"--- {name.upper()} ---")
        print(f"  MySQL meses distintos: {len(ms)}  |  Postgres eerr_fact: {len(ps)}")
        if only_m:
            print(f"  En MySQL pero NO en Postgres ({len(only_m)}): {', '.join(sorted(only_m)[:20])}")
            if len(only_m) > 20:
                print(f"    ... +{len(only_m) - 20} más")
        if only_p:
            print(f"  En Postgres pero NO en MySQL ({len(only_p)}): {', '.join(sorted(only_p)[:20])}")
            if len(only_p) > 20:
                print(f"    ... +{len(only_p) - 20} más")
        if ok:
            print("  OK: mismos meses en origen y en eerr_fact.")
        print()

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
