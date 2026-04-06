from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_permission, write_rate_limiter
from app.db.session import get_db
from app.schemas.brokers import (
    AuthUserCreateIn,
    AuthUserItemOut,
    AuthUsersOut,
    AuthUserUpdateIn,
    BrokersPreferencesIn,
    BrokersPreferencesOut,
    CarteraTramoRulesIn,
    CarteraTramoRulesOut,
    CarteraUnsOut,
    DashboardFilterLayoutsOut,
    DashboardFilterLayoutsPutIn,
    FilterSlotStyleOut,
    MysqlConnectionIn,
    MysqlConnectionOut,
    MysqlConnectionTestOut,
    RoleNavMatrixOut,
    RoleNavMatrixPutIn,
    RulesIn,
    RulesOut,
    SectionLayoutOut,
    SupervisorsScopeIn,
    SupervisorsScopeOut,
)
from app.services.brokers_config_service import BrokersConfigService
from app.services.role_nav_service import get_matrix, replace_matrix
from app.services.sync_service import SyncService

router = APIRouter()


def _dashboard_filter_layouts_out_from_normalized(norm: dict) -> DashboardFilterLayoutsOut:
    sections: dict[str, SectionLayoutOut] = {}
    for k, v in (norm.get('sections') or {}).items():
        if not isinstance(v, dict):
            continue
        slot_styles: dict[str, FilterSlotStyleOut] = {}
        for sk, sv in (v.get('slot_styles') or {}).items():
            if not isinstance(sv, dict):
                continue
            cs_out = None
            mw_out = None
            scale_out = None
            if sv.get('column_span') is not None:
                try:
                    n = int(sv['column_span'])
                    cs_out = n if 2 <= n <= 4 else None
                except (TypeError, ValueError):
                    cs_out = None
            if sv.get('min_width_px') is not None:
                try:
                    m = int(sv['min_width_px'])
                    mw_out = m if 72 <= m <= 420 else None
                except (TypeError, ValueError):
                    mw_out = None
            sc = sv.get('control_scale')
            if isinstance(sc, str) and sc.strip().lower() in ('compact', 'comfortable'):
                scale_out = sc.strip().lower()
            lc_raw = sv.get('low_cardinality_control')
            lc_out = None
            if isinstance(lc_raw, str) and lc_raw.strip().lower() == 'multi_dropdown':
                lc_out = 'multi_dropdown'
            uc_raw = sv.get('un_control')
            uc_out = None
            if isinstance(uc_raw, str):
                ucl = uc_raw.strip().lower()
                if ucl in ('tags_split_row', 'multi_dropdown'):
                    uc_out = ucl
            if (
                cs_out is not None
                or mw_out is not None
                or scale_out is not None
                or lc_out is not None
                or uc_out is not None
            ):
                slot_styles[str(sk)] = FilterSlotStyleOut(
                    column_span=cs_out,
                    min_width_px=mw_out,
                    control_scale=scale_out,
                    low_cardinality_control=lc_out,
                    un_control=uc_out,
                )
        sections[str(k)] = SectionLayoutOut(
            macro=list(v.get('macro') or []),
            micro=list(v.get('micro') or []),
            floating=list(v.get('floating') or []),
            grid_class_macro=v.get('grid_class_macro'),
            grid_class_micro=v.get('grid_class_micro'),
            slot_styles=slot_styles,
        )
    return DashboardFilterLayoutsOut(version=1, sections=sections)


def _user_to_out(row) -> AuthUserItemOut:
    return AuthUserItemOut(
        username=str(row.username or ''),
        role=str(row.role or 'viewer'),
        is_active=bool(row.is_active),
        created_at=row.created_at.isoformat() if getattr(row, 'created_at', None) else None,
        updated_at=row.updated_at.isoformat() if getattr(row, 'updated_at', None) else None,
    )


@router.get('/sync-analytics/status')
def sync_analytics_status(user=Depends(require_permission('brokers:read'))):
    return SyncService.status(domain='analytics')


