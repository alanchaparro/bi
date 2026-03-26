from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status

from app.core.config import settings


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.time()
        cutoff = now - max(1, window_seconds)
        with self._lock:
            q = self._events[key]
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= max(1, limit):
                return False
            q.append(now)
            return True


rate_limiter = InMemoryRateLimiter()


def _resolve_rate_limit_value(value: int | Callable[[], int]) -> int:
    if callable(value):
        value = value()
    return int(value)


def _is_dev_local_login_bypass(prefix: str, request: Request) -> bool:
    if prefix != 'auth_login':
        return False

    app_env = str(settings.app_env or 'dev').strip().lower()
    if app_env != 'prod':
        return True

    if not settings.auth_login_rate_bypass_localhost:
        return False

    host_candidates = {
        str(request.headers.get('host') or '').strip().lower(),
        str(request.headers.get('origin') or '').strip().lower(),
        str(request.headers.get('referer') or '').strip().lower(),
    }
    localhost_tokens = ('localhost', '127.0.0.1', '::1')
    return any(token in candidate for candidate in host_candidates for token in localhost_tokens)


def build_rate_limit_dependency(
    prefix: str,
    limit: int | Callable[[], int],
    window_seconds: int | Callable[[], int],
):
    async def _dependency(request: Request):
        if _is_dev_local_login_bypass(prefix, request):
            return

        resolved_limit = _resolve_rate_limit_value(limit)
        resolved_window_seconds = _resolve_rate_limit_value(window_seconds)
        client_ip = request.client.host if request.client else 'unknown'
        key = f'{prefix}:{client_ip}'
        if rate_limiter.allow(key, resolved_limit, resolved_window_seconds):
            return
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                'error_code': 'RATE_LIMITED',
                'message': 'Demasiadas solicitudes',
                'details': {
                    'limit': int(resolved_limit),
                    'window_seconds': int(resolved_window_seconds),
                    'scope': prefix,
                },
            },
        )

    return _dependency
