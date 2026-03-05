from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.analytics_cache import get as cache_get, set as cache_set
from app.core.deps import require_permission, write_rate_limiter
from app.db.session import get_db
from app.schemas.analytics import (
    AnalyticsFilters,
    CobranzasCohorteDetailIn,
    CobranzasCohorteFirstPaintIn,
    CobranzasCohorteIn,
    CobranzasCohorteOptionsOut,
    ExportRequest,
    PortfolioCorteOptionsOut,
    PortfolioCorteSummaryOut,
    PortfolioOptionsOut,
    PortfolioSummaryIn,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter()
BROKERS_SUMMARY_CACHE_TTL = 60
PORTFOLIO_OPTIONS_CACHE_TTL = 600
PORTFOLIO_SUMMARY_CACHE_TTL = 180
PORTFOLIO_CORTE_OPTIONS_CACHE_TTL = 600
PORTFOLIO_CORTE_SUMMARY_CACHE_TTL = 180
COHORTE_OPTIONS_CACHE_TTL = 1800
COHORTE_SUMMARY_CACHE_TTL = 300
RENDIMIENTO_SUMMARY_CACHE_TTL = 120
RENDIMIENTO_OPTIONS_CACHE_TTL = 600
MORA_SUMMARY_CACHE_TTL = 120
ANUALES_OPTIONS_CACHE_TTL = 600
ANUALES_SUMMARY_CACHE_TTL = 120
RENDIMIENTO_V2_OPTIONS_CACHE_TTL = 120
RENDIMIENTO_V2_SUMMARY_CACHE_TTL = 180
ANUALES_V2_OPTIONS_CACHE_TTL = 120
ANUALES_V2_SUMMARY_CACHE_TTL = 180
COHORTE_V2_FIRST_PAINT_CACHE_TTL = 300
COHORTE_V2_DETAIL_CACHE_TTL = 300
PORTFOLIO_CORTE_V2_FIRST_PAINT_CACHE_TTL = 180
RENDIMIENTO_V2_FIRST_PAINT_CACHE_TTL = 180
ANUALES_V2_FIRST_PAINT_CACHE_TTL = 180


def _call(endpoint: str, filters: AnalyticsFilters):
    try:
        return AnalyticsService.fetch_legacy(endpoint, filters)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={
                'error_code': 'ANALYTICS_BACKEND_ERROR',
                'message': 'No se pudo obtener analytics legacy',
                'details': str(exc),
            },
        )


def _resolve_export_endpoint(name: str) -> str:
    endpoint_map = {
        'portfolio': '/analytics/portfolio/summary',
        'rendimiento': '/analytics/rendimiento/summary',
        'mora': '/analytics/movement/moroso-trend',
        'brokers': '/api/brokers/summary',
    }
    endpoint = endpoint_map.get(name)
    if not endpoint:
        raise HTTPException(
            status_code=400,
            detail={
                'error_code': 'INVALID_EXPORT_ENDPOINT',
                'message': 'endpoint invalido',
                'details': {'allowed': list(endpoint_map.keys())},
            },
        )
    return endpoint


def _load_export_payload(db: Session, payload: ExportRequest) -> dict:
    if payload.endpoint == 'brokers':
        return AnalyticsService.fetch_brokers_summary_v1(db, payload.filters)
    if payload.endpoint == 'rendimiento':
        return AnalyticsService.fetch_rendimiento_summary_v1(db, payload.filters)
    return _call(_resolve_export_endpoint(payload.endpoint), payload.filters)


def _decorate_meta(db: Session, payload: dict, *, cache_hit: bool, source_table: str | None = None) -> dict:
    return AnalyticsService.attach_meta(db, payload, cache_hit=cache_hit, source_table=source_table)


