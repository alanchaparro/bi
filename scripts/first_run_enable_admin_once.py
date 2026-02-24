import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


BOOTSTRAP_PREF_USERNAME = "__system__"
BOOTSTRAP_PREF_KEY = "first_run_enable_admin_once_v1"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="One-shot bootstrap: create/enable admin and print PostgreSQL connection data."
    )
    parser.add_argument("--force", action="store_true", help="Allow re-running after first execution.")
    parser.add_argument("--admin-user", default=None, help="Override admin username (default DEMO_ADMIN_USER).")
    parser.add_argument("--admin-password", default=None, help="Override admin password (default DEMO_ADMIN_PASSWORD).")
    return parser.parse_args()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _emit_summary(*, admin_user: str, admin_password: str, settings_obj) -> None:
    payload = {
        "ok": True,
        "admin": {
            "username": admin_user,
            "password": admin_password,
        },
        "postgres": {
            "host": settings_obj.postgres_host,
            "port": settings_obj.postgres_port,
            "database": settings_obj.postgres_db,
            "user": settings_obj.postgres_user,
            "password": settings_obj.postgres_password,
            "database_url": settings_obj.database_url,
        },
        "note": "Guarde estas credenciales en un vault seguro.",
    }
    print(json.dumps(payload, ensure_ascii=False))


def main() -> int:
    args = _parse_args()
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / "backend"))

    from app.core.config import settings
    from app.core.security import hash_password
    from app.db.base import Base
    from app.db.session import SessionLocal, engine
    from app.models.brokers import AuthUser, UserPreference

    admin_user = str(args.admin_user or settings.demo_admin_user or "").strip()
    admin_password = str(args.admin_password or settings.demo_admin_password or "").strip()
    if not admin_user or not admin_password:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "Admin user/password are required. Configure DEMO_ADMIN_USER and DEMO_ADMIN_PASSWORD.",
                },
                ensure_ascii=False,
            )
        )
        return 2

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        marker = (
            db.query(UserPreference)
            .filter(
                UserPreference.username == BOOTSTRAP_PREF_USERNAME,
                UserPreference.pref_key == BOOTSTRAP_PREF_KEY,
            )
            .first()
        )
        if marker is not None and not args.force:
            marker_data = {}
            try:
                marker_data = json.loads(marker.value_json or "{}")
            except Exception:
                marker_data = {}
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": "Bootstrap one-shot already executed. Use --force to re-run.",
                        "executed_at": marker_data.get("executed_at"),
                        "executed_admin": marker_data.get("admin_user"),
                        "self_destruct": "already_consumed",
                    },
                    ensure_ascii=False,
                )
            )
            return 3

        row = db.query(AuthUser).filter(AuthUser.username == admin_user).first()
        created = False
        if row is None:
            row = AuthUser(
                username=admin_user,
                password_hash=hash_password(admin_password),
                role="admin",
                is_active=True,
            )
            db.add(row)
            created = True
        else:
            row.password_hash = hash_password(admin_password)
            row.role = "admin"
            row.is_active = True

        marker_payload = {
            "executed_at": _now_iso(),
            "admin_user": admin_user,
            "mode": "force" if args.force else "one-shot",
        }
        if marker is None:
            marker = UserPreference(
                username=BOOTSTRAP_PREF_USERNAME,
                pref_key=BOOTSTRAP_PREF_KEY,
                value_json=json.dumps(marker_payload, ensure_ascii=False),
            )
            db.add(marker)
        else:
            marker.value_json = json.dumps(marker_payload, ensure_ascii=False)
            marker.updated_at = datetime.utcnow()

        db.commit()
        _emit_summary(admin_user=admin_user, admin_password=admin_password, settings_obj=settings)
        print(
            json.dumps(
                {
                    "ok": True,
                    "created": created,
                    "self_destruct": "consumed_after_first_run",
                },
                ensure_ascii=False,
            )
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
