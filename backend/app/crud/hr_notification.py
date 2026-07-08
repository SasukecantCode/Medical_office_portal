from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.hr_notification import HRNotification
from app.models.hr_staff import HRStaff

def get_notifications(db: Session, status: str = None, skip: int = 0, limit: int = 100) -> List[HRNotification]:
    query = db.query(HRNotification)
    if status:
        query = query.filter(HRNotification.status == status)
    # Order by target_date ascending to show most urgent first
    return query.order_by(HRNotification.target_date.asc()).offset(skip).limit(limit).all()

def update_notification_status(db: Session, notification_id: int, new_status: str) -> HRNotification:
    notif = db.query(HRNotification).filter(HRNotification.id == notification_id).first()
    if notif:
        notif.status = new_status
        db.commit()
        db.refresh(notif)
    return notif

def generate_notifications(db: Session) -> dict:
    today = date.today()
    macp_threshold = today + relativedelta(months=2)
    retirement_threshold = today + relativedelta(months=6)

    # Only consider active (non-deleted) staff
    staff_records = db.query(HRStaff).filter(HRStaff.deleted_at.is_(None)).all()
    active_staff_ids = {s.id for s in staff_records}
    
    created_count = 0
    expired_count = 0
    
    # Track existing notifications so we don't duplicate
    existing_notifs = db.query(HRNotification).filter(HRNotification.status == "UNREAD").all()
    # Expire old ones or ones belonging to deleted staff
    for notif in existing_notifs:
        if notif.target_date < today or notif.staff_id not in active_staff_ids:
            notif.status = "EXPIRED"
            expired_count += 1
            
    db.commit()
    
    # Load all existing notifications to avoid recreating them
    # even if they are ACKNOWLEDGED or EXPIRED
    all_existing = db.query(HRNotification).all()
    
    existing_set = set()
    for n in all_existing:
        existing_set.add((n.staff_id, n.type, n.target_date))
        
    new_notifs = []
    
    for staff in staff_records:
        # Check MACP dates
        macp_dates = [staff.first_macp, staff.second_macp, staff.third_macp]
        for m_date in macp_dates:
            if m_date and today <= m_date <= macp_threshold:
                if (staff.id, "MACP", m_date) not in existing_set:
                    new_notifs.append(HRNotification(
                        staff_id=staff.id,
                        type="MACP",
                        target_date=m_date,
                        status="UNREAD"
                    ))
                    existing_set.add((staff.id, "MACP", m_date))
                    
        # Check Retirement
        if staff.date_of_retirement and today <= staff.date_of_retirement <= retirement_threshold:
            if (staff.id, "RETIREMENT", staff.date_of_retirement) not in existing_set:
                new_notifs.append(HRNotification(
                    staff_id=staff.id,
                    type="RETIREMENT",
                    target_date=staff.date_of_retirement,
                    status="UNREAD"
                ))
                existing_set.add((staff.id, "RETIREMENT", staff.date_of_retirement))
                
    if new_notifs:
        db.bulk_save_objects(new_notifs)
        db.commit()
        created_count += len(new_notifs)
        
    return {"created": created_count, "expired": expired_count}
