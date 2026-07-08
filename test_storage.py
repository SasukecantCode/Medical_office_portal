import os
import sys

# change directory to backend so imports work
os.chdir("backend")
sys.path.insert(0, os.getcwd())

from app.services.document_storage import get_document_storage_service

def test():
    try:
        storage = get_document_storage_service()
        print("Storage initialized")
        drafts = storage.list_employee_drafts("TestUser_EMP001")
        print("Drafts:", drafts)
    except Exception as e:
        import traceback
        traceback.print_exc()

test()
