import hashlib
import json
import sys
from pathlib import Path


def read_rules(path: Path, key: str):
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding='utf-8'))
    if isinstance(payload, dict):
        data = payload.get(key, [])
    else:
        data = payload
    return data if isinstance(data, list) else []


def canonical_hash(value) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def main():
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / 'backend'))

    from app.db.base import Base
    from app.db.session import SessionLocal, engine
    from app.services.brokers_config_service import BrokersConfigService

    data_dir = root / 'data'
    Base.metadata.create_all(bind=engine)

    legacy = {
        'supervisors': sorted(read_rules(data_dir / 'brokers_supervisors.json', 'supervisors')),
        'commissions': read_rules(data_dir / 'commissions_rules.json', 'rules'),
        'prizes': read_rules(data_dir / 'prizes_rules.json', 'rules'),
    }

    db = SessionLocal()
    try:
        current = {
            'supervisors': sorted(BrokersConfigService.get_supervisors_scope(db)),
            'commissions': BrokersConfigService.get_commissions(db),
            'prizes': BrokersConfigService.get_prizes(db),
        }
    finally:
        db.close()

    summary = {'ok': True, 'checks': {}}
    for key in ['supervisors', 'commissions', 'prizes']:
        legacy_hash = canonical_hash(legacy[key])
        db_hash = canonical_hash(current[key])
        count_legacy = len(legacy[key]) if isinstance(legacy[key], list) else 0
        count_db = len(current[key]) if isinstance(current[key], list) else 0
        diff = abs(count_legacy - count_db)
        is_ok = legacy_hash == db_hash and diff == 0
        summary['checks'][key] = {
            'legacy_count': count_legacy,
            'db_count': count_db,
            'count_diff': diff,
            'legacy_hash': legacy_hash,
            'db_hash': db_hash,
            'ok': is_ok,
        }
        if not is_ok:
            summary['ok'] = False

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if not summary['ok']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
