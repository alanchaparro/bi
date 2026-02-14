from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.brokers import AuthSession, AuthUserState


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def create_refresh_token(username: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.jwt_refresh_expire_minutes)
    payload = {
        'sub': username,
        'typ': 'refresh',
        'jti': secrets.token_urlsafe(24),
        'iat': int(now.timestamp()),
        'exp': exp,
    }
    return jwt.encode(payload, settings.jwt_refresh_secret_key, algorithm=settings.jwt_algorithm)


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_refresh_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error_code': 'UNAUTHORIZED', 'message': 'Refresh token inválido', 'details': None},
        )
    if payload.get('typ') != 'refresh':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error_code': 'UNAUTHORIZED', 'message': 'Tipo de token inválido', 'details': None},
        )
    return payload


def save_refresh_session(db: Session, username: str, refresh_token: str) -> None:
    row = AuthSession(
        username=username,
        refresh_token_hash=_hash_token(refresh_token),
        revoked=False,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_refresh_expire_minutes),
    )
    db.add(row)
    db.commit()


def revoke_refresh_session(db: Session, refresh_token: str) -> bool:
    h = _hash_token(refresh_token)
    row = db.query(AuthSession).filter(AuthSession.refresh_token_hash == h).first()
    if not row:
        return False
    row.revoked = True
    row.rotated_at = datetime.utcnow()
    db.commit()
    return True


def rotate_refresh_session(db: Session, old_refresh_token: str, username: str) -> str:
    old_hash = _hash_token(old_refresh_token)
    old_row = db.query(AuthSession).filter(AuthSession.refresh_token_hash == old_hash).first()
    if old_row is None or old_row.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error_code': 'UNAUTHORIZED', 'message': 'Refresh token revocado', 'details': None},
        )
    old_row.revoked = True
    old_row.rotated_at = datetime.utcnow()
    new_refresh = create_refresh_token(username)
    new_row = AuthSession(
        username=username,
        refresh_token_hash=_hash_token(new_refresh),
        revoked=False,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_refresh_expire_minutes),
    )
    db.add(new_row)
    db.commit()
    return new_refresh


def _get_user_state(db: Session, username: str) -> AuthUserState:
    row = db.query(AuthUserState).filter(AuthUserState.username == username).first()
    if row is None:
        row = AuthUserState(username=username, failed_attempts=0)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def assert_not_blocked(db: Session, username: str) -> None:
    row = _get_user_state(db, username)
    if row.blocked_until and row.blocked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                'error_code': 'AUTH_BLOCKED',
                'message': 'Usuario temporalmente bloqueado',
                'details': {'blocked_until': row.blocked_until.isoformat()},
            },
        )


def register_login_failure(db: Session, username: str) -> None:
    row = _get_user_state(db, username)
    row.failed_attempts = int(row.failed_attempts or 0) + 1
    if row.failed_attempts >= settings.auth_max_failed_attempts:
        row.blocked_until = datetime.utcnow() + timedelta(minutes=settings.auth_lock_minutes)
        row.failed_attempts = 0
    row.updated_at = datetime.utcnow()
    db.commit()


def register_login_success(db: Session, username: str) -> None:
    row = _get_user_state(db, username)
    row.failed_attempts = 0
    row.blocked_until = None
    row.updated_at = datetime.utcnow()
    db.commit()
