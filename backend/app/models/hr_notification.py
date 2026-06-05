from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base

class HRNotification(Base):
    __tablename__ = "hr_notifications"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("hr_staff.id", ondelete="CASCADE"), index=True, nullable=False)
    
    # "MACP", "RETIREMENT"
    type = Column(String(50), nullable=False, index=True)
    
    target_date = Column(Date, nullable=False)
    
    # "UNREAD", "ACKNOWLEDGED", "EXPIRED"
    status = Column(String(20), default="UNREAD", nullable=False, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
