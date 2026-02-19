import json
import os
import statistics
import time
import urllib.request
from urllib.error import HTTPError, URLError


BASE = os.getenv('PERF_API_BASE', 'http://localhost:8000/api/v1').rstrip('/')
SAMPLES = int(os.getenv('PERF_SAMPLES', '9'))
ANALYTICS_BUDGET_MS = float(os.getenv('PERF_ANALYTICS_P95_BUDGET_MS', '1200'))
WARMUP_CALLS = int(os.getenv('PERF_WARMUP_CALLS', '2'))
HTTP_TIMEOUT_SECONDS = float(os.getenv('PERF_HTTP_TIMEOUT_SECONDS', '180'))
HTTP_RETRIES = int(os.getenv('PERF_HTTP_RETRIES', '4'))
HTTP_RETRY_SLEEP_SECONDS = float(os.getenv('PERF_HTTP_RETRY_SLEEP_SECONDS', '2'))
PERF_USERNAME = os.getenv('PERF_USERNAME', 'admin')
PERF_PASSWORD = os.getenv('PERF_PASSWORD', 'change_me_demo_admin_password')


def http_post(path: str, payload: dict, headers: dict | None = None):
    data = json.dumps(payload).encode('utf-8')
    last_error = None

    for attempt in range(max(1, HTTP_RETRIES)):
        req = urllib.request.Request(
            f'{BASE}{path}',
            data=data,
            headers={'Content-Type': 'application/json', **(headers or {})},
            method='POST',
        )
        start = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as res:
                body = res.read().decode('utf-8')
            elapsed_ms = (time.perf_counter() - start) * 1000
            return elapsed_ms, json.loads(body)
        except HTTPError as exc:
            # Retry only transient 5xx server-side errors.
            if exc.code >= 500:
                last_error = exc
            else:
                raise
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc

        if attempt < HTTP_RETRIES - 1:
            time.sleep(max(0.0, HTTP_RETRY_SLEEP_SECONDS))

    raise RuntimeError(f'HTTP POST failed after {max(1, HTTP_RETRIES)} attempts for {path}: {last_error}')


def p95(values):
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = int(round((len(sorted_vals) - 1) * 0.95))
    idx = max(0, min(idx, len(sorted_vals) - 1))
    return float(sorted_vals[idx])


def main():
    login_ms, login_payload = http_post('/auth/login', {'username': PERF_USERNAME, 'password': PERF_PASSWORD})
    token = login_payload['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    bounded_filters = {
        'anio': ['2026'],
        'gestion_month': ['01/2026'],
        'contract_month': ['01/2026'],
        'supervisor': ['FVBROKEREAS'],
        'un': ['MEDICINA ESTETICA'],
        'via_cobro': ['COBRADOR'],
    }
    tests = [
        ('/analytics/portfolio/summary', bounded_filters, ANALYTICS_BUDGET_MS),
        ('/analytics/rendimiento/summary', bounded_filters, ANALYTICS_BUDGET_MS),
        ('/analytics/mora/summary', bounded_filters, ANALYTICS_BUDGET_MS),
        ('/analytics/brokers/summary', bounded_filters, ANALYTICS_BUDGET_MS),
    ]

    report = {'login_ms': round(login_ms, 2), 'endpoints': []}
    for path, payload, budget in tests:
        for _ in range(max(0, WARMUP_CALLS)):
            try:
                http_post(path, payload, headers=headers)
            except Exception:
                # Warmup is best-effort to avoid cold-start distortion.
                pass

        samples = []
        for _ in range(SAMPLES):
            ms, body = http_post(path, payload, headers=headers)
            if not isinstance(body, dict):
                raise RuntimeError(f'{path} response invalida')
            samples.append(ms)
        endpoint_p95 = p95(samples)
        endpoint_avg = statistics.mean(samples)
        ok = endpoint_p95 <= budget
        report['endpoints'].append(
            {
                'path': path,
                'samples_ms': [round(v, 2) for v in samples],
                'avg_ms': round(endpoint_avg, 2),
                'p95_ms': round(endpoint_p95, 2),
                'budget_ms': budget,
                'ok': ok,
            }
        )
        if not ok:
            raise RuntimeError(f'Perf smoke FAIL {path}: p95={endpoint_p95:.2f} budget={budget}')

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
