from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.deps import require_permission
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


@router.post('/export')
def analytics_export(payload: ExportRequest, user=Depends(require_permission('analytics:export'))):
    endpoint_map = {
        'portfolio': '/analytics/portfolio/summary',
        'rendimiento': '/analytics/performance/by-management-month',
        'mora': '/analytics/movement/moroso-trend',
        'brokers': '/api/brokers/summary',
    }
    endpoint = endpoint_map.get(payload.endpoint)
    if not endpoint:
        raise HTTPException(
            status_code=400,
            detail={
                'error_code': 'INVALID_EXPORT_ENDPOINT',
                'message': 'endpoint inválido',
                'details': {'allowed': list(endpoint_map.keys())},
            },
        )

    data = _call(endpoint, payload.filters)
    if payload.format == 'pdf':
        # Placeholder textual PDF content for current sprint.
        content = ('Analytics export\n\n' + str(data)).encode('utf-8')
        return Response(content=content, media_type='application/pdf')

    csv_text = AnalyticsService.export_csv(data)
    return Response(content=csv_text, media_type='text/csv')
