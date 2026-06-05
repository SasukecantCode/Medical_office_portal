from fastapi import APIRouter, Depends

from app.api.dependencies import require_roles
from app.api.routes import auth, dashboard, documents, drafts, health, hr_agent, hr_staff, hr_notifications

api_router = APIRouter()

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(dashboard.router, tags=["dashboard"], dependencies=[Depends(require_roles("hr", "master"))])
api_router.include_router(hr_staff.router, prefix="/hr", tags=["human-resources"], dependencies=[Depends(require_roles("hr", "master"))])
api_router.include_router(hr_agent.router, prefix="/hr", tags=["agent"], dependencies=[Depends(require_roles("hr", "master"))])
api_router.include_router(documents.router, tags=["documents"], dependencies=[Depends(require_roles("hr", "master"))])
api_router.include_router(drafts.router, tags=["drafts"])
api_router.include_router(hr_notifications.router, prefix="/hr", tags=["hr_notifications"], dependencies=[Depends(require_roles("hr", "master"))])
