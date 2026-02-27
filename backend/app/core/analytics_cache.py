"""
In-memory cache for analytics responses keyed by filter signature.
TTL in seconds; one entry per (endpoint, signature) to avoid repeated heavy work.
"""
from __future__ import annotations

import builtins
import hashlib
import json
import time
from collections import OrderedDict, defaultdict
from threading import Lock
from typing import Any, Callable

# (key -> (payload, expiry_ts, endpoint, filters_data))
_cache: OrderedDict[str, tuple[Any, float, str, dict[str, Any]]] = OrderedDict()
_DEFAULT_TTL_SECONDS = 60
_MAX_ENTRIES = 1000
_lock = Lock()
_hits_by_endpoint: dict[str, int] = defaultdict(int)
_misses_by_endpoint: dict[str, int] = defaultdict(int)


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
    now = time.time()
    with _lock:
        entry = _cache.get(key)
        if not entry:
            _misses_by_endpoint[endpoint] += 1
            return None
        payload, expiry, _, _ = entry
        if now > expiry:
            _cache.pop(key, None)
            _misses_by_endpoint[endpoint] += 1
            return None
        _cache.move_to_end(key)
        _hits_by_endpoint[endpoint] += 1
        return payload


def set(endpoint: str, filters: Any, payload: Any, ttl_seconds: int = _DEFAULT_TTL_SECONDS) -> None:
    key = f"{endpoint}:{_signature(filters)}"
    if hasattr(filters, 'model_dump'):
        filters_data = filters.model_dump()
    elif isinstance(filters, dict):
        filters_data = filters
    else:
        filters_data = {}
    with _lock:
        _cache[key] = (payload, time.time() + ttl_seconds, endpoint, filters_data)
        _cache.move_to_end(key)
        while len(_cache) > _MAX_ENTRIES:
            _cache.popitem(last=False)


def invalidate_endpoint(endpoint: str, predicate: Callable[[dict[str, Any]], bool] | None = None) -> int:
    with _lock:
        removed = 0
        for key in list(_cache.keys()):
            entry = _cache.get(key)
            if not entry:
                continue
            _, _, cached_endpoint, filters_data = entry
            if cached_endpoint != endpoint:
                continue
            if predicate is None or predicate(filters_data or {}):
                _cache.pop(key, None)
                removed += 1
        return removed


def invalidate_prefix(prefix: str) -> int:
    target = f"{prefix}:"
    with _lock:
        keys = [k for k in list(_cache.keys()) if k.startswith(target)]
        for k in keys:
            _cache.pop(k, None)
        return len(keys)


def metrics() -> dict[str, list[dict[str, int | float | str]]]:
    with _lock:
        entries_by_endpoint: dict[str, int] = defaultdict(int)
        for _, _, endpoint, _ in _cache.values():
            entries_by_endpoint[endpoint] += 1
        endpoints = (
            builtins.set(entries_by_endpoint.keys())
            | builtins.set(_hits_by_endpoint.keys())
            | builtins.set(_misses_by_endpoint.keys())
        )
        by_endpoint = []
        for endpoint in sorted(endpoints):
            hits = int(_hits_by_endpoint.get(endpoint, 0))
            misses = int(_misses_by_endpoint.get(endpoint, 0))
            total = hits + misses
            by_endpoint.append(
                {
                    'endpoint': endpoint,
                    'hits': hits,
                    'misses': misses,
                    'hit_rate_pct': round((hits * 100.0 / total), 2) if total > 0 else 0.0,
                    'entries': int(entries_by_endpoint.get(endpoint, 0)),
                }
            )
        return {'by_endpoint': by_endpoint}
