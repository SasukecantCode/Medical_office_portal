import sys
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal

client = TestClient(app)

# We can bypass auth by overriding the dependency, but since it's a real DB, 
# let's just log in as admin to get a token.
# wait, what's the admin credentials?
# let's override the get_current_user dependency instead

from app.api.deps import get_current_user
app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "admin"}

response = client.get("/api/hr/staff")
data = response.json()
print(f"API returned {len(data)} items")
if len(data) > 0:
    print(f"First item ID: {data[0].get('id')}")
    print(f"Last item ID: {data[-1].get('id')}")

