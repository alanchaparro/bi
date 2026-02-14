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


def main():
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / 'backend'))
    from app.db.base import Base
    from app.db.session import SessionLocal, engine
    from app.services.brokers_config_service import BrokersConfigService

    data_dir = root / 'data'
    Base.metadata.create_all(bind=engine)

    supervisors = read_rules(data_dir / 'brokers_supervisors.json', 'supervisors')
    commissions = read_rules(data_dir / 'commissions_rules.json', 'rules')
    prizes = read_rules(data_dir / 'prizes_rules.json', 'rules')

    db = SessionLocal()
    try:
        BrokersConfigService.save_supervisors_scope(db, supervisors, 'migration')
        BrokersConfigService.save_commissions(db, commissions, 'migration')
        BrokersConfigService.save_prizes(db, prizes, 'migration')
    finally:
        db.close()

    print(
        json.dumps(
            {
                'ok': True,
                'supervisors': len(supervisors),
                'commissions': len(commissions),
                'prizes': len(prizes),
            },
            ensure_ascii=False,
        )
    )


if __name__ == '__main__':
    main()
