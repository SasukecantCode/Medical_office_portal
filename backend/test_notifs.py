import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from fastapi.testclient import TestClient
from app.main import app
from jose import jwt
from datetime import datetime, timezone, timedelta

client = TestClient(app)

def test():
    payload = {
        "sub": str(1),
        "role": "master",
        "username": "master",
        "profile_handle": "master.master",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60)
    }
    token = jwt.encode(payload, "change-me-in-production", algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}

    # Generate
    res = client.post("/api/hr/notifications/generate", headers=headers)
    print("GENERATE RESPONSE:")
    print(res.status_code, res.text)
    
    # Read
    res = client.get("/api/hr/notifications?status=UNREAD", headers=headers)
    print("READ RESPONSE:")
    print(res.status_code, res.text)

if __name__ == "__main__":
    test()
