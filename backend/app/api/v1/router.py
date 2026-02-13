from fastapi import APIRouter

from app.api.v1.endpoints import auth, brokers, health

router = APIRouter(prefix='/api/v1')
router.include_router(health.router, tags=['health'])
router.include_router(auth.router, prefix='/auth', tags=['auth'])
router.include_router(brokers.router, prefix='/brokers', tags=['brokers'])
