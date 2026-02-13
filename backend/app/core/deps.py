from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import assert_permission, decode_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_token_payload(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error_code': 'UNAUTHORIZED', 'message': 'Falta token', 'details': None},
        )
    return decode_token(credentials.credentials)


def require_permission(permission: str):
    def _checker(payload: dict = Depends(get_token_payload)):
        assert_permission(payload, permission)
        return payload

    return _checker
