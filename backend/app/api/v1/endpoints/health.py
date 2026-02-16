from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.db.session import SessionLocal

router = APIRouter()


@router.get('/health')
def health():
    """
    Health check. Returns 200 with db_ok true when DB is reachable.
    Returns 503 when DB is unreachable (dependencies down).
    """
    db_ok = False
    db = SessionLocal()
    try:
        db.execute(text('SELECT 1'))
        db_ok = True
    except Exception:
        pass
    finally:
        db.close()
    if not db_ok:
        return JSONResponse(
            status_code=503,
            content={
                'ok': False,
                'service': 'cobranzas-api-v1',
                'db_ok': False,
                'message': 'Database unreachable',
            },
        )
    return {
        'ok': True,
        'service': 'cobranzas-api-v1',
        'db_ok': True,
    }
