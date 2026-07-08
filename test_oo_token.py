import sys, os, json, urllib.request
sys.path.insert(0, os.path.abspath('backend'))
import requests
from jose import jwt

SECRET = "S6hGqch18ieb3n5yunIIfC9EuaGMwWM7"

login_r = requests.post("http://127.0.0.1:8000/api/auth/login",
                       json={"login": "roshan", "role": "master", "password": "1234"})
auth_token = login_r.json()["access_token"]
headers = {"Authorization": f"Bearer {auth_token}"}

dr = requests.post("http://127.0.0.1:8000/api/documents/drafts/create",
                   json={"employee_id": "EMP053", "title": "TokenTest"},
                   headers=headers)
draft_id = dr.json()["draft_id"]

cr = requests.get(f"http://127.0.0.1:8000/api/documents/drafts/EMP053/{draft_id}/onlyoffice-config",
                 headers=headers)
config = cr.json()["editor_config"]
token = config.get("token")

print(f"Token present: {bool(token)}")
if token:
    try:
        decoded = jwt.decode(token, SECRET, algorithms=["HS256"])
        print("Backend token signature MATCHES our secret!")
    except Exception as e:
        print(f"Backend token signature DOES NOT MATCH: {e}")
        
    try:
        from app.core.config import settings
        decoded = jwt.decode(token, settings.auth_jwt_secret_key, algorithms=["HS256"])
        print("Wait, backend signed it with auth_jwt_secret_key!")
    except:
        pass
