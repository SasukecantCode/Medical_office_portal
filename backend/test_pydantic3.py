from app.schemas.hr_staff import HRStaffCreate
try:
    obj = HRStaffCreate.model_validate({
        "full_name": "Test",
        "designation": "Test",
        "facility_name": "Test",
        "district": "Test",
        "date_of_joining": "12-05-2023"
    })
    print("Success!")
except Exception as e:
    print("Error:", e)
