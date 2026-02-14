import json
import os
import statistics
import time
import urllib.request
from urllib.error import HTTPError


BASE = os.getenv("PERF_API_BASE", "http://localhost:8000/api/v1").rstrip("/")
SAMPLES = 7


def http_post(path: str, payload: dict, headers: dict | None = None):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=45) as res:
            body = res.read().decode("utf-8")
    except HTTPError as exc:
        if exc.code >= 500:
            # transient backend error, single retry
            with urllib.request.urlopen(req, timeout=45) as res:
                body = res.read().decode("utf-8")
        else:
            raise
    elapsed_ms = (time.perf_counter() - start) * 1000
    return elapsed_ms, json.loads(body)


def p95(values):
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = int(round((len(sorted_vals) - 1) * 0.95))
    idx = max(0, min(idx, len(sorted_vals) - 1))
    return float(sorted_vals[idx])


def main():
    login_ms, login_payload = http_post("/auth/login", {"username": "admin", "password": "admin123"})
    token = login_payload["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    bounded_filters = {
        "anio": ["2026"],
        "gestion_month": ["01/2026"],
        "contract_month": ["01/2026"],
        "supervisor": ["FVBROKEREAS"],
    }
    tests = [
        ("/analytics/portfolio/summary", bounded_filters, 3000.0),
        ("/analytics/rendimiento/summary", bounded_filters, 3000.0),
    ]

    report = {"login_ms": round(login_ms, 2), "endpoints": []}
    for path, payload, budget in tests:
        samples = []
        for _ in range(SAMPLES):
            ms, body = http_post(path, payload, headers=headers)
            if not isinstance(body, dict):
                raise RuntimeError(f"{path} response inválida")
            samples.append(ms)
        endpoint_p95 = p95(samples)
        endpoint_avg = statistics.mean(samples)
        ok = endpoint_p95 <= budget
        report["endpoints"].append(
            {
                "path": path,
                "samples_ms": [round(v, 2) for v in samples],
                "avg_ms": round(endpoint_avg, 2),
                "p95_ms": round(endpoint_p95, 2),
                "budget_ms": budget,
                "ok": ok,
            }
        )
        if not ok:
            raise RuntimeError(f"Perf smoke FAIL {path}: p95={endpoint_p95:.2f} budget={budget}")

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
