import os
import sys

# Ensure backend is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from app.db.base import Base
from app.db.session import engine

# Import all models to register them with Base.metadata
from app.models.admin_access_log import AdminAccessLog
from app.models.auth_user import AuthUser
from app.models.auth_invite import AuthInvite
from app.models.hr_draft import HRDraft
from app.models.hr_staff import HRStaff
from app.models.hr_staff_attachment import HRStaffAttachment
from app.models.hr_field_def import HRFieldDef

def recreate():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Database recreated successfully.")

if __name__ == "__main__":
    recreate()
