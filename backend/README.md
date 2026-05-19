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

## Endpoints (MVP)

- `GET /api/dashboard`
- `POST /api/hr/staff`
- `GET /api/hr/staff`
- `GET /api/hr/staff/{id}`
- `PATCH /api/hr/staff/{id}`
- `DELETE /api/hr/staff/{id}`
- `GET /api/hr/staff/export?format=csv`
