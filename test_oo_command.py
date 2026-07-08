import sys, os, json
sys.path.insert(0, os.path.abspath('backend'))
from jose import jwt

SECRET = "S6hGqch18ieb3n5yunIIfC9EuaGMwWM7"

# Build a minimal config
config = {
    "documentType": "word",
    "document": {
        "fileType": "docx",
        "key": "testkey123",
        "title": "test.docx",
        "url": "http://172.20.10.2:8000/api/health"
    },
    "editorConfig": {
        "mode": "edit",
        "callbackUrl": "http://172.20.10.2:8000/api/health"
    }
}

token = jwt.encode(config, SECRET, algorithm="HS256")
config["token"] = token

# Now send this to the ONLYOFFICE command API to test if it accepts our JWT
import urllib.request
cmd_payload = json.dumps({
    "c": "info",
    "key": "testkey123"
}).encode()

cmd_token = jwt.encode({"c": "info", "key": "testkey123"}, SECRET, algorithm="HS256")

req = urllib.request.Request(
    "http://localhost:8080/coauthoring/CommandService.ashx",
    data=cmd_payload,
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cmd_token}"
    }
)
try:
    resp = urllib.request.urlopen(req, timeout=5)
    print(f"Status: {resp.status}")
    body = resp.read().decode()
    print(f"Response: {body}")
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(f"Body: {e.read().decode()}")
