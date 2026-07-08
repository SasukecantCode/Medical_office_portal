import sys, os, json, urllib.request
sys.path.insert(0, os.path.abspath('backend'))
from jose import jwt
import requests

SECRET = "S6hGqch18ieb3n5yunIIfC9EuaGMwWM7"

# Try different password formats
for pwd in ["password123", "roshan", "Roshan", "admin123", "1234", "master"]:
    r = requests.post("http://127.0.0.1:8000/api/auth/login",
                     json={"login": "roshan", "role": "master", "password": pwd})
    if r.status_code == 200:
        print(f"Password is: {pwd}")
        break
    print(f"  tried {pwd}: {r.status_code}")

# Use bcrypt to check from DB
from app.db.session import SessionLocal
from app.models.auth_user import AuthUser
import bcrypt
db = SessionLocal()
user = db.query(AuthUser).filter(AuthUser.username == "roshan").first()
print(f"Hashed pw: {user.password_hash[:30]}...")

# Just bypass auth and test ONLYOFFICE directly with a source URL we construct manually
from app.services.onlyoffice_drafts import build_access_token
from app.services.document_storage import get_document_storage_service

# List draft files on disk
import glob
draft_dirs = glob.glob("backend/uploads/.drafts/EMP*/*")
print(f"\nDraft dirs: {draft_dirs[:5]}")

if draft_dirs:
    # Get first draft
    parts = draft_dirs[0].split("/")
    emp_id = parts[-2]
    draft_id = parts[-1]
    
    access_token = build_access_token(emp_id, draft_id, "source")
    source_url = f"http://172.20.10.2:8000/api/documents/drafts/{emp_id}/{draft_id}/source?token={access_token}"
    print(f"\nSource URL: {source_url}")
    
    # Direct download test
    dl = requests.get(source_url)
    print(f"Direct download: {dl.status_code}, size={len(dl.content)}")
    
    # ONLYOFFICE convert test 
    convert_payload = {
        "async": False,
        "url": source_url,
        "outputtype": "pdf",
        "filetype": "docx",
        "key": f"convtest_{draft_id}_v3"
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
db.close()
