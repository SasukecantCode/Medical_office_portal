import urllib.request, json
# we can just call the endpoint directly bypassing auth if we patch it, or use the database.
# Let's bypass auth for a quick test
from fastapi.testclient import TestClient
import sys, os
sys.path.append(os.path.abspath('backend'))
from app.main import app

client = TestClient(app)
# Need to login to get a token
resp = client.post("/api/auth/login", json={"username": "master", "password": "password123"})
if resp.status_code == 200:
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    # get staff
    s = client.get("/api/hr/staff", headers=headers)
    emp_id = f"EMP{str(s.json()[0]['id']).zfill(3)}"
    # create draft
    d = client.post("/api/documents/drafts/create", json={"employee_id": emp_id, "title": "Test"}, headers=headers)
    draft_id = d.json()["draft_id"]
    # get config
    c = client.get(f"/api/documents/drafts/{emp_id}/{draft_id}/onlyoffice-config", headers=headers)
    print(json.dumps(c.json(), indent=2))
else:
    print("Login failed", resp.text)
