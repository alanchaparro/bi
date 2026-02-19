from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_permission, write_rate_limiter
from app.db.session import get_db
from app.schemas.brokers import (
    BrokersPreferencesIn,
    BrokersPreferencesOut,
    CarteraTramoRulesIn,
    CarteraTramoRulesOut,
    CarteraUnsOut,
    RulesIn,
    RulesOut,
    SupervisorsScopeIn,
    SupervisorsScopeOut,
)
from app.services.brokers_config_service import BrokersConfigService
from app.services.sync_service import SyncService

router = APIRouter()


@router.get('/sync-analytics/status')
def sync_analytics_status(user=Depends(require_permission('brokers:read'))):
    return SyncService.status(domain='analytics')


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


@router.get('/preferences/cartera', response_model=BrokersPreferencesOut)
def get_cartera_preferences(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    data = BrokersConfigService.get_cartera_preferences(db, user.get('sub', ''))
    return BrokersPreferencesOut(**({'filters': data.get('filters', {})} if isinstance(data, dict) else {}))


@router.post('/preferences/cartera', response_model=BrokersPreferencesOut)
def save_cartera_preferences(
    payload: BrokersPreferencesIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    stored = BrokersConfigService.save_cartera_preferences(db, user.get('sub', ''), payload.model_dump())
    return BrokersPreferencesOut(**({'filters': stored.get('filters', {})} if isinstance(stored, dict) else {}))


@router.get('/cartera-tramo-rules', response_model=CarteraTramoRulesOut)
def get_cartera_tramo_rules(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    rules = BrokersConfigService.get_cartera_tramo_rules(db)
    return CarteraTramoRulesOut(**rules)


@router.post('/cartera-tramo-rules', response_model=CarteraTramoRulesOut)
def save_cartera_tramo_rules(
    payload: CarteraTramoRulesIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    rules = BrokersConfigService.save_cartera_tramo_rules(db, payload.model_dump(), user.get('sub', 'system'))
    return CarteraTramoRulesOut(**rules)


@router.get('/cartera-uns', response_model=CarteraUnsOut)
def get_cartera_uns(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    uns = BrokersConfigService.get_cartera_uns(db)
    return CarteraUnsOut(uns=uns)


@router.post('/sync-analytics')
def sync_analytics_from_csv(
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    actor = str(user.get('sub', 'system'))
    try:
        result = SyncService.start(
            domain='analytics',
            year_from=None,
            close_month=None,
            close_month_from=None,
            close_month_to=None,
            actor=actor,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail={'message': str(exc)})
    return result
