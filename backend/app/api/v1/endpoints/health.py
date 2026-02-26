from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.deps import require_permission
from app.core.request_metrics import summary as request_metrics_summary
from app.db.session import SessionLocal

router = APIRouter()


def _check_mysql_ok() -> bool | None:
    """
    Verifica conexión a MySQL (fuente de sync/import).
    Retorna True si OK, False si falla, None si no está configurado.
    """
    host = str(settings.mysql_host or '').strip()
    user = str(settings.mysql_user or '').strip()
    database = str(settings.mysql_database or '').strip()
    if not host or not user or not database:
        return None  # no configurado
    try:
        import mysql.connector
        cfg = {
            'host': host,
            'port': int(settings.mysql_port or 3306),
            'user': user,
            'password': settings.mysql_password or '',
            'database': database,
            'ssl_disabled': bool(getattr(settings, 'mysql_ssl_disabled', True)),
            'connection_timeout': 5,
        }
        conn = mysql.connector.connect(**cfg)
        try:
            cur = conn.cursor()
            cur.execute('SELECT 1')
            cur.fetchone()
            cur.close()
        finally:
            conn.close()
        return True
    except Exception:
        return False


@router.get('/health')
def health():
    """
    Health check. Returns 200 with db_ok true when DB is reachable.
    Returns 503 when DB is unreachable (dependencies down).
    Incluye mysql_ok para reportar conectividad a MySQL (sync/import).
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
                'mysql_ok': None,
                'message': 'Database unreachable',
            },
        )
    mysql_ok = _check_mysql_ok()
    return {
        'ok': True,
        'service': 'cobranzas-api-v1',
        'db_ok': True,
        'mysql_ok': mysql_ok,  # True=OK, False=fallo, None=no configurado
    }


@router.get('/health/perf')
def health_perf(_user=Depends(require_permission('system:read'))):
    """Métricas de rendimiento y pg_stat_statements. Requiere permiso system:read (admin/analyst)."""
    db = SessionLocal()
    pg_stat_top: list[dict] = []
    try:
        # If extension is not enabled, this query will fail and we return empty block.
        rows = db.execute(
            text(
                """
                SELECT query,
                       calls,
                       total_exec_time AS total_time_ms,
                       mean_exec_time AS mean_time_ms,
                       rows
                FROM pg_stat_statements
                ORDER BY total_exec_time DESC
                LIMIT 10
                """
            )
        ).mappings().all()
        for r in rows:
            pg_stat_top.append(
                {
                    'query': str(r.get('query') or '')[:180],
                    'calls': int(r.get('calls') or 0),
                    'total_time_ms': round(float(r.get('total_time_ms') or 0.0), 2),
                    'mean_time_ms': round(float(r.get('mean_time_ms') or 0.0), 2),
                    'rows': int(r.get('rows') or 0),
                }
            )
    except Exception:
        pg_stat_top = []
    finally:
        db.close()
    return {
        'service': 'cobranzas-api-v1',
        'request_latency': request_metrics_summary(),
        'pg_stat_statements_top': pg_stat_top,
    }
