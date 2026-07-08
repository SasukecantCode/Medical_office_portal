import urllib.request, json
from fastapi.testclient import TestClient
import sys, os
sys.path.append(os.path.abspath('backend'))
from app.main import app

client = TestClient(app)
resp = client.post("/api/auth/login", data={"username": "master", "password": "password123"})
if resp.status_code == 200:
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    s = client.get("/api/hr/staff", headers=headers)
    emp_id = f"EMP{str(s.json()[0]['id']).zfill(3)}"
    d = client.post("/api/documents/drafts/create", json={"employee_id": emp_id, "title": "TestDownload"}, headers=headers)
    draft_id = d.json()["draft_id"]
    c = client.get(f"/api/documents/drafts/{emp_id}/{draft_id}/onlyoffice-config", headers=headers)
    url = c.json()['editor_config']['document']['url']
    print("URL:", url)
    
    from urllib.parse import urlparse
    path = urlparse(url).path + "?" + urlparse(url).query
    r_source = client.get(path)
    print("Source Status:", r_source.status_code)
    print("Source Content-Type:", r_source.headers.get("content-type"))
    print("Source Content-Length:", len(r_source.content))
else:
    print("Login failed", resp.text)
