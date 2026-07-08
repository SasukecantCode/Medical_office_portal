from app.db.session import SessionLocal
from app.api.routes.hr_notifications import read_notifications
db = SessionLocal()
try:
    print(read_notifications("UNREAD", 0, 100, db))
except Exception as e:
    print(f"ERROR: {e}")