@router.post('/portfolio/options', response_model=PortfolioOptionsOut)
def portfolio_options(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('portfolio/options', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True)
    result = AnalyticsService.fetch_portfolio_options_v1(db, filters)
    cache_set('portfolio/options', filters, result, ttl_seconds=PORTFOLIO_OPTIONS_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False)


@router.post('/portfolio/summary')
def portfolio_summary(
    filters: PortfolioSummaryIn,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    # Dashboard path: cache only lightweight summary mode (without rows payload).
    if not bool(filters.include_rows):
        cached = cache_get('portfolio/summary', filters)
        if cached is not None:
            return _decorate_meta(db, cached, cache_hit=True)
        result = AnalyticsService.fetch_portfolio_summary_v1(db, filters)
        cache_set('portfolio/summary', filters, result, ttl_seconds=PORTFOLIO_SUMMARY_CACHE_TTL)
        return _decorate_meta(db, result, cache_hit=False)
    return _decorate_meta(db, AnalyticsService.fetch_portfolio_summary_v1(db, filters), cache_hit=False)


@router.post('/portfolio/corte/options', response_model=PortfolioCorteOptionsOut)
def portfolio_corte_options(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('portfolio/corte/options', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True)
    result = AnalyticsService.fetch_portfolio_corte_options_v2(db, filters)
    cache_set('portfolio/corte/options', filters, result, ttl_seconds=PORTFOLIO_CORTE_OPTIONS_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False)


@router.post('/portfolio/corte/summary', response_model=PortfolioCorteSummaryOut)
def portfolio_corte_summary(
    filters: PortfolioSummaryIn,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    if not bool(filters.include_rows):
        cached = cache_get('portfolio/corte/summary', filters)
        if cached is not None:
            return _decorate_meta(db, cached, cache_hit=True)
        result = AnalyticsService.fetch_portfolio_corte_summary_v2(db, filters)
        cache_set('portfolio/corte/summary', filters, result, ttl_seconds=PORTFOLIO_CORTE_SUMMARY_CACHE_TTL)
        return _decorate_meta(db, result, cache_hit=False)
    return _decorate_meta(db, AnalyticsService.fetch_portfolio_corte_summary_v2(db, filters), cache_hit=False)


@router.post('/portfolio-corte-v2/first-paint')
def portfolio_corte_first_paint_v2(
    filters: PortfolioSummaryIn,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('portfolio-corte-v2/first-paint', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True, source_table='cartera_corte_agg')
    result = AnalyticsService.fetch_portfolio_corte_first_paint_v2(db, filters)
    cache_set('portfolio-corte-v2/first-paint', filters, result, ttl_seconds=PORTFOLIO_CORTE_V2_FIRST_PAINT_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False, source_table='cartera_corte_agg')


@router.post('/rendimiento/summary')
def rendimiento_summary(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('rendimiento/summary', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True)
    result = AnalyticsService.fetch_rendimiento_summary_v1(db, filters)
    cache_set('rendimiento/summary', filters, result, ttl_seconds=RENDIMIENTO_SUMMARY_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False)


@router.post('/rendimiento/options')
def rendimiento_options(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('rendimiento/options', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True)
    result = AnalyticsService.fetch_rendimiento_options_v1(db, filters)
    cache_set('rendimiento/options', filters, result, ttl_seconds=RENDIMIENTO_OPTIONS_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False)


@router.post('/rendimiento-v2/summary')
def rendimiento_summary_v2(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('rendimiento-v2/summary', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True, source_table='analytics_rendimiento_agg')
    result = AnalyticsService.fetch_rendimiento_summary_v2(db, filters)
    cache_set('rendimiento-v2/summary', filters, result, ttl_seconds=RENDIMIENTO_V2_SUMMARY_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False, source_table='analytics_rendimiento_agg')


@router.post('/rendimiento-v2/first-paint')
def rendimiento_first_paint_v2(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('rendimiento-v2/first-paint', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True, source_table='analytics_rendimiento_agg')
    result = AnalyticsService.fetch_rendimiento_first_paint_v2(db, filters)
    cache_set('rendimiento-v2/first-paint', filters, result, ttl_seconds=RENDIMIENTO_V2_FIRST_PAINT_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False, source_table='analytics_rendimiento_agg')


@router.post('/rendimiento-v2/options')
def rendimiento_options_v2(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('rendimiento-v2/options', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True, source_table='analytics_rendimiento_agg')
    result = AnalyticsService.fetch_rendimiento_options_v2(db, filters)
    cache_set('rendimiento-v2/options', filters, result, ttl_seconds=RENDIMIENTO_V2_OPTIONS_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False, source_table='analytics_rendimiento_agg')


@router.post('/anuales/options')
def anuales_options(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('anuales/options', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True)
    result = AnalyticsService.fetch_anuales_options_v1(db, filters)
    cache_set('anuales/options', filters, result, ttl_seconds=ANUALES_OPTIONS_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False)


@router.post('/anuales/summary')
def anuales_summary(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('anuales/summary', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True)
    result = AnalyticsService.fetch_anuales_summary_v1(db, filters)
    cache_set('anuales/summary', filters, result, ttl_seconds=ANUALES_SUMMARY_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False)


@router.post('/anuales-v2/options')
def anuales_options_v2(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('anuales-v2/options', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True, source_table='analytics_anuales_agg + dim_negocio_contrato')
    result = AnalyticsService.fetch_anuales_options_v2(db, filters)
    cache_set('anuales-v2/options', filters, result, ttl_seconds=ANUALES_V2_OPTIONS_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False, source_table='analytics_anuales_agg + dim_negocio_contrato')


@router.post('/anuales-v2/summary')
def anuales_summary_v2(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('anuales-v2/summary', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True, source_table='analytics_anuales_agg')
    result = AnalyticsService.fetch_anuales_summary_v2(db, filters)
    cache_set('anuales-v2/summary', filters, result, ttl_seconds=ANUALES_V2_SUMMARY_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False, source_table='analytics_anuales_agg')


@router.post('/anuales-v2/first-paint')
def anuales_first_paint_v2(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('anuales-v2/first-paint', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True, source_table='analytics_anuales_agg')
    result = AnalyticsService.fetch_anuales_first_paint_v2(db, filters)
    cache_set('anuales-v2/first-paint', filters, result, ttl_seconds=ANUALES_V2_FIRST_PAINT_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False, source_table='analytics_anuales_agg')


@router.post('/mora/summary')
def mora_summary(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('mora/summary', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True)
    try:
        result = _call('/analytics/movement/moroso-trend', filters)
    except HTTPException:
        result = AnalyticsService.empty_mora_summary_v1(filters, reason='legacy_mora_unavailable')
    cache_set('mora/summary', filters, result, ttl_seconds=MORA_SUMMARY_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False)


@router.post('/brokers/summary')
def brokers_summary(
    filters: AnalyticsFilters,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('brokers/summary', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True, source_table='analytics_contract_snapshot')
    result = AnalyticsService.fetch_brokers_summary_v1(db, filters)
    cache_set('brokers/summary', filters, result, ttl_seconds=BROKERS_SUMMARY_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False, source_table='analytics_contract_snapshot')


@router.post('/cobranzas-cohorte/options', response_model=CobranzasCohorteOptionsOut)
def cobranzas_cohorte_options(
    filters: CobranzasCohorteIn,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('cobranzas-cohorte/options', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True)
    result = AnalyticsService.fetch_cobranzas_cohorte_options_v1(db, filters)
    cache_set('cobranzas-cohorte/options', filters, result, ttl_seconds=COHORTE_OPTIONS_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False)


@router.post('/cobranzas-cohorte/summary')
def cobranzas_cohorte_summary(
    filters: CobranzasCohorteIn,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('cobranzas-cohorte/summary', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True)
    result = AnalyticsService.fetch_cobranzas_cohorte_summary_v1(db, filters)
    cache_set('cobranzas-cohorte/summary', filters, result, ttl_seconds=COHORTE_SUMMARY_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False)


@router.post('/cobranzas-cohorte-v2/first-paint')
def cobranzas_cohorte_first_paint_v2(
    filters: CobranzasCohorteFirstPaintIn,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('cobranzas-cohorte-v2/first-paint', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True, source_table='cobranzas_cohorte_agg')
    result = AnalyticsService.fetch_cobranzas_cohorte_first_paint_v2(db, filters)
    cache_set('cobranzas-cohorte-v2/first-paint', filters, result, ttl_seconds=COHORTE_V2_FIRST_PAINT_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False, source_table='cobranzas_cohorte_agg')


@router.post('/cobranzas-cohorte-v2/detail')
def cobranzas_cohorte_detail_v2(
    filters: CobranzasCohorteDetailIn,
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:read')),
):
    cached = cache_get('cobranzas-cohorte-v2/detail', filters)
    if cached is not None:
        return _decorate_meta(db, cached, cache_hit=True, source_table='cobranzas_cohorte_agg')
    result = AnalyticsService.fetch_cobranzas_cohorte_detail_v2(db, filters)
    cache_set('cobranzas-cohorte-v2/detail', filters, result, ttl_seconds=COHORTE_V2_DETAIL_CACHE_TTL)
    return _decorate_meta(db, result, cache_hit=False, source_table='cobranzas_cohorte_agg')


@router.post('/export/csv')
def analytics_export_csv(
    payload: ExportRequest,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:export')),
):
    data = _load_export_payload(db, payload)
    csv_text = AnalyticsService.export_csv(data)
    return Response(content=csv_text, media_type='text/csv')


@router.post('/export/pdf')
def analytics_export_pdf(
    payload: ExportRequest,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:export')),
):
    data = _load_export_payload(db, payload)
    content = ('Analytics export\n\n' + str(data)).encode('utf-8')
    return Response(content=content, media_type='application/pdf')


@router.post('/export')
def analytics_export_legacy(
    payload: ExportRequest,
    _rl=Depends(write_rate_limiter),
    db: Session = Depends(get_db),
    user=Depends(require_permission('analytics:export')),
):
    if payload.format == 'pdf':
        return analytics_export_pdf(payload, _rl, db, user)
    return analytics_export_csv(payload, _rl, db, user)
