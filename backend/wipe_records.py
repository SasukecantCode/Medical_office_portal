import os
import sys

from app.db.session import SessionLocal
from app.crud.hr_staff import delete_all_staff

def wipe_all():
    db = SessionLocal()
    try:
        count = delete_all_staff(db)
        print(f"Wiped {count} staff records and their documents from GCS.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    wipe_all()
