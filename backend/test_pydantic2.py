from app.schemas.hr_staff import HRStaffCreate
from datetime import datetime
try:
    obj = HRStaffCreate.model_validate({
        "full_name": "Test",
        "designation": "Test",
        "facility_name": "Test",
        "district": "Test",
        "date_of_joining": datetime(2023, 1, 1, 0, 0)
    })
    print("Success!", obj.model_dump())
except Exception as e:
    print("Error:", e)
