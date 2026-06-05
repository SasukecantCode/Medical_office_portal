from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class HRNotificationBase(BaseModel):
    staff_id: int
    type: str
    target_date: date
    status: str = "UNREAD"

class HRNotificationCreate(HRNotificationBase):
    pass

class HRNotificationUpdate(BaseModel):
    status: Optional[str] = None

class HRNotificationRead(HRNotificationBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # We will attach some staff info for the frontend
    staff_name: Optional[str] = None
    staff_display_id: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
