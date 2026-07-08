import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.hr_staff import HRStaff
from app.utils.normalization import normalize_staff_name

def main():
    db = SessionLocal()
    staff_records = db.query(HRStaff).all()
    
    updates_preview = []
    
    for staff in staff_records:
        old_name = staff.full_name
        if old_name:
            new_name = normalize_staff_name(old_name)
            if old_name != new_name:
                updates_preview.append((staff, old_name, new_name))
            
    if not updates_preview:
        print("No names require normalization. Everything is clean.")
        return
        
    print(f"Found {len(updates_preview)} records that need normalization:\n")
    for staff, old, new in updates_preview[:20]:
        print(f"  [ID: {staff.id}] {old}  -->  {new}")
        
    if len(updates_preview) > 20:
        print(f"  ... and {len(updates_preview) - 20} more")
        
    if len(sys.argv) > 1 and sys.argv[1] == '--apply':
        for staff, old, new in updates_preview:
            staff.full_name = new
        db.commit()
        print(f"\nSuccessfully updated {len(updates_preview)} records.")
    else:
        print("\nRun this script with '--apply' to commit these changes to the database.")

if __name__ == "__main__":
    main()
