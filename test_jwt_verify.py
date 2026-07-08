import sys, os
sys.path.insert(0, os.path.abspath('backend'))

from jose import jwt

# The secret ONLYOFFICE actually uses (from local.json)
OO_SECRET = "S6hGqch18ieb3n5yunIIfC9EuaGMwWM7"

# What our backend is configured with
from app.core.config import settings
OUR_SECRET = settings.onlyoffice_jwt_secret

print(f"Our backend secret:     [{OUR_SECRET}]")
print(f"ONLYOFFICE secret:      [{OO_SECRET}]")
print(f"Secrets match:          {OUR_SECRET == OO_SECRET}")
print()

# Build a sample config like our backend does
config = {
    "documentType": "word",
    "document": {"fileType": "docx", "key": "test", "title": "test.docx", "url": "http://example.com/test.docx"},
    "editorConfig": {"mode": "edit"}
}

# Sign with OUR secret
our_token = jwt.encode(config, OUR_SECRET, algorithm="HS256")
print(f"Token signed with our secret: {our_token[:50]}...")

# Try to decode with ONLYOFFICE secret
try:
    decoded = jwt.decode(our_token, OO_SECRET, algorithms=["HS256"])
    print(f"✅ ONLYOFFICE CAN verify our token!")
except Exception as e:
    print(f"❌ ONLYOFFICE CANNOT verify our token: {e}")

# Now test: what does the actual running backend produce?
import requests
r = requests.get("http://127.0.0.1:8000/api/documents/drafts/EMP053/06448137946b4a07a30111016d32afdd/onlyoffice-config",
                  headers={"Authorization": "Bearer dummy"})
print(f"\nConfig endpoint status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    actual_token = data["editor_config"]["token"]
    print(f"Actual token from API: {actual_token[:50]}...")
    try:
        decoded = jwt.decode(actual_token, OO_SECRET, algorithms=["HS256"])
        print("✅ ONLYOFFICE can verify the real API token")
    except Exception as e:
        print(f"❌ ONLYOFFICE CANNOT verify: {e}")
elif r.status_code in (401, 403):
    print("(Auth required - testing with mock config instead)")
    from app.services.onlyoffice_drafts import sign_onlyoffice_config, build_onlyoffice_secret
    print(f"build_onlyoffice_secret() returns: [{build_onlyoffice_secret()}]")
    signed = sign_onlyoffice_config(config)
    try:
        decoded = jwt.decode(signed["token"], OO_SECRET, algorithms=["HS256"])
        print("✅ ONLYOFFICE can verify our signed config token")
    except Exception as e:
        print(f"❌ ONLYOFFICE CANNOT verify: {e}")
