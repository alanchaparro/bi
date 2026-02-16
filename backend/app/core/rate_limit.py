from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


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


def build_rate_limit_dependency(prefix: str, limit: int, window_seconds: int):
    async def _dependency(request: Request):
        client_ip = request.client.host if request.client else 'unknown'
        key = f'{prefix}:{client_ip}'
        if rate_limiter.allow(key, limit, window_seconds):
            return
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                'error_code': 'RATE_LIMITED',
                'message': 'Demasiadas solicitudes',
                'details': {
                    'limit': int(limit),
                    'window_seconds': int(window_seconds),
                    'scope': prefix,
                },
            },
        )

    return _dependency
