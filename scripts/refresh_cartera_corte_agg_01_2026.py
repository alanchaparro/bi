#!/usr/bin/env python3
"""
Refresh manual de cartera_corte_agg para 01/2026.
Ejecutar desde el contenedor sync-worker-lan:
  cd /app && python scripts/refresh_cartera_corte_agg_01_2026.py
"""
import sys, os
sys.path.insert(0, "/app/backend")
os.environ.setdefault("ENVIRONMENT", "production")

from app.db.session import SessionLocal
from app.services.sync_refresh import refresh_cartera_corte_agg
from app.services.analytics_service import month_serial
from app.services.sync_service import _build_cartera_categoria_expr, _build_cartera_contract_year_expr

def main():
    db = SessionLocal()
    try:
        print("Refreshing cartera_corte_agg for 01/2026...")
        deleted, inserted = refresh_cartera_corte_agg(
            db,
            affected_months={"01/2026"},
            month_serial=month_serial,
            categoria_expr=_build_cartera_categoria_expr(db),
            contract_year_expr=_build_cartera_contract_year_expr(),
        )
        print(f"Done. Deleted: {deleted}, Inserted: {inserted}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
