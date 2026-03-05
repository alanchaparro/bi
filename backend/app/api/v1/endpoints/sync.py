from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import settings
from app.core.deps import require_permission, write_rate_limiter
from app.schemas.sync import (
    SyncChunkLogsOut,
    SyncPerfSummaryOut,
    SyncPreviewOut,
    SyncRunIn,
    SyncRunOut,
    SyncScheduleCreateIn,
    SyncScheduleOut,
    SyncScheduleUpdateIn,
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
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={'message': f'Sync run failed: {type(exc).__name__}: {str(exc)}'},
        )


@router.post('/preview', response_model=SyncPreviewOut)
def preview_sync(
    payload: SyncRunIn,
    sampled: bool = Query(default=False),
    sample_rows: int | None = Query(default=None, ge=1000, le=200000),
    timeout_seconds: int | None = Query(default=None, ge=2, le=60),
    user=Depends(require_permission('brokers:read')),
):
    if not settings.sync_preview_enabled:
        raise HTTPException(status_code=409, detail={'message': 'Preview de sincronizacion deshabilitado por configuracion.'})
    return SyncService.preview(
        payload.domain,
        payload.year_from,
        payload.close_month,
        payload.close_month_from,
        payload.close_month_to,
        sampled=sampled,
        sample_rows=sample_rows,
        timeout_seconds=timeout_seconds,
    )


@router.get('/status', response_model=SyncStatusOut)
def sync_status(
    domain: str = Query(min_length=3, max_length=32),
    job_id: str | None = Query(default=None),
    user=Depends(require_permission('brokers:read')),
):
    try:
        return SyncService.status(domain=domain.strip().lower(), job_id=job_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={'message': f'Sync status failed: {type(exc).__name__}: {str(exc)}'},
        )


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


# --- Schedules (cron-like) ---

@router.get('/schedules', response_model=list[SyncScheduleOut])
def list_schedules(
    user=Depends(require_permission('brokers:read')),
):
    return SyncService.list_schedules()


@router.get('/schedules/{schedule_id}', response_model=SyncScheduleOut)
def get_schedule(
    schedule_id: int,
    user=Depends(require_permission('brokers:read')),
):
    out = SyncService.get_schedule(schedule_id)
    if out is None:
        raise HTTPException(status_code=404, detail='Schedule not found')
    return out


@router.post('/schedules', response_model=SyncScheduleOut, status_code=201)
def create_schedule(
    payload: SyncScheduleCreateIn,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    if payload.interval_unit == 'minute' and payload.interval_value < 10:
        raise HTTPException(status_code=400, detail='El intervalo minimo es 10 minutos')
    try:
        created = SyncService.create_schedule(
            name=payload.name,
            interval_value=payload.interval_value,
            interval_unit=payload.interval_unit,
            domains=payload.domains,
            mode=None,
            year_from=None,
            close_month=None,
            close_month_from=None,
            close_month_to=None,
            enabled=True,
        )
        return SyncService.get_schedule(created['id'])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch('/schedules/{schedule_id}', response_model=SyncScheduleOut)
def update_schedule(
    schedule_id: int,
    payload: SyncScheduleUpdateIn,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    try:
        out = SyncService.update_schedule(
            schedule_id,
            name=payload.name,
            interval_value=payload.interval_value,
            interval_unit=payload.interval_unit,
            domains=payload.domains,
            mode=payload.mode,
            year_from=payload.year_from,
            close_month=payload.close_month,
            close_month_from=payload.close_month_from,
            close_month_to=payload.close_month_to,
            enabled=payload.enabled,
            paused=payload.paused,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if out is None:
        raise HTTPException(status_code=404, detail='Schedule not found')
    full = SyncService.get_schedule(schedule_id)
    return full


@router.delete('/schedules/{schedule_id}', status_code=204)
def delete_schedule(
    schedule_id: int,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    if not SyncService.delete_schedule(schedule_id):
        raise HTTPException(status_code=404, detail='Schedule not found')


@router.post('/schedules/{schedule_id}/run-now')
def run_schedule_now(
    schedule_id: int,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    out = SyncService.run_schedule_now(schedule_id)
    if out is None:
        raise HTTPException(status_code=404, detail='Schedule not found')
    return out


@router.post('/schedules/{schedule_id}/pause', status_code=204)
def pause_schedule(
    schedule_id: int,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    if not SyncService.pause_schedule(schedule_id):
        raise HTTPException(status_code=404, detail='Schedule not found')


@router.post('/schedules/{schedule_id}/resume', status_code=204)
def resume_schedule(
    schedule_id: int,
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    if not SyncService.resume_schedule(schedule_id):
        raise HTTPException(status_code=404, detail='Schedule not found')


@router.post('/schedules/emergency-stop', status_code=204)
def emergency_stop_schedules(
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    SyncService.emergency_stop_schedules()


@router.post('/schedules/emergency-resume', status_code=204)
def emergency_resume_schedules(
    _rl=Depends(write_rate_limiter),
    user=Depends(require_permission('brokers:write_config')),
):
    SyncService.emergency_resume_schedules()
