import json
import os
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError


METRICS_URL = os.getenv('CUTOVER_METRICS_URL', 'http://localhost:5000/analytics/ops/metrics')
WINDOW_MINUTES = int(os.getenv('CUTOVER_WINDOW_MINUTES', '30'))
INTERVAL_SECONDS = int(os.getenv('CUTOVER_INTERVAL_SECONDS', '60'))
ERROR_RATE_THRESHOLD = float(os.getenv('CUTOVER_ERROR_RATE_THRESHOLD', '2.0'))
P95_THRESHOLD = float(os.getenv('CUTOVER_P95_THRESHOLD', '1200.0'))
OUT_FILE = Path(os.getenv('CUTOVER_OUT_FILE', 'docs/evidence/cutover-window-metrics.jsonl'))
HTTP_TIMEOUT_SECONDS = float(os.getenv('CUTOVER_HTTP_TIMEOUT_SECONDS', '30'))
HTTP_RETRIES = int(os.getenv('CUTOVER_HTTP_RETRIES', '3'))
HTTP_RETRY_SLEEP_SECONDS = float(os.getenv('CUTOVER_HTTP_RETRY_SLEEP_SECONDS', '2'))


def fetch_json(url: str) -> dict:
    last_error = None
    for attempt in range(max(1, HTTP_RETRIES)):
        try:
            with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT_SECONDS) as res:
                body = res.read().decode('utf-8')
            return json.loads(body)
        except (TimeoutError, URLError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < HTTP_RETRIES - 1:
                time.sleep(max(0.0, HTTP_RETRY_SLEEP_SECONDS))
    raise RuntimeError(f'No se pudo obtener metricas tras {max(1, HTTP_RETRIES)} intentos: {last_error}')


def endpoint_ok(item: dict) -> bool:
    error_rate = float(item.get('error_rate_pct') or 0.0)
    p95_ms = float(item.get('p95_ms') or 0.0)
    return error_rate <= ERROR_RATE_THRESHOLD and p95_ms <= P95_THRESHOLD


def evaluate_snapshot(snapshot: dict) -> dict:
    by_endpoint = (snapshot or {}).get('by_endpoint') or {}
    failures = []
    for endpoint, metrics in by_endpoint.items():
        if not endpoint_ok(metrics if isinstance(metrics, dict) else {}):
            failures.append(
                {
                    'endpoint': endpoint,
                    'error_rate_pct': (metrics or {}).get('error_rate_pct'),
                    'p95_ms': (metrics or {}).get('p95_ms'),
                }
            )
    return {
        'ok': len(failures) == 0,
        'failed_endpoints': failures,
    }


def main() -> None:
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    loops = max(1, int((WINDOW_MINUTES * 60) / max(1, INTERVAL_SECONDS)))
    final = {'ok': True, 'samples': 0, 'failures': []}

    with OUT_FILE.open('w', encoding='utf-8') as f:
        for i in range(loops):
            ts = datetime.now(timezone.utc).isoformat()
            try:
                snapshot = fetch_json(METRICS_URL)
                eval_result = evaluate_snapshot(snapshot)
                event = {'ts': ts, 'metrics': snapshot, 'evaluation': eval_result}
            except Exception as exc:
                eval_result = {
                    'ok': False,
                    'failed_endpoints': [{'endpoint': '__monitor__', 'error_rate_pct': None, 'p95_ms': None}],
                }
                event = {'ts': ts, 'metrics': {}, 'evaluation': eval_result, 'monitor_error': str(exc)}
            f.write(json.dumps(event, ensure_ascii=False) + '\n')
            f.flush()
            final['samples'] += 1
            if not eval_result['ok']:
                final['ok'] = False
                final['failures'].append({'ts': ts, 'failed_endpoints': eval_result['failed_endpoints']})
            if i < loops - 1:
                time.sleep(max(1, INTERVAL_SECONDS))

    print(json.dumps(final, ensure_ascii=False, indent=2))
    if not final['ok']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
