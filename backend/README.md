# Medical Office Portal — Backend (FastAPI)

## Run (dev)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

## Data

Default DB is SQLite at `backend/portal.db` (configurable via `DATABASE_URL`).

Drafts created for ONLYOFFICE are stored under the staff document namespace in a hidden `.drafts` folder so they do not interfere with the existing file vault.

## Endpoints (MVP)

- `GET /api/dashboard`
- `POST /api/hr/staff`
- `GET /api/hr/staff`
- `GET /api/hr/staff/{id}`
- `PATCH /api/hr/staff/{id}`
- `DELETE /api/hr/staff/{id}`
- `GET /api/hr/staff/export?format=xlsx|csv` (default: `xlsx`)
- `POST /api/hr/staff/{id}/photo` (upload/replace profile photo JPEG)
- `GET /api/hr/staff/{id}/photo` (download/view profile photo JPEG)
- `POST /api/hr/staff/{id}/attachments` (upload document)
- `GET /api/hr/staff/{id}/attachments` (list documents)
- `GET /api/hr/staff/{id}/attachments/{attachment_id}` (download document)
- `POST /api/documents/drafts/create` (create a blank Word draft for a staff record)
- `GET /api/documents/drafts/{employee_id}` (list drafts)
- `GET /api/documents/drafts/{employee_id}/{draft_id}` (draft metadata)
- `GET /api/documents/drafts/{employee_id}/{draft_id}/source` (ONLYOFFICE document source URL)
- `GET /api/documents/drafts/{employee_id}/{draft_id}/onlyoffice-config` (ONLYOFFICE editor config)
- `POST /api/documents/drafts/{employee_id}/{draft_id}/callback` (ONLYOFFICE save callback)
- `DELETE /api/documents/drafts/{employee_id}/{draft_id}` (delete a draft)

## ONLYOFFICE

Set these environment variables when wiring the editor to a real Document Server:

- `ONLYOFFICE_DOCUMENT_SERVER_URL` - base URL of the ONLYOFFICE Docs server
- `ONLYOFFICE_JWT_SECRET` - shared secret used to sign editor configs and access tokens
- `ONLYOFFICE_TOKEN_TTL_MINUTES` - lifetime for signed source/callback links

The backend returns the full editor config JSON, including the Word document URL and callback URL, so the frontend can embed ONLYOFFICE later without adding draft-specific logic.
