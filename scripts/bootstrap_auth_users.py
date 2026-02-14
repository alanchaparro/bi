import json
import os
import sys
from pathlib import Path


def parse_users(raw: str | None):
    if not raw:
        return []
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, list):
        return []
    users = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        username = str(item.get('username', '')).strip()
        password = str(item.get('password', '')).strip()
        role = str(item.get('role', 'viewer')).strip().lower() or 'viewer'
        if username and password:
            users.append({'username': username, 'password': password, 'role': role})
    return users


def main():
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / 'backend'))

    from app.core.config import settings
    from app.core.security import hash_password
    from app.db.base import Base
    from app.db.session import SessionLocal, engine
    from app.models.brokers import AuthUser

    Base.metadata.create_all(bind=engine)

    users = parse_users(os.getenv('AUTH_BOOTSTRAP_USERS'))
    if not users:
        users = [
            {'username': settings.demo_admin_user, 'password': settings.demo_admin_password, 'role': 'admin'},
            {'username': settings.demo_analyst_user, 'password': settings.demo_analyst_password, 'role': 'analyst'},
        ]

    db = SessionLocal()
    created = 0
    updated = 0
    try:
        for user in users:
            row = db.query(AuthUser).filter(AuthUser.username == user['username']).first()
            if row:
                row.password_hash = hash_password(user['password'])
                row.role = user['role']
                row.is_active = True
                updated += 1
            else:
                db.add(
                    AuthUser(
                        username=user['username'],
                        password_hash=hash_password(user['password']),
                        role=user['role'],
                        is_active=True,
                    )
                )
                created += 1
        db.commit()
    finally:
        db.close()

    print(json.dumps({'ok': True, 'created': created, 'updated': updated, 'total': len(users)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
