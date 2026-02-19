from fastapi import APIRouter

from app.api.v1.endpoints import analytics, auth, brokers, health, sync

router = APIRouter(prefix='/api/v1')
router.include_router(health.router, tags=['health'])
router.include_router(auth.router, prefix='/auth', tags=['auth'])
router.include_router(brokers.router, prefix='/brokers', tags=['brokers'])
router.include_router(analytics.router, prefix='/analytics', tags=['analytics'])
router.include_router(sync.router, prefix='/sync', tags=['sync'])
