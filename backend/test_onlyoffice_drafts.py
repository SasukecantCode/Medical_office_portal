from __future__ import annotations

from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api import dependencies as auth_dependencies
from app.api.routes import drafts as drafts_routes
from app.main import app
from app.services import document_storage as storage_module
from app.services.document_storage import LocalDocumentStorageService


def build_test_client(tmp_path):
    storage = LocalDocumentStorageService(str(tmp_path / "draft-storage"))
    fake_user = SimpleNamespace(
        id=1,
        full_name="Test User",
        username="tester",
        role="hr",
        is_active=True,
    )
    app.dependency_overrides[storage_module.get_document_storage_service] = lambda: storage
    app.dependency_overrides[auth_dependencies.get_current_user] = lambda: fake_user
    return TestClient(app), storage


def clear_test_overrides():
    app.dependency_overrides.clear()


def test_create_list_and_config_for_draft(tmp_path):
    client, _storage = build_test_client(tmp_path)
    try:
        create_response = client.post(
            "/api/documents/drafts/create",
            json={"employee_id": "EMP001", "title": "Admission Note"},
        )
        assert create_response.status_code == 200
        draft = create_response.json()
        assert draft["employee_id"] == "EMP001"
        assert draft["title"] == "Admission Note"
        assert draft["version"] == 1
        assert draft["document_key"]

        list_response = client.get("/api/documents/drafts/EMP001")
        assert list_response.status_code == 200
        drafts = list_response.json()["drafts"]
        assert len(drafts) == 1
        assert drafts[0]["draft_id"] == draft["draft_id"]

        config_response = client.get(f"/api/documents/drafts/EMP001/{draft['draft_id']}/onlyoffice-config")
        assert config_response.status_code == 200
        config_payload = config_response.json()
        editor_config = config_payload["editor_config"]
        assert editor_config["documentType"] == "word"
        assert editor_config["document"]["fileType"] == "docx"
        assert editor_config["document"]["key"] == draft["document_key"]
        assert editor_config["token"]
    finally:
        clear_test_overrides()


def test_onlyoffice_callback_updates_stored_draft(tmp_path):
    client, _storage = build_test_client(tmp_path)
    try:
        create_response = client.post(
            "/api/documents/drafts/create",
            json={"employee_id": "EMP002", "title": "Progress Note"},
        )
        assert create_response.status_code == 200
        draft = create_response.json()

        config_response = client.get(f"/api/documents/drafts/EMP002/{draft['draft_id']}/onlyoffice-config")
        assert config_response.status_code == 200
        editor_config = config_response.json()["editor_config"]
        source_url = editor_config["document"]["url"]
        callback_url = editor_config["editorConfig"]["callbackUrl"]
        source_token = parse_qs(urlparse(source_url).query)["token"][0]
        callback_token = parse_qs(urlparse(callback_url).query)["token"][0]

        updated_docx = b"fake-docx-payload"

        class FakeResponse:
            def __init__(self, content: bytes):
                self.content = content

            def raise_for_status(self):
                return None

        class FakeAsyncClient:
            def __init__(self, *args, **kwargs):
                self._content = updated_docx

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

            async def get(self, url):
                return FakeResponse(self._content)

        with patch.object(drafts_routes.httpx, "AsyncClient", FakeAsyncClient):
            callback_response = client.post(
                f"/api/documents/drafts/EMP002/{draft['draft_id']}/callback?token={callback_token}",
                json={"status": 2, "url": "https://onlyoffice.example.com/result.docx", "title": "Progress Note"},
            )
            assert callback_response.status_code == 200
            assert callback_response.json() == {"error": 0}

        updated_draft = client.get(f"/api/documents/drafts/EMP002/{draft['draft_id']}").json()
        assert updated_draft["version"] == 2
        assert updated_draft["document_key"] != draft["document_key"]

        source_response = client.get(
            f"/api/documents/drafts/EMP002/{draft['draft_id']}/source?token={source_token}"
        )
        assert source_response.status_code == 200
        assert source_response.content == updated_docx
    finally:
        clear_test_overrides()