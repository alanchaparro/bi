import json
import os
import sys
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError, URLError

API_BASE = os.getenv('ROLLOUT_API_BASE', 'http://localhost:8000/api/v1').rstrip('/')
USERNAME = os.getenv('ROLLOUT_USERNAME', 'admin')
PASSWORD = os.getenv('ROLLOUT_PASSWORD') or os.getenv('DEMO_ADMIN_PASSWORD')
DOMAINS = [d.strip().lower() for d in os.getenv('ROLLOUT_DOMAINS', 'gestores,contratos,cobranzas,cartera').split(',') if d.strip()]
POLL_SECONDS = float(os.getenv('ROLLOUT_POLL_SECONDS', '2'))
TIMEOUT_SECONDS = int(os.getenv('ROLLOUT_TIMEOUT_SECONDS', '3600'))
HTTP_TIMEOUT_SECONDS = int(os.getenv('ROLLOUT_HTTP_TIMEOUT_SECONDS', '60'))
EXPECT_V2 = str(os.getenv('ROLLOUT_EXPECT_V2', '1')).strip().lower() not in {'0', 'false', 'no'}
SKIP_PREVIEW = str(os.getenv('ROLLOUT_SKIP_PREVIEW', '0')).strip().lower() in {'1', 'true', 'yes'}
YEAR_FROM = os.getenv('ROLLOUT_YEAR_FROM')
CLOSE_MONTH = os.getenv('ROLLOUT_CLOSE_MONTH')
CLOSE_MONTH_FROM = os.getenv('ROLLOUT_CLOSE_MONTH_FROM')
CLOSE_MONTH_TO = os.getenv('ROLLOUT_CLOSE_MONTH_TO')

EXPECTED_V2_QUERY = {
    'gestores': 'sql/v2/query_gestores.sql',
    'contratos': 'sql/v2/query_contratos.sql',
    'cobranzas': 'sql/v2/query_cobranzas.sql',
    'cartera': 'sql/v2/query_cartera.sql',
}


def _request(method: str, path: str, payload: dict | None = None, token: str | None = None) -> dict:
    url = f'{API_BASE}{path}'
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as res:
            body = res.read().decode('utf-8')
            return json.loads(body) if body else {}
    except HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='ignore')
        raise RuntimeError(f'{method} {path} failed: HTTP {exc.code} {detail}') from exc
    except URLError as exc:
        raise RuntimeError(f'{method} {path} failed: {exc}') from exc


def _login() -> str:
    auth = _request('POST', '/auth/login', {'username': USERNAME, 'password': PASSWORD})
    token = str(auth.get('access_token') or '').strip()
    if not token:
        raise RuntimeError('No access_token from /auth/login')
    return token


def _sync_payload(domain: str) -> dict:
    payload: dict[str, object] = {'domain': domain}
    if YEAR_FROM and str(YEAR_FROM).strip().isdigit():
        payload['year_from'] = int(str(YEAR_FROM).strip())
    if CLOSE_MONTH:
        payload['close_month'] = str(CLOSE_MONTH).strip()
    if CLOSE_MONTH_FROM and CLOSE_MONTH_TO:
        payload['close_month_from'] = str(CLOSE_MONTH_FROM).strip()
        payload['close_month_to'] = str(CLOSE_MONTH_TO).strip()
    return payload


def _run_and_wait(token: str, domain: str, payload: dict) -> dict:
    if not SKIP_PREVIEW:
        preview = _request('POST', '/sync/preview', payload=payload, token=token)
        print(json.dumps({'domain': domain, 'preview': preview}, ensure_ascii=False))
    else:
        print(json.dumps({'domain': domain, 'preview': 'skipped'}, ensure_ascii=False))

    started = _request('POST', '/sync/run', payload=payload, token=token)
    job_id = str(started.get('job_id') or '').strip()
    if not job_id:
        raise RuntimeError(f'No job_id for domain={domain}')

    t0 = time.time()
    last = {}
    while True:
        if time.time() - t0 > TIMEOUT_SECONDS:
            raise RuntimeError(f'Timeout waiting domain={domain} job_id={job_id}')
        query = urllib.parse.urlencode({'domain': domain, 'job_id': job_id})
        st = _request('GET', f'/sync/status?{query}', token=token)
        last = st
        running = bool(st.get('running'))
        progress = int(st.get('progress_pct') or 0)
        step = str(st.get('job_step') or st.get('stage') or '-')
        msg = str(st.get('status_message') or '')
        print(f'[sync:{domain}] job={job_id} progress={progress}% step={step} running={running} msg={msg}')
        if not running:
            break
        time.sleep(max(0.5, POLL_SECONDS))

    if last.get('error'):
        raise RuntimeError(f'Sync failed domain={domain}: {last.get("error")}')

    current_query = str(last.get('current_query_file') or '')
    if EXPECT_V2 and domain in EXPECTED_V2_QUERY:
        expected = EXPECTED_V2_QUERY[domain]
        if expected not in current_query:
            raise RuntimeError(
                f'Variant check failed for {domain}: expected query contains "{expected}", got "{current_query}"'
            )
    return last


def _check_meta(payload: dict, endpoint: str) -> None:
    meta = payload.get('meta')
    if not isinstance(meta, dict):
        raise RuntimeError(f'{endpoint}: missing meta object')
    required = ['source_table', 'data_freshness_at', 'cache_hit', 'pipeline_version']
    missing = [k for k in required if k not in meta]
    if missing:
        raise RuntimeError(f'{endpoint}: missing meta keys {missing}')


def _smoke_analytics_v2(token: str) -> None:
    checks = [
        ('/analytics/portfolio-corte-v2/options', {}),
        ('/analytics/portfolio-corte-v2/summary', {'include_rows': False}),
        ('/analytics/rendimiento-v2/options', {}),
        ('/analytics/rendimiento-v2/summary', {}),
    ]
    for path, payload in checks:
        out = _request('POST', path, payload=payload, token=token)
        _check_meta(out, path)
        print(json.dumps({'smoke': path, 'ok': True}, ensure_ascii=False))


def _check_options_consistency(token: str) -> dict:
    out = _request('GET', '/admin/analytics/options/consistency', token=token)
    ok = bool(out.get('ok'))
    if not ok:
        raise RuntimeError(f'options consistency failed: {out}')
    return out


def main() -> None:
    if not PASSWORD:
        print('Error: define ROLLOUT_PASSWORD o DEMO_ADMIN_PASSWORD', file=sys.stderr)
        sys.exit(1)
    if not DOMAINS:
        print('Error: ROLLOUT_DOMAINS vacio', file=sys.stderr)
        sys.exit(1)

    token = _login()
    summary: list[dict] = []

    for domain in DOMAINS:
        payload = _sync_payload(domain)
        t0 = time.time()
        final_status = _run_and_wait(token, domain, payload)
        elapsed = round(time.time() - t0, 2)
        summary.append(
            {
                'domain': domain,
                'job_id': final_status.get('job_id'),
                'duration_sec': elapsed,
                'rows_read': int(final_status.get('rows_read') or 0),
                'rows_upserted': int(final_status.get('rows_upserted') or 0),
                'rows_unchanged': int(final_status.get('rows_unchanged') or 0),
                'current_query_file': final_status.get('current_query_file'),
            }
        )

    _smoke_analytics_v2(token)
    options = _check_options_consistency(token)

    print(json.dumps({'ok': True, 'domains': summary, 'options_consistency': options}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
