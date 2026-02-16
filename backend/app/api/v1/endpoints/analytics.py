from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.deps import require_permission, write_rate_limiter
from app.schemas.analytics import AnalyticsFilters, ExportRequest
from app.services.analytics_service import AnalyticsService

router = APIRouter()


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
        'rendimiento': '/analytics/performance/by-management-month',
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


@router.post('/portfolio/summary')
def portfolio_summary(filters: AnalyticsFilters, user=Depends(require_permission('analytics:read'))):
    return _call('/analytics/portfolio/summary', filters)


@router.post('/rendimiento/summary')
def rendimiento_summary(filters: AnalyticsFilters, user=Depends(require_permission('analytics:read'))):
    return _call('/analytics/performance/by-management-month', filters)


@router.post('/mora/summary')
def mora_summary(filters: AnalyticsFilters, user=Depends(require_permission('analytics:read'))):
    return _call('/analytics/movement/moroso-trend', filters)


@router.post('/brokers/summary')
def brokers_summary(filters: AnalyticsFilters, user=Depends(require_permission('analytics:read'))):
    return _call('/api/brokers/summary', filters)


@router.post('/export/csv')
def analytics_export_csv(
    payload: ExportRequest,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('analytics:export')),
):
    data = _call(_resolve_export_endpoint(payload.endpoint), payload.filters)
    csv_text = AnalyticsService.export_csv(data)
    return Response(content=csv_text, media_type='text/csv')


@router.post('/export/pdf')
def analytics_export_pdf(
    payload: ExportRequest,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('analytics:export')),
):
    data = _call(_resolve_export_endpoint(payload.endpoint), payload.filters)
    content = ('Analytics export\n\n' + str(data)).encode('utf-8')
    return Response(content=content, media_type='application/pdf')


@router.post('/export')
def analytics_export_legacy(
    payload: ExportRequest,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('analytics:export')),
):
    if payload.format == 'pdf':
        return analytics_export_pdf(payload, _rl, user)
    return analytics_export_csv(payload, _rl, user)
