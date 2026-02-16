"""
In-memory cache for analytics responses keyed by filter signature.
TTL in seconds; one entry per (endpoint, signature) to avoid repeated heavy work.
"""
from __future__ import annotations

import hashlib
import json
import time
from typing import Any

# (key -> (payload, expiry_ts))
_cache: dict[str, tuple[Any, float]] = {}
_DEFAULT_TTL_SECONDS = 60


def _signature(filters: Any) -> str:
    if hasattr(filters, 'model_dump'):
        data = filters.model_dump()
    elif isinstance(filters, dict):
        data = filters
    else:
        data = {}
    raw = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def get(endpoint: str, filters: Any) -> Any | None:
    key = f"{endpoint}:{_signature(filters)}"
    entry = _cache.get(key)
    if not entry:
        return None
    payload, expiry = entry
    if time.time() > expiry:
        del _cache[key]
        return None
    return payload


def set(endpoint: str, filters: Any, payload: Any, ttl_seconds: int = _DEFAULT_TTL_SECONDS) -> None:
    key = f"{endpoint}:{_signature(filters)}"
    _cache[key] = (payload, time.time() + ttl_seconds)
