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

Drafts created for the Native Word Editor are stored under the staff document namespace in a hidden `.drafts` folder so they do not interfere with the existing file vault.

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
- `GET /api/documents/drafts/{employee_id}/{draft_id}/source` (Download draft source DOCX)
- `DELETE /api/documents/drafts/{employee_id}/{draft_id}` (delete a draft)
