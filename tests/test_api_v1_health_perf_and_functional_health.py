import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import inspect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ["DATABASE_URL"] = "sqlite:///./data/test_health_perf_and_functional_health.db"
os.environ["DB_BOOTSTRAP_ON_START"] = "false"
os.environ["DB_DEMO_PROBE_ON_START"] = "false"
os.environ.setdefault("JWT_SECRET_KEY", "test_secret_key")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test_refresh_secret")

from app.main import app  # noqa: E402
from app.core.rate_limit import rate_limiter  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.brokers import AuthSession, AuthUser, AuthUserState  # noqa: E402

TEST_ADMIN_USER = "perf_admin"
TEST_ADMIN_PASSWORD = "perf_admin_password"


def ensure_analytics_source_freshness_table():
    with engine.begin() as conn:
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS analytics_source_freshness (
                source_table VARCHAR(64) PRIMARY KEY,
                max_updated_at DATETIME NULL,
                updated_at DATETIME NOT NULL,
                last_job_id VARCHAR(64) NULL
            )
            """
        )
        conn.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_analytics_source_freshness_updated_at "
            "ON analytics_source_freshness (updated_at)"
        )
        conn.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_analytics_source_freshness_last_job_id "
            "ON analytics_source_freshness (last_job_id)"
        )


class ApiV1HealthPerfAndFunctionalHealthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        def ensure_table(model):
            if not inspect(engine).has_table(model.__tablename__):
                model.__table__.create(bind=engine, checkfirst=True)

        ensure_table(AuthUser)
        ensure_table(AuthUserState)
        ensure_table(AuthSession)
        ensure_analytics_source_freshness_table()
        cls.client = TestClient(app)
        db = SessionLocal()
        try:
            db.query(AuthUserState).delete()
            row = db.query(AuthUser).filter(AuthUser.username == TEST_ADMIN_USER).first()
            if row is None:
                row = AuthUser(
                    username=TEST_ADMIN_USER,
                    password_hash=hash_password(TEST_ADMIN_PASSWORD),
                    role="admin",
                    is_active=True,
                )
                db.add(row)
            else:
                row.password_hash = hash_password(TEST_ADMIN_PASSWORD)
                row.role = "admin"
                row.is_active = True
            db.commit()
        finally:
            db.close()

    def _auth_headers(self) -> dict[str, str]:
        rate_limiter._events.clear()
        login = self.client.post(
            "/api/v1/auth/login",
            json={"username": TEST_ADMIN_USER, "password": TEST_ADMIN_PASSWORD},
        )
        self.assertEqual(login.status_code, 200, login.json())
        token = login.json().get("access_token")
        self.assertTrue(token)
        return {"Authorization": f"Bearer {token}"}

    def _assert_meta_min(self, payload: dict):
        meta = dict(payload.get("meta") or {})
        self.assertIn("source_table", meta)
        self.assertIn("data_freshness_at", meta)
        self.assertIn("cache_hit", meta)
        self.assertIn("pipeline_version", meta)

    def test_health_perf_exposes_sync_summary_and_freshness(self):
        headers = self._auth_headers()
        fake_perf = {
            "generated_at": "2026-03-19T12:00:00Z",
            "totals": {"jobs": 2, "completed": 1, "failed": 1, "avg_duration_sec": 90.0, "p95_duration_sec": 120.0},
            "by_domain": {"cartera": {"jobs": 1, "completed": 1, "failed": 0, "avg_duration_sec": 120.0}},
            "by_step": {"extract": {"runs": 2, "completed": 2, "failed": 0, "avg_duration_sec": 35.0}},
            "last_completed_by_domain": {"cartera": {"job_id": "job-1", "finished_at": "2026-03-19T11:54:00Z"}},
            "top_slowest_jobs": [{"job_id": "job-1", "domain": "cartera", "duration_sec": 120.0}],
        }
        fake_freshness = {
            "generated_at": "2026-03-19T12:00:00Z",
            "rows": [{"source_table": "cartera_corte_agg", "max_updated_at": "2026-03-19T11:58:00"}],
        }
        with (
            patch("app.api.v1.endpoints.health.SyncService.perf_summary", return_value=fake_perf),
            patch("app.api.v1.endpoints.health.SyncService.source_freshness", return_value=fake_freshness),
        ):
            response = self.client.get("/api/v1/health/perf", headers=headers)
        self.assertEqual(response.status_code, 200, response.json())
        body = response.json()
        self.assertIn("request_latency", body)
        self.assertIn("cache_metrics", body)
        self.assertEqual(body["sync_perf_summary"]["totals"]["jobs"], 2)
        self.assertIn("by_step", body["sync_perf_summary"])
        self.assertEqual(body["analytics_freshness"][0]["source_table"], "cartera_corte_agg")

    def test_v2_functional_health_requires_non_empty_options_and_meta(self):
        headers = self._auth_headers()
        portfolio_options = {
            "options": {
                "uns": ["ODONTOLOGIA TTO", "ODONTOLOGIA"],
                "gestion_months": ["03/2026"],
                "close_months": ["02/2026"],
            },
            "meta": {},
        }
        rendimiento_summary = {
            "kpis": {
                "monto_a_cobrar_total": 1000.0,
                "cobrado_total": 500.0,
                "rendimiento_monto_pct": 50.0,
                "contratos_por_cobrar": 10,
                "contratos_con_cobro": 5,
                "rendimiento_cantidad_pct": 50.0,
            },
            "rows": [],
            "meta": {},
        }
        with (
            patch("app.services.analytics_service.AnalyticsService.fetch_portfolio_corte_options_v2", return_value=portfolio_options),
            patch("app.services.analytics_service.AnalyticsService.fetch_rendimiento_summary_v2", return_value=rendimiento_summary),
        ):
            options_response = self.client.post("/api/v1/analytics/portfolio-corte-v2/options", json={}, headers=headers)
            summary_response = self.client.post("/api/v1/analytics/rendimiento-v2/summary", json={}, headers=headers)

        self.assertEqual(options_response.status_code, 200, options_response.json())
        options_body = options_response.json()
        self._assert_meta_min(options_body)
        self.assertTrue(options_body["options"]["uns"])
        self.assertTrue(options_body["options"]["gestion_months"])

        self.assertEqual(summary_response.status_code, 200, summary_response.json())
        summary_body = summary_response.json()
        self._assert_meta_min(summary_body)
        kpis = summary_body["kpis"]
        self.assertEqual(kpis["monto_a_cobrar_total"], 1000.0)
        self.assertEqual(kpis["cobrado_total"], 500.0)
        self.assertEqual(kpis["rendimiento_monto_pct"], 50.0)
        self.assertEqual(kpis["rendimiento_cantidad_pct"], 50.0)


if __name__ == "__main__":
    unittest.main()
