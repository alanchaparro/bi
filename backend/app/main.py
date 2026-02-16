import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version='1.0.0')

origins = [o.strip() for o in settings.cors_origins.split(',')] if settings.cors_origins else ['*']
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


from app.core.logging_config import log_request, structured_log


@app.middleware('http')
async def trace_and_logging(request: Request, call_next):
    trace_id = request.headers.get('x-trace-id') or str(uuid.uuid4())
    request.state.trace_id = trace_id
    start = time.time()
    try:
        response = await call_next(request)
        latency = round((time.time() - start) * 1000, 2)
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
        return JSONResponse(status_code=500, content=body, headers={'x-trace-id': trace_id, 'x-latency-ms': str(latency)})


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
