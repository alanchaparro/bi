#!/usr/bin/env python3
"""
Sincroniza analytics_contract_snapshot desde MySQL (query_analytics.sql).

Requisitos: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE en .env

Uso:
    docker compose run --rm api-v1 python scripts/sync_analytics_to_snapshot.py
"""
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'backend'))

from app.db.session import SessionLocal
from app.services.analytics_sync_service import sync_from_mysql


def main():
    db = SessionLocal()
    try:
        result = sync_from_mysql(db)
        if result.get('error'):
            print(f'Error: {result["error"]}')
            sys.exit(1)
        mode = result.get('mode', 'incremental')
        months = result.get('months_replaced') or []
        print(
            f'Sincronizadas {result["rows_inserted"]} filas desde MySQL. '
            f'mode={mode} months={",".join(months) if months else "-"}'
        )
    finally:
        db.close()


if __name__ == '__main__':
    main()
