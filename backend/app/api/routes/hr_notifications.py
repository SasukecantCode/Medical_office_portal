from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db

from app.crud.hr_notification import get_notifications, update_notification_status, generate_notifications
from app.schemas.hr_notification import HRNotificationRead, HRNotificationUpdate
from app.models.hr_staff import HRStaff

router = APIRouter(prefix="/notifications")

@router.post("/generate")
def auto_generate(db: Session = Depends(get_db)):
    return generate_notifications(db)

@router.get("", response_model=List[HRNotificationRead])
def read_notifications(status: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    notifs = get_notifications(db, status=status, skip=skip, limit=limit)
    
    results = []
    for n in notifs:
        # Only attach staff info if the staff is active (not soft-deleted)
        staff = db.query(HRStaff).filter(HRStaff.id == n.staff_id, HRStaff.deleted_at.is_(None)).first()
        if not staff:
            continue
            
        r = HRNotificationRead.model_validate(n)
        r.staff_name = staff.full_name
        r.staff_display_id = f"NDMO/ESTT/{staff.id:03d}"
        results.append(r)
        
    return results

@router.patch("/{notification_id}/acknowledge", response_model=HRNotificationRead)
def acknowledge_notification(notification_id: int, db: Session = Depends(get_db)):
    notif = update_notification_status(db, notification_id, "ACKNOWLEDGED")
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    r = HRNotificationRead.model_validate(notif)
    staff = db.query(HRStaff).filter(HRStaff.id == notif.staff_id).first()
    if staff:
        r.staff_name = staff.full_name
        r.staff_display_id = f"NDMO/ESTT/{staff.id:03d}"
    return r
