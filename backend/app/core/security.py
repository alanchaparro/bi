from datetime import datetime, timedelta, timezone
from typing import Dict, List

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.brokers import AuthUser

pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')

ROLE_PERMISSIONS: Dict[str, List[str]] = {
    'admin': ['brokers:read', 'brokers:write_config', 'analytics:read', 'analytics:export', 'system:read'],
    'analyst': ['brokers:read', 'analytics:read', 'system:read'],
    'viewer': ['brokers:read', 'analytics:read'],
}

DEMO_USERS = {
    settings.demo_admin_user: {'password': settings.demo_admin_password, 'role': 'admin'},
    settings.demo_analyst_user: {'password': settings.demo_analyst_password, 'role': 'analyst'},
}


def authenticate_user(username: str, password: str):
    user = DEMO_USERS.get(username)
    if not user or user['password'] != password:
        return None
    role = user['role']
    return {'username': username, 'role': role, 'permissions': ROLE_PERMISSIONS.get(role, [])}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def resolve_identity(username: str, db: Session | None = None):
    name = str(username or '').strip()
    if not name:
        return None

    if db is not None:
        row = db.query(AuthUser).filter(AuthUser.username == name, AuthUser.is_active == True).first()  # noqa: E712
        if row:
            role = str(row.role or 'viewer').strip().lower() or 'viewer'
            return {'username': row.username, 'role': role, 'permissions': ROLE_PERMISSIONS.get(role, [])}

    demo = DEMO_USERS.get(name)
    if demo:
        role = demo['role']
        return {'username': name, 'role': role, 'permissions': ROLE_PERMISSIONS.get(role, [])}

    return None


def authenticate_user_with_db(db: Session | None, username: str, password: str):
    name = str(username or '').strip()
    if not name:
        return None

    if db is not None:
        row = db.query(AuthUser).filter(AuthUser.username == name, AuthUser.is_active == True).first()  # noqa: E712
        if row and verify_password(password, row.password_hash):
            role = str(row.role or 'viewer').strip().lower() or 'viewer'
            return {'username': row.username, 'role': role, 'permissions': ROLE_PERMISSIONS.get(role, [])}
        if row:
            return None

    return authenticate_user(name, password)


def create_access_token(data: dict, expires_minutes: int | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes or settings.jwt_expire_minutes)
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str):
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error_code': 'UNAUTHORIZED', 'message': 'Token invalido', 'details': None},
        )


def assert_permission(payload: dict, required: str):
    perms = payload.get('permissions', [])
    if required not in perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={'error_code': 'FORBIDDEN', 'message': 'Permiso insuficiente', 'details': {'required': required}},
        )
