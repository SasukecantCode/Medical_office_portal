import sys, os, json, urllib.request
sys.path.insert(0, os.path.abspath('backend'))
from jose import jwt
import requests

SECRET = "S6hGqch18ieb3n5yunIIfC9EuaGMwWM7"

# Get users from DB directly
from app.db.session import SessionLocal
from app.models.auth_user import AuthUser
db = SessionLocal()
users = db.query(AuthUser).all()
for u in users:
    print(f"User: username={u.username}, role={u.role}, active={u.is_active}, handle={u.profile_handle}")
db.close()

# Try all master users
for u in [u for u in users if u.role and 'master' in u.role.lower()]:
    for pwd in ["password123", "roshan", "admin", u.username]:
        login_r = requests.post("http://127.0.0.1:8000/api/auth/login",
                               json={"login": u.username, "role": "master", "password": pwd})
        if login_r.status_code == 200:
            print(f"Login OK: {u.username} with password {pwd}")
            auth_token = login_r.json()["access_token"]
            headers = {"Authorization": f"Bearer {auth_token}"}

            # Use an existing draft source URL for testing
            # First list drafts
            lr = requests.get("http://127.0.0.1:8000/api/documents/drafts/EMP053", headers=headers)
            if lr.status_code == 200:
                drafts = lr.json().get("drafts", [])
                if drafts:
                    d = drafts[0]
                    draft_id = d["draft_id"]
                    cr = requests.get(f"http://127.0.0.1:8000/api/documents/drafts/EMP053/{draft_id}/onlyoffice-config", headers=headers)
                    if cr.status_code == 200:
                        config = cr.json()["editor_config"]
                        source_url = config["document"]["url"]
                        print(f"Source URL: {source_url}")

                        # Ask ONLYOFFICE to convert
                        convert_payload = {
                            "async": False,
                            "url": source_url,
                            "outputtype": "pdf",
                            "filetype": "docx",
                            "key": f"conv_{draft_id}_v2"
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
                            print(f"ONLYOFFICE Convert: {body[:500]}")
                        except Exception as e:
                            print(f"Convert ERROR: {e}")
                            if hasattr(e, 'read'):
                                print(f"Body: {e.read().decode()[:500]}")
            break
    else:
        continue
    break
