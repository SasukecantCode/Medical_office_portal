import os
import sys

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.hr_staff import HRStaff
from sqlalchemy import text

def encrypt_existing_fields():
    db = SessionLocal()
    try:
        staff_records = db.query(HRStaff).all()
        count = 0
        for staff in staff_records:
            updated = False
            # If it doesn't start with gAAAAA, it's plaintext
            if staff.aadhaar_number and not staff.aadhaar_number.startswith('gAAAAA'):
                staff.aadhaar_number = staff.aadhaar_number + "" # force modification
                updated = True
            if staff.pan_number and not staff.pan_number.startswith('gAAAAA'):
                staff.pan_number = staff.pan_number + ""
                updated = True
            
            if updated:
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(staff, "aadhaar_number")
                flag_modified(staff, "pan_number")
                count += 1
                
        db.commit()
        print(f"Successfully encrypted fields for {count} staff records.")
    except Exception as e:
        print(f"Error during encryption migration: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    if os.environ.get("FIELD_ENCRYPTION_KEY") is None:
        print("Warning: FIELD_ENCRYPTION_KEY is not set. Data will remain in plaintext or encryption will fail.")
    encrypt_existing_fields()
