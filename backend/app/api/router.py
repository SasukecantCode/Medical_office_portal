from fastapi import APIRouter, Depends

from app.api.dependencies import require_roles
from app.api.routes import auth, dashboard, documents, health, hr_agent, hr_staff

api_router = APIRouter()

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(dashboard.router, tags=["dashboard"], dependencies=[Depends(require_roles("hr", "master"))])
api_router.include_router(hr_staff.router, prefix="/hr", tags=["human-resources"], dependencies=[Depends(require_roles("hr", "master"))])
api_router.include_router(hr_agent.router, prefix="/hr", tags=["agent"], dependencies=[Depends(require_roles("hr", "master"))])
api_router.include_router(documents.router, tags=["documents"], dependencies=[Depends(require_roles("hr", "master"))])
