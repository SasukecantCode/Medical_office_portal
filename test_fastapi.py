import sys
import os
os.chdir("backend")
sys.path.insert(0, os.getcwd())

from fastapi.testclient import TestClient
from app.main import app
from app.api.dependencies import get_current_user

# Mock current user
class MockUser:
    id = 1
    role = "master"
    username = "testmaster"
    profile_handle = "master.testmaster"
    full_name = "Test Master"

app.dependency_overrides[get_current_user] = lambda: MockUser()

client = TestClient(app)
resp = client.post("/api/documents/drafts/create", json={"employee_id": "Test_EMP001", "title": "Test Title"})
print("Create status:", resp.status_code)
print("Create text:", resp.text)
if resp.status_code == 200:
    draft_id = resp.json()["draft_id"]
    r2 = client.get(f"/api/documents/drafts/Test_EMP001/{draft_id}/onlyoffice-config")
    print("Config status:", r2.status_code)
    print("Config text:", r2.text)

