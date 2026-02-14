from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_refresh import (
    assert_not_blocked,
    create_refresh_token,
    decode_refresh_token,
    register_login_failure,
    register_login_success,
    revoke_refresh_session,
    rotate_refresh_session,
    save_refresh_session,
)
from app.core.security import authenticate_user_with_db, create_access_token, resolve_identity
from app.db.session import get_db
from app.schemas.brokers import LoginIn, RefreshIn, RevokeIn, TokenOut

router = APIRouter()


@router.post('/login', response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    assert_not_blocked(db, payload.username)
    user = authenticate_user_with_db(db, payload.username, payload.password)
    if not user:
        register_login_failure(db, payload.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error_code': 'UNAUTHORIZED', 'message': 'Credenciales inválidas', 'details': None},
        )

    register_login_success(db, payload.username)
    access_token = create_access_token(
        {'sub': user['username'], 'role': user['role'], 'permissions': user['permissions']}
    )
    refresh_token = create_refresh_token(user['username'])
    save_refresh_session(db, user['username'], refresh_token)
    return TokenOut(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user['role'],
        permissions=user['permissions'],
    )


@router.post('/refresh', response_model=TokenOut)
def refresh(payload: RefreshIn, db: Session = Depends(get_db)):
    token_payload = decode_refresh_token(payload.refresh_token)
    username = str(token_payload.get('sub') or '').strip()
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error_code': 'UNAUTHORIZED', 'message': 'Refresh token inválido', 'details': None},
        )

    identity = resolve_identity(username, db)
    if not identity:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error_code': 'UNAUTHORIZED', 'message': 'Usuario inválido', 'details': None},
        )

    role = identity['role']
    permissions = identity['permissions']
    new_refresh = rotate_refresh_session(db, payload.refresh_token, username)
    new_access = create_access_token({'sub': username, 'role': role, 'permissions': permissions})
    return TokenOut(
        access_token=new_access,
        refresh_token=new_refresh,
        role=role,
        permissions=permissions,
    )


@router.post('/revoke')
def revoke(payload: RevokeIn, db: Session = Depends(get_db)):
    ok = revoke_refresh_session(db, payload.refresh_token)
    return {'ok': ok}