@router.get('/mysql-connection', response_model=MysqlConnectionOut)
def get_mysql_connection(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    data = BrokersConfigService.get_mysql_connection(db) or {}
    return MysqlConnectionOut(
        host=str(data.get('host') or settings.mysql_host or ''),
        port=int(data.get('port') or settings.mysql_port or 3306),
        user=str(data.get('user') or settings.mysql_user or ''),
        password=str(data.get('password') or settings.mysql_password or ''),
        database=str(data.get('database') or settings.mysql_database or ''),
        ssl_disabled=bool(data.get('ssl_disabled', settings.mysql_ssl_disabled)),
    )


@router.post('/mysql-connection', response_model=MysqlConnectionOut)
def save_mysql_connection(
    payload: MysqlConnectionIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    data = BrokersConfigService.save_mysql_connection(db, payload.model_dump(), str(user.get('sub', 'system'))) or {}
    return MysqlConnectionOut(
        host=str(data.get('host') or ''),
        port=int(data.get('port') or 3306),
        user=str(data.get('user') or ''),
        password=str(data.get('password') or ''),
        database=str(data.get('database') or ''),
        ssl_disabled=bool(data.get('ssl_disabled', True)),
    )


@router.post('/mysql-connection/test', response_model=MysqlConnectionTestOut)
def test_mysql_connection(
    payload: MysqlConnectionIn,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    try:
        result = BrokersConfigService.test_mysql_connection(payload.model_dump())
        return MysqlConnectionTestOut(
            ok=bool(result.get('ok')),
            message=str(result.get('message') or 'Conexion MySQL OK'),
            latency_ms=int(result.get('latency_ms') or 0),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail={'message': f'No se pudo conectar a MySQL: {exc}'})


@router.get('/users', response_model=AuthUsersOut)
def list_users(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    rows = BrokersConfigService.list_auth_users(db)
    return AuthUsersOut(users=[_user_to_out(r) for r in rows])


@router.post('/users', response_model=AuthUserItemOut)
def create_user(
    payload: AuthUserCreateIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    try:
        row = BrokersConfigService.create_auth_user(
            db,
            username=payload.username,
            password=payload.password,
            role=payload.role,
            is_active=payload.is_active,
            actor=str(user.get('sub', 'system')),
        )
        return _user_to_out(row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={'message': str(exc)})
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail={'message': str(exc)})


@router.put('/users/{username}', response_model=AuthUserItemOut)
def update_user(
    username: str,
    payload: AuthUserUpdateIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    try:
        row = BrokersConfigService.update_auth_user(
            db,
            username=username,
            role=payload.role,
            is_active=payload.is_active,
            password=payload.password,
            actor=str(user.get('sub', 'system')),
            actor_username=str(user.get('sub', '')),
        )
        return _user_to_out(row)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail={'message': str(exc)})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={'message': str(exc)})


@router.get('/role-nav-matrix', response_model=RoleNavMatrixOut)
def get_role_nav_matrix(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    data = get_matrix(db)
    return RoleNavMatrixOut(**data)


@router.put('/role-nav-matrix', response_model=RoleNavMatrixOut)
def put_role_nav_matrix(
    payload: RoleNavMatrixPutIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    try:
        data = replace_matrix(db, payload.nav_by_role, str(user.get('sub', 'system')))
        return RoleNavMatrixOut(**data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={'message': str(exc)})


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


@router.get('/config/dashboard-filter-layouts', response_model=DashboardFilterLayoutsOut)
def get_dashboard_filter_layouts(
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:read')),
):
    norm = BrokersConfigService.get_dashboard_filter_layouts(db)
    return _dashboard_filter_layouts_out_from_normalized(norm)


@router.put('/config/dashboard-filter-layouts', response_model=DashboardFilterLayoutsOut)
def put_dashboard_filter_layouts(
    payload: DashboardFilterLayoutsPutIn,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('brokers:write_config')),
):
    body = {
        'version': payload.version,
        'sections': {
            k: v.model_dump(exclude_none=True) for k, v in payload.sections.items()
        },
    }
    norm = BrokersConfigService.save_dashboard_filter_layouts(db, body, str(user.get('sub', 'system')))
    return _dashboard_filter_layouts_out_from_normalized(norm)


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
