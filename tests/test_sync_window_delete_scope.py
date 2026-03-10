import os
import sys
import unittest
from datetime import date
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite:///./data/test_sync_window_delete_scope.db")

from app.models.brokers import CobranzasFact, SyncRecord  # noqa: E402
from app.services.sync_service import _delete_target_window, _delete_target_window_fact  # noqa: E402

engine = create_engine(TEST_DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class SyncWindowDeleteScopeTests(unittest.TestCase):
    def setUp(self):
        CobranzasFact.__table__.drop(bind=engine, checkfirst=True)
        SyncRecord.__table__.drop(bind=engine, checkfirst=True)
        SyncRecord.__table__.create(bind=engine, checkfirst=True)
        CobranzasFact.__table__.create(bind=engine, checkfirst=True)

    def _seed_sync_records(self):
        db = SessionLocal()
        try:
            db.add_all(
                [
                    SyncRecord(
                        domain="cobranzas",
                        contract_id="c-1",
                        gestion_month="01/2026",
                        supervisor="S/D",
                        un="ODONTOLOGIA",
                        via="COBRADOR",
                        tramo=1,
                        source_hash="h1",
                    ),
                    SyncRecord(
                        domain="cobranzas",
                        contract_id="c-2",
                        gestion_month="02/2026",
                        supervisor="S/D",
                        un="ODONTOLOGIA",
                        via="COBRADOR",
                        tramo=2,
                        source_hash="h2",
                    ),
                    SyncRecord(
                        domain="cobranzas",
                        contract_id="c-3",
                        gestion_month="03/2026",
                        supervisor="S/D",
                        un="ODONTOLOGIA",
                        via="COBRADOR",
                        tramo=3,
                        source_hash="h3",
                    ),
                ]
            )
            db.commit()
        finally:
            db.close()

    def _seed_cobranzas_fact(self):
        db = SessionLocal()
        try:
            db.add_all(
                [
                    CobranzasFact(
                        contract_id="c-1",
                        gestion_month="01/2026",
                        supervisor="S/D",
                        un="ODONTOLOGIA",
                        via="COBRADOR",
                        payment_date=date(2026, 1, 15),
                        payment_month="01/2026",
                        payment_year=2026,
                        payment_amount=100.0,
                        payment_via_class="COBRADOR",
                        source_row_id="1",
                        tramo=1,
                        source_hash="h1",
                    ),
                    CobranzasFact(
                        contract_id="c-2",
                        gestion_month="02/2026",
                        supervisor="S/D",
                        un="ODONTOLOGIA",
                        via="COBRADOR",
                        payment_date=date(2026, 2, 15),
                        payment_month="02/2026",
                        payment_year=2026,
                        payment_amount=200.0,
                        payment_via_class="COBRADOR",
                        source_row_id="2",
                        tramo=2,
                        source_hash="h2",
                    ),
                    CobranzasFact(
                        contract_id="c-3",
                        gestion_month="03/2026",
                        supervisor="S/D",
                        un="ODONTOLOGIA",
                        via="COBRADOR",
                        payment_date=date(2026, 3, 15),
                        payment_month="03/2026",
                        payment_year=2026,
                        payment_amount=300.0,
                        payment_via_class="COBRADOR",
                        source_row_id="3",
                        tramo=3,
                        source_hash="h3",
                    ),
                ]
            )
            db.commit()
        finally:
            db.close()

    def test_delete_target_window_full_all_respects_target_months(self):
        self._seed_sync_records()
        db = SessionLocal()
        try:
            _delete_target_window(db, "cobranzas", "full_all", None, {"03/2026"})
        finally:
            db.close()

        db = SessionLocal()
        try:
            months = {
                str(r.gestion_month)
                for r in db.query(SyncRecord).filter(SyncRecord.domain == "cobranzas").all()
            }
            self.assertEqual(months, {"01/2026", "02/2026"})
        finally:
            db.close()

    def test_delete_target_window_full_year_respects_target_months(self):
        self._seed_sync_records()
        db = SessionLocal()
        try:
            _delete_target_window(db, "cobranzas", "full_year", 2026, {"03/2026"})
        finally:
            db.close()

        db = SessionLocal()
        try:
            months = {
                str(r.gestion_month)
                for r in db.query(SyncRecord).filter(SyncRecord.domain == "cobranzas").all()
            }
            self.assertEqual(months, {"01/2026", "02/2026"})
        finally:
            db.close()

    def test_delete_target_window_fact_full_all_respects_target_months(self):
        self._seed_cobranzas_fact()
        db = SessionLocal()
        try:
            _delete_target_window_fact(db, "cobranzas", "full_all", None, None, {"03/2026"})
        finally:
            db.close()

        db = SessionLocal()
        try:
            months = {str(r.payment_month) for r in db.query(CobranzasFact).all()}
            self.assertEqual(months, {"01/2026", "02/2026"})
        finally:
            db.close()

    def test_delete_target_window_fact_full_all_without_target_months_deletes_all(self):
        self._seed_cobranzas_fact()
        db = SessionLocal()
        try:
            _delete_target_window_fact(db, "cobranzas", "full_all", None, None, set())
        finally:
            db.close()

        db = SessionLocal()
        try:
            count = db.query(CobranzasFact).count()
            self.assertEqual(count, 0)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
