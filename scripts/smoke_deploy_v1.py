import json
import os
import urllib.request


LEGACY_BASE = os.getenv('SMOKE_LEGACY_BASE', 'http://dashboard:5000').rstrip('/')
V1_BASE = os.getenv('SMOKE_API_V1_BASE', 'http://api-v1:8000/api/v1').rstrip('/')


def get_json(url: str):
    with urllib.request.urlopen(url, timeout=20) as res:
        return json.loads(res.read().decode('utf-8'))


def main():
    legacy_health = get_json(f'{LEGACY_BASE}/api/check-files')
    v1_health = get_json(f'{V1_BASE}/health')
    if not isinstance(legacy_health, dict):
        raise RuntimeError('legacy health invalid')
    if v1_health.get('ok') is not True:
        raise RuntimeError('api v1 health failed')
    print(json.dumps({'ok': True, 'legacy': legacy_health, 'v1': v1_health}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
