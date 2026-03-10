from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import require_permission, write_rate_limiter
from app.schemas.sync import (
    AdminAnalyticsFreshnessOut,
    AdminAnalyticsOptionsConsistencyOut,
    AdminAnalyticsOptionsRebuildIn,
    AdminAnalyticsOptionsRebuildOut,
)
from app.services.sync_service import SyncService

router = APIRouter()


@router.get('/options/consistency', response_model=AdminAnalyticsOptionsConsistencyOut)
def options_consistency(
    _user=Depends(require_permission('system:read')),
):
    return SyncService.options_consistency()


@router.post('/options/rebuild', response_model=AdminAnalyticsOptionsRebuildOut)
def options_rebuild(
    payload: AdminAnalyticsOptionsRebuildIn,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    actor = str(user.get('sub', 'system'))
    try:
        return SyncService.rebuild_options(payload.scope, payload.months, actor)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get('/freshness', response_model=AdminAnalyticsFreshnessOut)
def analytics_freshness(
    _user=Depends(require_permission('system:read')),
):
    return SyncService.source_freshness()

