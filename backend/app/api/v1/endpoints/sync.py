from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.deps import require_permission, write_rate_limiter
from app.schemas.sync import (
    SyncChunkLogsOut,
    SyncPerfSummaryOut,
    SyncPreviewOut,
    SyncRunIn,
    SyncRunOut,
    SyncStatusOut,
    SyncWatermarkOut,
    SyncWatermarkResetIn,
    SyncWatermarkResetOut,
)
from app.services.sync_service import SyncService

router = APIRouter()


@router.post('/run', response_model=SyncRunOut, status_code=202)
def run_sync(
    payload: SyncRunIn,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    actor = str(user.get('sub', 'system'))
    try:
        return SyncService.start(
            payload.domain,
            payload.year_from,
            payload.close_month,
            payload.close_month_from,
            payload.close_month_to,
            actor,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail={'message': str(exc)})


@router.post('/preview', response_model=SyncPreviewOut)
def preview_sync(
    payload: SyncRunIn,
    user=Depends(require_permission('brokers:read')),
):
    return SyncService.preview(
        payload.domain,
        payload.year_from,
        payload.close_month,
        payload.close_month_from,
        payload.close_month_to,
    )


@router.get('/status', response_model=SyncStatusOut)
def sync_status(
    domain: str = Query(min_length=3, max_length=32),
    job_id: str | None = Query(default=None),
    user=Depends(require_permission('brokers:read')),
):
    return SyncService.status(domain=domain.strip().lower(), job_id=job_id)


@router.get('/perf/summary', response_model=SyncPerfSummaryOut)
def sync_perf_summary(
    limit: int = Query(default=200, ge=20, le=1000),
    user=Depends(require_permission('brokers:read')),
):
    return SyncService.perf_summary(limit=limit)


@router.get('/watermarks', response_model=list[SyncWatermarkOut])
def sync_watermarks(
    domain: str | None = Query(default=None, min_length=3, max_length=32),
    user=Depends(require_permission('brokers:read')),
):
    normalized = domain.strip().lower() if isinstance(domain, str) else None
    return SyncService.list_watermarks(domain=normalized)


@router.post('/watermarks/reset', response_model=SyncWatermarkResetOut)
def reset_sync_watermarks(
    payload: SyncWatermarkResetIn,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    return SyncService.reset_watermarks(
        domain=payload.domain,
        query_file=payload.query_file,
        partition_key=payload.partition_key,
    )


@router.get('/chunks/{job_id}', response_model=SyncChunkLogsOut)
def sync_job_chunks(
    job_id: str,
    user=Depends(require_permission('brokers:read')),
):
    return SyncService.job_chunks(job_id=job_id)
