import json
import os
import urllib.request


BASE = os.getenv('E2E_API_BASE', 'http://localhost:8000/api/v1').rstrip('/')


def post(path: str, payload: dict, token: str | None = None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(
        f'{BASE}{path}',
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode('utf-8'))


def get(path: str, token: str):
    req = urllib.request.Request(
        f'{BASE}{path}',
        headers={'Authorization': f'Bearer {token}'},
        method='GET',
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode('utf-8'))


def main():
    auth = post('/auth/login', {'username': 'admin', 'password': 'admin123'})
    token = auth.get('access_token')
    if not token:
        raise RuntimeError('No access_token in login response')

    supervisors_payload = {'supervisors': ['FVBROKEREAS', 'FVBROKEREASCDE']}
    s1 = post('/brokers/supervisors-scope', supervisors_payload, token)
    if sorted(s1.get('supervisors', [])) != sorted(supervisors_payload['supervisors']):
        raise RuntimeError('supervisors-scope save mismatch')
    s2 = get('/brokers/supervisors-scope', token)
    if sorted(s2.get('supervisors', [])) != sorted(supervisors_payload['supervisors']):
        raise RuntimeError('supervisors-scope read mismatch')

    commissions_payload = {
        'rules': [
            {
                'supervisors': ['FVBROKEREAS'],
                'uns': ['MEDICINA ESTETICA'],
                'vias': ['COBRADOR'],
                'months': ['01/2026'],
                'rate': 0.08,
            }
        ]
    }
    c1 = post('/brokers/commissions', commissions_payload, token)
    if not isinstance(c1.get('rules'), list):
        raise RuntimeError('commissions response invalid')

    prizes_payload = {
        'rules': [
            {
                'supervisors': ['FVBROKEREAS', 'FVBROKEREASCDE'],
                'uns': ['__ALL__'],
                'scales': [{'threshold': 1, 'prize': 50}, {'threshold': 5, 'prize': 100}],
            }
        ]
    }
    p1 = post('/brokers/prizes', prizes_payload, token)
    if not isinstance(p1.get('rules'), list):
        raise RuntimeError('prizes response invalid')

    prefs_payload = {
        'filters': {
            'supervisors': ['FVBROKEREAS'],
            'uns': ['MEDICINA ESTETICA'],
            'vias': ['COBRADOR'],
            'years': ['2026'],
            'months': ['01/2026'],
        }
    }
    pref_save = post('/brokers/preferences', prefs_payload, token)
    pref_get = get('/brokers/preferences', token)
    if pref_get.get('filters', {}).get('vias') != prefs_payload['filters']['vias']:
        raise RuntimeError('preferences roundtrip failed')

    summary = post(
        '/analytics/brokers/summary',
        {
            'supervisor': prefs_payload['filters']['supervisors'],
            'un': prefs_payload['filters']['uns'],
            'via_cobro': prefs_payload['filters']['vias'],
            'anio': prefs_payload['filters']['years'],
            'contract_month': prefs_payload['filters']['months'],
        },
        token,
    )
    if not isinstance(summary, dict):
        raise RuntimeError('brokers summary invalid')

    print(
        json.dumps(
            {
                'ok': True,
                'checks': {
                    'supervisors': True,
                    'commissions': True,
                    'prizes': True,
                    'preferences': pref_save.get('filters', {}),
                    'summary_keys': sorted(summary.keys()),
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == '__main__':
    main()
