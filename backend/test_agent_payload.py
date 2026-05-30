import asyncio
from app.api.routes.hr_agent import _call_gemini
import json

import os
from unittest.mock import patch
import httpx

orig_post = httpx.post

def mock_post(url, *args, **kwargs):
    print("URL:", url)
    print("BODY:", json.dumps(kwargs.get("json"), indent=2))
    raise Exception("Stop here")

with patch("httpx.post", mock_post):
    from app.api.routes.hr_agent import router
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    try:
        client.post("/api/hr/agent/chat", json={
            "mode": "agent",
            "messages": [{"role": "user", "content": "make id cards"}],
            "allow_write": True
        })
    except Exception as e:
        print(e)
