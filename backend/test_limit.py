import sys
from app.db.session import SessionLocal
from app.crud.hr_staff import list_staff

db = SessionLocal()
items = list_staff(db, limit=1000)
print(f"Items fetched: {len(items)}")
db.close()
