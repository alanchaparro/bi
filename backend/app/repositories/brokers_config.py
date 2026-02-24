import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.brokers import (
    AuditLog,
    AuthUser,
    BrokersSupervisorScope,
    CarteraFact,
    CommissionRules,
    PrizeRules,
    SyncRecord,
    UserPreference,
)


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


def get_cartera_tramo_rules(db: Session) -> dict:
    stored = get_user_preferences(db, '__system__', 'cartera_tramo_rules_v1')
    return get_cartera_tramo_rules_from_payload(stored)


def save_cartera_tramo_rules(db: Session, value: dict, actor: str) -> dict:
    payload = get_cartera_tramo_rules_from_payload(value)
    stored = save_user_preferences(db, '__system__', 'cartera_tramo_rules_v1', payload)
    add_audit(db, 'cartera_tramo_rules_v1', 'upsert', actor, {'rules_count': len(payload.get('rules', []))})
    return get_cartera_tramo_rules_from_payload(stored)


def get_cartera_tramo_rules_from_payload(value: dict) -> dict:
    if not isinstance(value, dict):
        return {'rules': []}
    rules = value.get('rules', [])
    normalized_by_key: dict[tuple[str, str], set[int]] = {}
    if isinstance(rules, list):
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            un = str(rule.get('un') or '').strip().upper()
            if not un:
                continue

            # Backward compatibility with previous model: vigente_max_tramo.
            if 'vigente_max_tramo' in rule:
                try:
                    vigente_max = int(rule.get('vigente_max_tramo', 3))
                except Exception:
                    vigente_max = 3
                vigente_max = max(0, min(7, vigente_max))
                vig_set = set(range(0, vigente_max + 1))
                mor_set = set(range(vigente_max + 1, 8))
                normalized_by_key[(un, 'VIGENTE')] = vig_set
                normalized_by_key[(un, 'MOROSO')] = mor_set
                continue

            category = str(rule.get('category') or '').strip().upper()
            if category not in {'VIGENTE', 'MOROSO'}:
                continue
            tramos = rule.get('tramos', [])
            tramo_set: set[int] = set()
            if isinstance(tramos, list):
                for t in tramos:
                    try:
                        n = int(t)
                    except Exception:
                        continue
                    if 0 <= n <= 7:
                        tramo_set.add(n)
            normalized_by_key[(un, category)] = tramo_set

    normalized_rules = [
        {'un': un, 'category': category, 'tramos': sorted(list(tramo_set))}
        for (un, category), tramo_set in sorted(normalized_by_key.items(), key=lambda x: (x[0][0], x[0][1]))
    ]
    return {'rules': normalized_rules}


def get_cartera_uns(db: Session) -> list[str]:
    if settings.read_from_fact_tables:
        rows = db.query(CarteraFact.un).distinct().all()
    else:
        rows = db.query(SyncRecord.un).filter(SyncRecord.domain == 'cartera').distinct().all()
    uns = sorted({str(r[0] or '').strip().upper() for r in rows if str(r[0] or '').strip()})
    return uns


def list_auth_users(db: Session) -> list[AuthUser]:
    return db.query(AuthUser).order_by(AuthUser.username.asc()).all()


def get_auth_user(db: Session, username: str) -> AuthUser | None:
    return db.query(AuthUser).filter(AuthUser.username == username).first()


def create_auth_user(
    db: Session,
    username: str,
    password_hash: str,
    role: str,
    is_active: bool,
    actor: str,
) -> AuthUser:
    row = AuthUser(
        username=username,
        password_hash=password_hash,
        role=role,
        is_active=bool(is_active),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    add_audit(db, 'auth_users', 'create', actor, {'username': row.username, 'role': row.role, 'is_active': row.is_active})
    return row


def update_auth_user(
    db: Session,
    row: AuthUser,
    role: str | None,
    is_active: bool | None,
    password_hash: str | None,
    actor: str,
) -> AuthUser:
    if role is not None:
        row.role = role
    if is_active is not None:
        row.is_active = bool(is_active)
    if password_hash:
        row.password_hash = password_hash
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    add_audit(db, 'auth_users', 'update', actor, {'username': row.username, 'role': row.role, 'is_active': row.is_active})
    return row


def get_mysql_connection(db: Session) -> dict:
    stored = get_user_preferences(db, '__system__', 'mysql_connection_v1')
    return stored if isinstance(stored, dict) else {}


def save_mysql_connection(db: Session, value: dict, actor: str) -> dict:
    payload = {
        'host': str(value.get('host') or '').strip(),
        'port': int(value.get('port') or 3306),
        'user': str(value.get('user') or '').strip(),
        'password': str(value.get('password') or ''),
        'database': str(value.get('database') or '').strip(),
        'ssl_disabled': bool(value.get('ssl_disabled', True)),
    }
    stored = save_user_preferences(db, '__system__', 'mysql_connection_v1', payload)
    add_audit(
        db,
        'mysql_connection_v1',
        'upsert',
        actor,
        {
            'host': payload['host'],
            'port': payload['port'],
            'user': payload['user'],
            'database': payload['database'],
            'ssl_disabled': payload['ssl_disabled'],
            'password_changed': bool(payload['password']),
        },
    )
    return stored if isinstance(stored, dict) else {}
