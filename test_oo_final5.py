import sys, os, json, urllib.request
sys.path.insert(0, os.path.abspath('backend'))
from jose import jwt
import requests

SECRET = "S6hGqch18ieb3n5yunIIfC9EuaGMwWM7"

# Login
login_r = requests.post("http://127.0.0.1:8000/api/auth/login",
                       json={"login": "roshan", "role": "master", "password": "1234"})
if login_r.status_code == 200:
    auth_token = login_r.json()["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Create draft to ensure we have one in GCS
    dr = requests.post("http://127.0.0.1:8000/api/documents/drafts/create",
                       json={"employee_id": "EMP053", "title": "FinalTest5"},
                       headers=headers)
    print(f"Create draft: {dr.status_code}")
    if dr.status_code == 200:
        draft_id = dr.json()["draft_id"]
        print(f"Draft ID: {draft_id}")
        
        cr = requests.get(f"http://127.0.0.1:8000/api/documents/drafts/EMP053/{draft_id}/onlyoffice-config",
                         headers=headers)
        if cr.status_code == 200:
            config = cr.json()["editor_config"]
            source_url = config["document"]["url"]
            print(f"Source URL: {source_url}")
            
            # Direct download test to make sure backend serves it properly
            dl = requests.get(source_url)
            print(f"Direct download: {dl.status_code}, size={len(dl.content)}")
            if dl.status_code == 200:
                print(f"Downloaded content preview: {dl.content[:50]}...")
            
            # ONLYOFFICE convert test
            convert_payload = {
                "async": False,
                "url": source_url,
                "outputtype": "pdf",
                "filetype": "docx",
                "key": f"convtest_{draft_id}_v4"
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
                print(f"\n=== ONLYOFFICE Convert Result ===\n{body[:500]}")
            except Exception as e:
                print(f"\n=== ONLYOFFICE Convert ERROR ===\n{e}")
                if hasattr(e, 'read'):
                    print(f"Body: {e.read().decode()[:500]}")
else:
    print(f"Login failed: {login_r.status_code}")
