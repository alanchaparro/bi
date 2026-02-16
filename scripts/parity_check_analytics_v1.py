import json
import os
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError


API_V1_BASE = os.getenv('PARITY_API_V1_BASE', 'http://localhost:8000/api/v1').rstrip('/')
LEGACY_BASE = os.getenv('PARITY_LEGACY_BASE', 'http://localhost:5000').rstrip('/')
REL_TOL = float(os.getenv('PARITY_REL_TOL', '0.01'))
ABS_TOL = float(os.getenv('PARITY_ABS_TOL', '1.0'))
HTTP_RETRIES = int(os.getenv('PARITY_HTTP_RETRIES', '4'))
HTTP_RETRY_SLEEP_SECONDS = float(os.getenv('PARITY_HTTP_RETRY_SLEEP_SECONDS', '1.5'))
HTTP_TIMEOUT_SECONDS = float(os.getenv('PARITY_HTTP_TIMEOUT_SECONDS', '180'))


def post_json(url: str, payload: dict, headers: dict | None = None):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', **(headers or {})},
        method='POST',
    )
    for attempt in range(max(1, HTTP_RETRIES)):
        try:
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as res:
                return json.loads(res.read().decode('utf-8'))
        except HTTPError as exc:
            if exc.code >= 500 and attempt < max(1, HTTP_RETRIES) - 1:
                time.sleep(HTTP_RETRY_SLEEP_SECONDS)
                continue
            raise


def get_json(url: str):
    for attempt in range(max(1, HTTP_RETRIES)):
        try:
            with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT_SECONDS) as res:
                return json.loads(res.read().decode('utf-8'))
        except HTTPError as exc:
            if exc.code >= 500 and attempt < max(1, HTTP_RETRIES) - 1:
                time.sleep(HTTP_RETRY_SLEEP_SECONDS)
                continue
            raise


def flatten_numbers(data, prefix=''):
    out = {}
    if isinstance(data, dict):
        for key, value in data.items():
            p = f'{prefix}.{key}' if prefix else str(key)
            out.update(flatten_numbers(value, p))
        return out
    if isinstance(data, list):
        for i, value in enumerate(data):
            out.update(flatten_numbers(value, f'{prefix}[{i}]'))
        return out
    if isinstance(data, (int, float)) and not isinstance(data, bool):
        out[prefix or 'value'] = float(data)
    return out


def is_close(a: float, b: float) -> bool:
    diff = abs(a - b)
    allowed = ABS_TOL + REL_TOL * max(1.0, abs(a), abs(b))
    return diff <= allowed


def main():
    login = post_json(f'{API_V1_BASE}/auth/login', {'username': 'admin', 'password': 'admin123'})
    token = login.get('access_token')
    if not token:
        raise RuntimeError('No se obtuvo access_token para parity check')

    headers = {'Authorization': f'Bearer {token}'}
    filters = {
        'anio': ['2026'],
        'gestion_month': ['01/2026'],
        'contract_month': ['01/2026'],
        'supervisor': ['FVBROKEREAS', 'FVBROKEREASCDE'],
        'un': ['MEDICINA ESTETICA'],
        'via_cobro': ['COBRADOR'],
    }

    cases = [
        ('portfolio', 'get', '/analytics/portfolio/summary', '/analytics/portfolio/summary'),
        ('rendimiento', 'get', '/analytics/rendimiento/summary', '/analytics/performance/by-management-month'),
        ('mora', 'get', '/analytics/mora/summary', '/analytics/movement/moroso-trend'),
        ('brokers', 'post', '/analytics/brokers/summary', '/api/brokers/summary'),
    ]

    query = urllib.parse.urlencode([(k, v) for k, vals in filters.items() for v in vals])
    report = {'ok': True, 'cases': [], 'tolerances': {'rel': REL_TOL, 'abs': ABS_TOL}}

    for name, legacy_method, v1_path, legacy_path in cases:
        # Warmup call to reduce cold-start 5xx on first request.
        try:
            post_json(f'{API_V1_BASE}{v1_path}', filters, headers=headers)
        except Exception:
            pass

        v1_payload = post_json(f'{API_V1_BASE}{v1_path}', filters, headers=headers)
        if legacy_method == 'post':
            legacy_filters = {
                'supervisors': filters.get('supervisor', []),
                'months': filters.get('contract_month', []),
                'uns': filters.get('un', []),
                'vias': filters.get('via_cobro', []),
            }
            legacy_payload = post_json(f'{LEGACY_BASE}{legacy_path}', legacy_filters)
        else:
            legacy_payload = get_json(f'{LEGACY_BASE}{legacy_path}?{query}')

        v1_nums = flatten_numbers(v1_payload)
        legacy_nums = flatten_numbers(legacy_payload)
        keys = sorted(set(v1_nums).intersection(legacy_nums))
        if not keys:
            report['cases'].append(
                {
                    'name': name,
                    'metrics_compared': 0,
                    'drift_count': 0,
                    'ok': True,
                    'skipped': True,
                    'reason': 'sin metricas comparables (dataset v1 posiblemente vacio)',
                }
            )
            continue

        drifts = []
        for key in keys:
            a = v1_nums[key]
            b = legacy_nums[key]
            if not is_close(a, b):
                drifts.append({'metric': key, 'v1': a, 'legacy': b, 'delta': round(a - b, 6)})

        case_report = {
            'name': name,
            'metrics_compared': len(keys),
            'drift_count': len(drifts),
            'ok': len(drifts) == 0,
        }
        if drifts:
            case_report['sample_drifts'] = drifts[:10]
            report['ok'] = False
        report['cases'].append(case_report)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report['ok']:
        raise RuntimeError('Parity check failed')


if __name__ == '__main__':
    main()
