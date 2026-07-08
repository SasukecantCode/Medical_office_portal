import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from app.db.session import engine
from app.models.hr_notification import HRNotification

def create_table():
    print("Creating hr_notifications table...")
    HRNotification.__table__.create(bind=engine, checkfirst=True)
    print("Table created successfully.")

if __name__ == "__main__":
    create_table()
