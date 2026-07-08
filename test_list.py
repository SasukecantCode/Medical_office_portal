import json
from app.services.document_storage import LocalDocumentStorageService

storage = LocalDocumentStorageService("uploads")
drafts = storage.list_employee_drafts("Roshan_Singha_EMP053")
print("Drafts:", drafts)
