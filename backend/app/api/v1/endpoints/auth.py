from fastapi import APIRouter, HTTPException, status

from app.core.security import authenticate_user, create_access_token
from app.schemas.brokers import LoginIn, TokenOut

router = APIRouter()


@router.post('/login', response_model=TokenOut)
def login(payload: LoginIn):
    user = authenticate_user(payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error_code': 'UNAUTHORIZED', 'message': 'Credenciales inválidas', 'details': None},
        )

    token = create_access_token(
        {'sub': user['username'], 'role': user['role'], 'permissions': user['permissions']}
    )
    return TokenOut(access_token=token, role=user['role'], permissions=user['permissions'])
