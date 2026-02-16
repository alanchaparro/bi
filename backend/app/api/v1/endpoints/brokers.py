from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission, write_rate_limiter
from app.db.session import get_db
from app.schemas.brokers import (
    BrokersPreferencesIn,
    BrokersPreferencesOut,
    RulesIn,
    RulesOut,
    SupervisorsScopeIn,
    SupervisorsScopeOut,
)
from app.services.brokers_config_service import BrokersConfigService

router = APIRouter()


@router.get('/supervisors-scope', response_model=SupervisorsScopeOut)
def get_supervisors_scope(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    supervisors = BrokersConfigService.get_supervisors_scope(db)
    return SupervisorsScopeOut(supervisors=supervisors)


@router.post('/supervisors-scope', response_model=SupervisorsScopeOut)
def save_supervisors_scope(
    payload: SupervisorsScopeIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    supervisors = BrokersConfigService.save_supervisors_scope(db, payload.supervisors, user.get('sub', 'system'))
    return SupervisorsScopeOut(supervisors=supervisors)


@router.get('/commissions', response_model=RulesOut)
def get_commissions(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    rules = BrokersConfigService.get_commissions(db)
    return RulesOut(rules=rules)


@router.post('/commissions', response_model=RulesOut)
def save_commissions(
    payload: RulesIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    rules = BrokersConfigService.save_commissions(db, payload.rules, user.get('sub', 'system'))
    return RulesOut(rules=rules)


@router.get('/prizes', response_model=RulesOut)
def get_prizes(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    rules = BrokersConfigService.get_prizes(db)
    return RulesOut(rules=rules)


@router.post('/prizes', response_model=RulesOut)
def save_prizes(
    payload: RulesIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    rules = BrokersConfigService.save_prizes(db, payload.rules, user.get('sub', 'system'))
    return RulesOut(rules=rules)


@router.get('/preferences', response_model=BrokersPreferencesOut)
def get_preferences(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    data = BrokersConfigService.get_brokers_preferences(db, user.get('sub', ''))
    return BrokersPreferencesOut(**({'filters': data.get('filters', {})} if isinstance(data, dict) else {}))


@router.post('/preferences', response_model=BrokersPreferencesOut)
def save_preferences(
    payload: BrokersPreferencesIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    stored = BrokersConfigService.save_brokers_preferences(db, user.get('sub', ''), payload.model_dump())
    return BrokersPreferencesOut(**({'filters': stored.get('filters', {})} if isinstance(stored, dict) else {}))
