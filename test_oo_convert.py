import sys, os, json, urllib.request
sys.path.insert(0, os.path.abspath('backend'))
from jose import jwt

SECRET = "S6hGqch18ieb3n5yunIIfC9EuaGMwWM7"

# Try the convert API to test if ONLYOFFICE can fetch from our backend
from app.services.onlyoffice_drafts import build_access_token

# Create a fresh draft and get its source URL
import requests
# Login first
login_r = requests.post("http://127.0.0.1:8000/api/auth/login", json={"login": "master", "password": "password123"})
if login_r.status_code != 200:
    # Try form login
    login_r = requests.post("http://127.0.0.1:8000/api/auth/login", json={"username": "master", "password": "password123"})
print(f"Login status: {login_r.status_code}")
if login_r.status_code == 200:
    auth_token = login_r.json().get("access_token", "")
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Create draft
    dr = requests.post("http://127.0.0.1:8000/api/documents/drafts/create", 
                       json={"employee_id": "EMP053", "title": "ConnTest"},
                       headers=headers)
    print(f"Create draft: {dr.status_code}")
    if dr.status_code == 200:
        draft_id = dr.json()["draft_id"]
        
        # Get config  
        cr = requests.get(f"http://127.0.0.1:8000/api/documents/drafts/EMP053/{draft_id}/onlyoffice-config",
                         headers=headers)
        print(f"Get config: {cr.status_code}")
        if cr.status_code == 200:
            config = cr.json()["editor_config"]
            source_url = config["document"]["url"]
            print(f"Source URL: {source_url}")
            
            # Now ask ONLYOFFICE to try to convert/fetch this URL
            convert_payload = {
                "async": False,
                "url": source_url,
                "outputtype": "pdf",
                "filetype": "docx",
                "key": f"convert_test_{draft_id}"
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
                print(f"Convert Status: {resp.status}")
                print(f"Convert Response: {resp.read().decode()[:500]}")
            except Exception as e:
                print(f"Convert Error: {e}")
                if hasattr(e, 'read'):
                    print(f"Error Body: {e.read().decode()[:500]}")
