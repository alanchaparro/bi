from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from typing import Deque


_MAX_SAMPLES = 500
_LATENCIES: dict[str, Deque[float]] = defaultdict(lambda: deque(maxlen=_MAX_SAMPLES))
_LOCK = Lock()


def _percentile(sorted_values: list[float], p: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    rank = (len(sorted_values) - 1) * p
    low = int(rank)
    high = min(low + 1, len(sorted_values) - 1)
    weight = rank - low
    return float(sorted_values[low] * (1.0 - weight) + sorted_values[high] * weight)


def observe(endpoint: str, latency_ms: float) -> None:
    key = str(endpoint or "unknown").strip() or "unknown"
    with _LOCK:
        _LATENCIES[key].append(float(max(0.0, latency_ms)))


def summary() -> dict:
    with _LOCK:
        items = {k: list(v) for k, v in _LATENCIES.items()}
    out: dict[str, dict[str, float | int]] = {}
    for endpoint, values in items.items():
        if not values:
            continue
        arr = sorted(values)
        out[endpoint] = {
            "count": len(arr),
            "p50_ms": round(_percentile(arr, 0.50), 2),
            "p95_ms": round(_percentile(arr, 0.95), 2),
            "p99_ms": round(_percentile(arr, 0.99), 2),
            "max_ms": round(float(arr[-1]), 2),
        }
    return out
