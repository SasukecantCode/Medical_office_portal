import sys, os, json, urllib.request
sys.path.insert(0, os.path.abspath('backend'))
from jose import jwt
import requests

SECRET = "S6hGqch18ieb3n5yunIIfC9EuaGMwWM7"

# Login requires role in format "admin.master.username"
login_r = requests.post("http://127.0.0.1:8000/api/auth/login", 
                       json={"login": "admin.master.roshan", "password": "roshan"})
print(f"Login: {login_r.status_code} {login_r.text[:200]}")

if login_r.status_code != 200:
    # Try to find a working login - use the DB directly
    from app.db.session import SessionLocal
    from app.models.auth import AuthUser
    db = SessionLocal()
    users = db.query(AuthUser).filter(AuthUser.role == "master").all()
    for u in users:
        print(f"  Master user: {u.username} (role={u.role}, active={u.is_active})")
        login_r = requests.post("http://127.0.0.1:8000/api/auth/login",
                               json={"login": f"admin.master.{u.username}", "password": "password123"})
        if login_r.status_code == 200:
            print(f"  -> Login OK!")
            break
        login_r = requests.post("http://127.0.0.1:8000/api/auth/login",
                               json={"login": u.username, "role": "master", "password": "password123"})
        if login_r.status_code == 200:
            print(f"  -> Login OK with role!")
            break
    db.close()

if login_r.status_code == 200:
    auth_token = login_r.json()["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    dr = requests.post("http://127.0.0.1:8000/api/documents/drafts/create",
                       json={"employee_id": "EMP053", "title": "FinalTest2"},
                       headers=headers)
    print(f"Create draft: {dr.status_code}")
    draft_id = dr.json()["draft_id"]
    
    cr = requests.get(f"http://127.0.0.1:8000/api/documents/drafts/EMP053/{draft_id}/onlyoffice-config",
                     headers=headers)
    config = cr.json()["editor_config"]
    source_url = config["document"]["url"]
    print(f"Source URL: {source_url}")
    
    # Ask ONLYOFFICE ConvertService to download and convert our file
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
        print(f"ONLYOFFICE Convert result: {body[:500]}")
    except Exception as e:
        print(f"ONLYOFFICE Convert ERROR: {e}")
        if hasattr(e, 'read'):
            print(f"Error body: {e.read().decode()[:500]}")
else:
    print("Could not login, skipping ONLYOFFICE test")
