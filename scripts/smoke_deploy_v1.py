import json
import os
import urllib.request


V1_BASE = os.getenv('SMOKE_API_V1_BASE', 'http://api-v1:8000/api/v1').rstrip('/')


def get_json(url: str):
    with urllib.request.urlopen(url, timeout=20) as res:
        return json.loads(res.read().decode('utf-8'))


def main():
    v1_health = get_json(f'{V1_BASE}/health')
    if v1_health.get('ok') is not True:
        raise RuntimeError('api v1 health failed')
    print(json.dumps({'ok': True, 'v1': v1_health}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
