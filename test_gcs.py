import json
from app.core.config import settings
from app.services.document_storage import GCSDocumentStorageService

service = GCSDocumentStorageService(settings.gcs_bucket_name)
print("Bucket exists:", service.bucket.exists())
print("Drafts:", service.list_employee_drafts("Roshan_Singha_EMP053"))
