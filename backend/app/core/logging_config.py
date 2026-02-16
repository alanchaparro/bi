"""
Structured JSON logging for API v1.
Emit one JSON object per line with trace_id, level, message, duration_ms, endpoint when available.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.core.config import settings


def _extra(trace_id: str | None = None, duration_ms: float | None = None, endpoint: str | None = None, **kwargs: Any) -> dict[str, Any]:
    out: dict[str, Any] = {k: v for k, v in kwargs.items() if v is not None}
    if trace_id is not None:
        out["trace_id"] = trace_id
    if duration_ms is not None:
        out["duration_ms"] = round(duration_ms, 2)
    if endpoint is not None:
        out["endpoint"] = endpoint
    return out


def structured_log(
    level: str,
    message: str,
    *,
    trace_id: str | None = None,
    duration_ms: float | None = None,
    endpoint: str | None = None,
    **kwargs: Any,
) -> None:
    payload = {"level": level, "message": message, **_extra(trace_id=trace_id, duration_ms=duration_ms, endpoint=endpoint, **kwargs)}
    line = json.dumps(payload, ensure_ascii=False)
    if settings.app_env == "dev":
        # En dev también imprimir legible
        logging.getLogger("app").log(
            getattr(logging, level.upper(), logging.INFO),
            "%s %s", level, message, extra={"payload": payload},
        )
    print(line, flush=True)


def log_request(request_path: str, method: str, trace_id: str, duration_ms: float, status_code: int) -> None:
    structured_log(
        "info",
        "request",
        trace_id=trace_id,
        duration_ms=duration_ms,
        endpoint=f"{method} {request_path}",
        path=request_path,
        method=method,
        status_code=status_code,
    )
