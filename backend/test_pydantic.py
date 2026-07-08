from app.schemas.hr_staff import HRStaffCreate
try:
    obj = HRStaffCreate.model_validate({
        "full_name": "Test",
        "designation": "Test",
        "facility_name": "Test",
        "district": "Test",
        "appointment_order_number": "123"
    })
    print("Success!", obj.model_dump())
except Exception as e:
    print("Error:", e)
