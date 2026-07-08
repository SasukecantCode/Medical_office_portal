import sys, os, json, urllib.request
sys.path.insert(0, os.path.abspath('backend'))
from jose import jwt
import requests

SECRET = "S6hGqch18ieb3n5yunIIfC9EuaGMwWM7"

# Login using the correct field name
login_r = requests.post("http://127.0.0.1:8000/api/auth/login", json={"login": "admin.master", "password": "password123"})
print(f"Login: {login_r.status_code}")
if login_r.status_code != 200:
    login_r = requests.post("http://127.0.0.1:8000/api/auth/login", json={"login": "master", "password": "password123"})
    print(f"Login retry: {login_r.status_code}")

if login_r.status_code == 200:
    auth_token = login_r.json()["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    dr = requests.post("http://127.0.0.1:8000/api/documents/drafts/create",
                       json={"employee_id": "EMP053", "title": "FinalTest"},
                       headers=headers)
    print(f"Create draft: {dr.status_code}")
    draft_id = dr.json()["draft_id"]
    
    cr = requests.get(f"http://127.0.0.1:8000/api/documents/drafts/EMP053/{draft_id}/onlyoffice-config",
                     headers=headers)
    config = cr.json()["editor_config"]
    source_url = config["document"]["url"]
    print(f"Source URL: {source_url}")
    
    # Test 1: Can WE download it?
    dl = requests.get(source_url)
    print(f"Direct download: {dl.status_code}, size={len(dl.content)} bytes")
    
    # Test 2: Ask ONLYOFFICE to convert (this forces it to download the file)
    convert_payload = {
        "async": False,
        "url": source_url,
        "outputtype": "pdf",
        "filetype": "docx",
        "key": f"conv_{draft_id}"
    }
    convert_token = jwt.encode(convert_payload, SECRET, algorithm="HS256")
    
    req = urllib.request.Request(
        "http://localhost:8080/ConvertService.ashx",
        data=json.dumps(convert_payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {convert_token}"
        }
    )
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        body = resp.read().decode()
        print(f"Convert: {resp.status} -> {body[:300]}")
    except Exception as e:
        print(f"Convert error: {e}")
        if hasattr(e, 'read'):
            print(f"Body: {e.read().decode()[:300]}")
