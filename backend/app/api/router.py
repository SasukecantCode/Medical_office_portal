from fastapi import APIRouter

from app.api.routes import dashboard, health, hr_staff

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(dashboard.router, tags=["dashboard"])
api_router.include_router(hr_staff.router, prefix="/hr", tags=["human-resources"])
