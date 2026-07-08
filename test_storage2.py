import asyncio
import os
import sys

os.chdir("backend")
sys.path.insert(0, os.getcwd())

from app.services.document_storage import get_document_storage_service
from app.services.onlyoffice_drafts import build_blank_docx_bytes

def test():
    try:
        storage = get_document_storage_service()
        print("Storage initialized")
        draft = storage.create_employee_draft("TestUser_EMP001", "Test Title", build_blank_docx_bytes("Title"))
        print("Draft created:", draft)
    except Exception as e:
        import traceback
        traceback.print_exc()

test()
