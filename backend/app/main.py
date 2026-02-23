import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.db.bootstrap import bootstrap_database_with_demo_probe
from app.db.base import Base
from app.db.session import engine

if settings.app_env != 'prod' and not settings.db_bootstrap_on_start:
    Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version='1.0.0')

if settings.cors_origins and settings.cors_origins.strip() != '*':
    origins = [o.strip() for o in settings.cors_origins.split(',') if o.strip()]
else:
    origins = [
        'http://localhost:8080', 'http://localhost:5173',
        'http://127.0.0.1:8080', 'http://127.0.0.1:5173',
    ]


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
        body = {'error_code': 'INTERNAL_ERROR', 'message': 'Error interno', 'details': str(exc), 'trace_id': trace_id}
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


@app.on_event('startup')
def _bootstrap_db_on_startup() -> None:
    if settings.db_bootstrap_on_start:
        bootstrap_database_with_demo_probe()
