import threading
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.core.prod_check import validate_production_config
from app.core.analytics_cache import set as cache_set
from app.db.bootstrap import bootstrap_database_with_demo_probe, ensure_runtime_schema, ensure_sync_schema_compatibility
from app.db.session import SessionLocal
from app.schemas.analytics import AnalyticsFilters, CobranzasCohorteFirstPaintIn, CobranzasCohorteIn, PortfolioSummaryIn
from app.services.analytics_service import AnalyticsService

if settings.app_env != 'prod' and not settings.db_bootstrap_on_start:
    ensure_runtime_schema()
    ensure_sync_schema_compatibility()

app = FastAPI(title=settings.app_name, version='1.0.0')

_dev_origins = [
    'http://localhost:3000', 'http://localhost:8080', 'http://localhost:5173',
    'http://127.0.0.1:3000', 'http://127.0.0.1:8080', 'http://127.0.0.1:5173',
]
if settings.cors_origins and settings.cors_origins.strip() != '*':
    origins = [o.strip() for o in settings.cors_origins.split(',') if o.strip()]
    # En dev, asegurar que orígenes de desarrollo locales estén permitidos
    if settings.app_env != 'prod':
        for o in _dev_origins:
            if o not in origins:
                origins.append(o)
else:
    origins = _dev_origins.copy()


def _cors_error_headers(request: Request) -> dict[str, str]:
    origin = request.headers.get('origin', '').strip()
    if not origin:
        return {}
    allowed = origin in origins
    if not allowed and '*' in origins:
        allowed = True
    if not allowed:
        return {}
    return {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'vary': 'Origin',
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


from app.core.logging_config import log_request, structured_log
from app.core.request_metrics import observe


@app.middleware('http')
async def trace_and_logging(request: Request, call_next):
    trace_id = request.headers.get('x-trace-id') or str(uuid.uuid4())
    request.state.trace_id = trace_id
    start = time.time()
    try:
        response = await call_next(request)
        latency = round((time.time() - start) * 1000, 2)
        observe(request.url.path, latency)
        log_request(request.url.path, request.method, trace_id, latency, response.status_code)
        response.headers['x-trace-id'] = trace_id
        response.headers['x-latency-ms'] = str(latency)
        return response
    except Exception as exc:
        latency = round((time.time() - start) * 1000, 2)
        structured_log(
            'error', 'request_failed',
            trace_id=trace_id, duration_ms=latency,
            endpoint=f'{request.method} {request.url.path}',
            error=str(exc),
        )
        # No exponer detalles de la excepción en la respuesta (AGENTS.md: logs/errores sin secretos)
        details = None if settings.app_env == 'prod' else str(exc)
        body = {'error_code': 'INTERNAL_ERROR', 'message': 'Error interno', 'details': details, 'trace_id': trace_id}
        headers = {'x-trace-id': trace_id, 'x-latency-ms': str(latency)}
        headers.update(_cors_error_headers(request))
        return JSONResponse(status_code=500, content=body, headers=headers)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    trace_id = getattr(request.state, 'trace_id', None) or request.headers.get('x-trace-id') or str(uuid.uuid4())
    if isinstance(exc.detail, dict):
        body = {
            'error_code': str(exc.detail.get('error_code') or 'HTTP_ERROR'),
            'message': str(exc.detail.get('message') or 'HTTP Error'),
            'details': exc.detail.get('details'),
            'trace_id': trace_id,
        }
    else:
        body = {'error_code': 'HTTP_ERROR', 'message': str(exc.detail), 'details': None, 'trace_id': trace_id}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    trace_id = getattr(request.state, 'trace_id', None) or request.headers.get('x-trace-id') or str(uuid.uuid4())
    body = {
        'error_code': 'INVALID_PAYLOAD',
        'message': 'Payload invalido',
        'details': {'errors': exc.errors()},
        'trace_id': trace_id,
    }
    return JSONResponse(status_code=422, content=body)


app.include_router(v1_router)


def _prewarm_analytics_cache_on_startup() -> None:
    db = SessionLocal()
    try:
        base = AnalyticsFilters()
        portfolio_options = AnalyticsService.fetch_portfolio_corte_options_v2(db, base)
        cache_set('portfolio-corte-v2/options', base, portfolio_options, ttl_seconds=600)
        portfolio_summary_filters = PortfolioSummaryIn(include_rows=False)
        portfolio_summary = AnalyticsService.fetch_portfolio_corte_summary_v2(db, portfolio_summary_filters)
        cache_set('portfolio-corte-v2/summary', portfolio_summary_filters, portfolio_summary, ttl_seconds=180)
        portfolio_fp = AnalyticsService.fetch_portfolio_corte_first_paint_v2(db, portfolio_summary_filters)
        cache_set('portfolio-corte-v2/first-paint', portfolio_summary_filters, portfolio_fp, ttl_seconds=180)

        cohorte_filters = CobranzasCohorteIn()
        cohorte_options = AnalyticsService.fetch_cobranzas_cohorte_options_v1(db, cohorte_filters)
        cache_set('cobranzas-cohorte-v2/options', cohorte_filters, cohorte_options, ttl_seconds=1800)
        cohorte_fp_filters = CobranzasCohorteFirstPaintIn()
        cohorte_fp = AnalyticsService.fetch_cobranzas_cohorte_first_paint_v2(db, cohorte_fp_filters)
        cache_set('cobranzas-cohorte-v2/first-paint', cohorte_fp_filters, cohorte_fp, ttl_seconds=300)

        rendimiento_options = AnalyticsService.fetch_rendimiento_options_v2(db, base)
        cache_set('rendimiento-v2/options', base, rendimiento_options, ttl_seconds=120)
        rendimiento_summary = AnalyticsService.fetch_rendimiento_summary_v2(db, base)
        cache_set('rendimiento-v2/summary', base, rendimiento_summary, ttl_seconds=300)
        rendimiento_fp = AnalyticsService.fetch_rendimiento_first_paint_v2(db, base)
        cache_set('rendimiento-v2/first-paint', base, rendimiento_fp, ttl_seconds=180)

        anuales_options = AnalyticsService.fetch_anuales_options_v2(db, base)
        cache_set('anuales-v2/options', base, anuales_options, ttl_seconds=120)
        anuales_summary = AnalyticsService.fetch_anuales_summary_v2(db, base)
        cache_set('anuales-v2/summary', base, anuales_summary, ttl_seconds=300)
        anuales_fp = AnalyticsService.fetch_anuales_first_paint_v2(db, base)
        cache_set('anuales-v2/first-paint', base, anuales_fp, ttl_seconds=180)
    except Exception as exc:
        # Best effort: startup must continue even if prewarm fails.
        structured_log(
            'warning',
            'prewarm_analytics_cache_failed',
            error_type=exc.__class__.__name__,
        )
    finally:
        db.close()


def _schedule_prewarm_analytics_cache_on_startup() -> None:
    """Ejecuta prewarm en background para no bloquear readiness del proceso (OPT-2026-03-25-005)."""
    if settings.analytics_prewarm_defer_startup:

        def _run() -> None:
            _prewarm_analytics_cache_on_startup()

        threading.Thread(target=_run, name='analytics-cache-prewarm', daemon=True).start()
        structured_log('info', 'prewarm_analytics_cache_deferred')
        return
    _prewarm_analytics_cache_on_startup()


@app.on_event('startup')
def _bootstrap_db_on_startup() -> None:
    validate_production_config()
    if settings.db_bootstrap_on_start:
        bootstrap_database_with_demo_probe()
    _schedule_prewarm_analytics_cache_on_startup()
