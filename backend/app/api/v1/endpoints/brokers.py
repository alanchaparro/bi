from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.session import get_db
from app.schemas.brokers import RulesIn, RulesOut, SupervisorsScopeIn, SupervisorsScopeOut
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
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    rules = BrokersConfigService.save_prizes(db, payload.rules, user.get('sub', 'system'))
    return RulesOut(rules=rules)
