import sqlite3
from datetime import datetime, timezone, timedelta
from jose import jwt

# Create a valid token using the auth_jwt_secret_key
# From app.core.config, auth_jwt_secret_key = "change-me-in-production"
# We just need to sign a token for the master user

payload = {
    "sub": str(1),
    "role": "master",
    "username": "master",
    "profile_handle": "master.master",
    "exp": datetime.now(timezone.utc) + timedelta(minutes=60)
}

token = jwt.encode(payload, "change-me-in-production", algorithm="HS256")
print(token)
