#!/usr/bin/env python3
"""Benchmark simple para endpoints analytics v2.

Uso:
  python scripts/benchmark_analytics_v2.py --base-url http://localhost:8000/api/v1 --token <JWT>
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class Sample:
    endpoint: str
    ms: float
    status: int
    bytes_tx: int
    cache_hit: bool | None


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    k = (len(values) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return float(values[int(k)])
    d0 = values[f] * (c - k)
    d1 = values[c] * (k - f)
    return float(d0 + d1)


def _post_json(base_url: str, endpoint: str, token: str | None, payload: dict[str, Any]) -> Sample:
    url = f"{base_url.rstrip('/')}{endpoint}"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url=url, method="POST", data=body)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            data = resp.read()
            cache_hit: bool | None = None
            try:
                parsed = json.loads(data.decode("utf-8"))
                meta = parsed.get("meta") if isinstance(parsed, dict) else None
                if isinstance(meta, dict) and "cache_hit" in meta:
                    cache_hit = bool(meta.get("cache_hit"))
            except Exception:
                cache_hit = None
            return Sample(
                endpoint=endpoint,
                ms=elapsed_ms,
                status=int(resp.status),
                bytes_tx=len(data),
                cache_hit=cache_hit,
            )
    except urllib.error.HTTPError as exc:
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        return Sample(endpoint=endpoint, ms=elapsed_ms, status=int(exc.code), bytes_tx=0, cache_hit=None)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000/api/v1")
    parser.add_argument("--token", default=None)
    parser.add_argument("--rounds", type=int, default=8, help="Llamadas por endpoint (1 cold + resto warm).")
    args = parser.parse_args()

    payloads: list[tuple[str, dict[str, Any]]] = [
        ("/analytics/portfolio-corte-v2/options", {}),
        ("/analytics/portfolio-corte-v2/summary", {"include_rows": False}),
        ("/analytics/portfolio-corte-v2/first-paint", {"include_rows": False}),
        ("/analytics/cobranzas-cohorte-v2/options", {}),
        ("/analytics/cobranzas-cohorte-v2/first-paint", {}),
        ("/analytics/cobranzas-cohorte-v2/detail", {"page": 1, "page_size": 24}),
        ("/analytics/rendimiento-v2/options", {}),
        ("/analytics/rendimiento-v2/summary", {}),
        ("/analytics/rendimiento-v2/first-paint", {}),
        ("/analytics/anuales-v2/options", {}),
        ("/analytics/anuales-v2/summary", {}),
        ("/analytics/anuales-v2/first-paint", {}),
    ]

    rows: list[dict[str, Any]] = []
    for endpoint, payload in payloads:
        samples: list[Sample] = []
        for _ in range(max(2, int(args.rounds))):
            samples.append(_post_json(args.base_url, endpoint, args.token, payload))

        cold = samples[0]
        warm = samples[1:]
        warm_ms = sorted([s.ms for s in warm if s.status < 500])
        warm_bytes = [s.bytes_tx for s in warm if s.status < 500]
        warm_cache_hits = [s.cache_hit for s in warm if s.cache_hit is not None]
        rows.append(
            {
                "endpoint": endpoint,
                "cold_ms": round(cold.ms, 2),
                "warm_p50_ms": round(statistics.median(warm_ms), 2) if warm_ms else 0.0,
                "warm_p95_ms": round(_percentile(warm_ms, 95), 2) if warm_ms else 0.0,
                "warm_p99_ms": round(_percentile(warm_ms, 99), 2) if warm_ms else 0.0,
                "warm_avg_bytes": int(sum(warm_bytes) / len(warm_bytes)) if warm_bytes else 0,
                "warm_cache_hit_rate": round(
                    (sum(1 for hit in warm_cache_hits if hit) / len(warm_cache_hits)) * 100.0, 2
                )
                if warm_cache_hits
                else None,
                "status_ok": all(s.status < 400 for s in samples),
            }
        )

    print(json.dumps({"generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "rows": rows}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

