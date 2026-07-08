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
r_list = client.get("/api/documents/drafts/Test_EMP001")
print("List status:", r_list.status_code)
print("List text:", r_list.text)

