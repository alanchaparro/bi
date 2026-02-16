import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.brokers import AuditLog, BrokersSupervisorScope, CommissionRules, PrizeRules, UserPreference


def _upsert_singleton(db: Session, model, field_name: str, value_json: str):
    row = db.query(model).filter(model.id == 1).first()
    if row is None:
        row = model(id=1)
        setattr(row, field_name, value_json)
        row.updated_at = datetime.utcnow()
        db.add(row)
    else:
        setattr(row, field_name, value_json)
        row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


def get_supervisor_scope(db: Session):
    row = db.query(BrokersSupervisorScope).filter(BrokersSupervisorScope.id == 1).first()
    if not row:
        return []
    return json.loads(row.supervisors_json or '[]')


def save_supervisor_scope(db: Session, supervisors: list[str], actor: str):
    payload = json.dumps(supervisors, ensure_ascii=False)
    row = _upsert_singleton(db, BrokersSupervisorScope, 'supervisors_json', payload)
    add_audit(db, 'brokers_supervisor_scope', 'upsert', actor, {'supervisors': supervisors})
    return json.loads(row.supervisors_json or '[]')


def get_commission_rules(db: Session):
    row = db.query(CommissionRules).filter(CommissionRules.id == 1).first()
    if not row:
        return []
    return json.loads(row.rules_json or '[]')


def save_commission_rules(db: Session, rules: list[dict], actor: str):
    payload = json.dumps(rules, ensure_ascii=False)
    row = _upsert_singleton(db, CommissionRules, 'rules_json', payload)
    add_audit(db, 'commission_rules', 'upsert', actor, {'rules_count': len(rules)})
    return json.loads(row.rules_json or '[]')


def get_prize_rules(db: Session):
    row = db.query(PrizeRules).filter(PrizeRules.id == 1).first()
    if not row:
        return []
    return json.loads(row.rules_json or '[]')


def save_prize_rules(db: Session, rules: list[dict], actor: str):
    payload = json.dumps(rules, ensure_ascii=False)
    row = _upsert_singleton(db, PrizeRules, 'rules_json', payload)
    add_audit(db, 'prize_rules', 'upsert', actor, {'rules_count': len(rules)})
    return json.loads(row.rules_json or '[]')


def add_audit(db: Session, entity: str, action: str, actor: str, payload: dict):
    row = AuditLog(entity=entity, action=action, actor=actor, payload_json=json.dumps(payload, ensure_ascii=False))
    db.add(row)
    db.commit()


def get_user_preferences(db: Session, username: str, pref_key: str) -> dict:
    row = (
        db.query(UserPreference)
        .filter(UserPreference.username == username, UserPreference.pref_key == pref_key)
        .first()
    )
    if not row:
        return {}
    data = json.loads(row.value_json or '{}')
    return data if isinstance(data, dict) else {}


def save_user_preferences(db: Session, username: str, pref_key: str, value: dict):
    payload = json.dumps(value, ensure_ascii=False)
    row = (
        db.query(UserPreference)
        .filter(UserPreference.username == username, UserPreference.pref_key == pref_key)
        .first()
    )
    if row is None:
        row = UserPreference(username=username, pref_key=pref_key, value_json=payload)
        db.add(row)
    else:
        row.value_json = payload
        row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return json.loads(row.value_json or '{}')
