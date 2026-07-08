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
    if os.environ.get("ENVIRONMENT") != "dev":
        print("Error: Refusing to run outside of dev environment. Set ENVIRONMENT=dev.")
        sys.exit(1)
    if "--i-am-sure" not in sys.argv:
        print("Error: You must provide the --i-am-sure flag to run this script.")
        sys.exit(1)
    wipe_all()
