from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pathlib import Path

from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine


def _parse_cors(origins: str) -> list[str]:
    if origins.strip() == "*":
        return ["*"]
    return [o.strip() for o in origins.split(",") if o.strip()]


app = FastAPI(title=settings.app_name)


@app.get("/", response_class=HTMLResponse)
def hr_demo_home() -> str:
        # Minimal demo UI (HR only). Frontend can be replaced later.
        return """<!doctype html>
<html lang=\"en\">
    <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>HR Database Portal (Demo)</title>
        <style>
            body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; margin: 24px; }
            h1 { margin: 0 0 12px; }
            .row { display: flex; gap: 12px; flex-wrap: wrap; }
            .field { display: flex; flex-direction: column; min-width: 220px; }
            label { font-size: 12px; color: #333; margin-bottom: 4px; }
            input, select, textarea { padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
            textarea { min-height: 80px; }
            button { padding: 10px 14px; border: 1px solid #999; border-radius: 8px; background: #f6f6f6; cursor: pointer; }
            button.primary { background: #111; color: #fff; border-color: #111; }
            .actions { display: flex; gap: 10px; margin: 12px 0 18px; flex-wrap: wrap; }
            .muted { color: #666; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; font-size: 13px; }
            th { position: sticky; top: 0; background: #fff; }
            .err { color: #b00020; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        </style>
    </head>
    <body>
        <h1>Human Resource Database Portal (Demo)</h1>
        <div class=\"muted\">Create staff entries → upload attachments → export as Excel.</div>

        <h2>New Entry</h2>
        <form id=\"staffForm\">
            <div class=\"row\">
                <div class=\"field\"><label>Full Name *</label><input name=\"full_name\" required /></div>
                <div class=\"field\"><label>Gender</label>
                    <select name=\"gender\">
                        <option value=\"\">(blank)</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                    </select>
                </div>
                <div class=\"field\"><label>Date of Birth</label><input name=\"date_of_birth\" type=\"date\" /></div>
            </div>

            <div class=\"row\" style=\"margin-top:10px\">
                <div class=\"field\"><label>Designation *</label><input name=\"designation\" required /></div>
                <div class=\"field\"><label>Cadre</label><input name=\"cadre\" /></div>
                <div class=\"field\"><label>Employment Type</label><input name=\"employment_type\" placeholder=\"Regular / Contract / etc\" /></div>
            </div>

            <div class=\"row\" style=\"margin-top:10px\">
                <div class=\"field\"><label>Phone</label><input name=\"phone\" /></div>
                <div class=\"field\"><label>Email</label><input name=\"email\" type=\"email\" /></div>
            </div>

            <div class=\"row\" style=\"margin-top:10px\">
                <div class=\"field\"><label>Facility Name *</label><input name=\"facility_name\" required /></div>
                <div class=\"field\"><label>Facility Type</label><input name=\"facility_type\" placeholder=\"PHC / CHC / DH / etc\" /></div>
                <div class=\"field\"><label>District *</label><input name=\"district\" required /></div>
                <div class=\"field\"><label>Block</label><input name=\"block\" /></div>
            </div>

            <div class=\"row\" style=\"margin-top:10px\">
                <div class=\"field\"><label>Posting Place</label><input name=\"posting_place\" /></div>
                <div class=\"field\"><label>Date of Joining</label><input name=\"date_of_joining\" type=\"date\" /></div>
            </div>

            <div class=\"row\" style=\"margin-top:10px\">
                <div class=\"field\" style=\"min-width: 460px; flex: 1\"><label>Remarks</label><textarea name=\"remarks\"></textarea></div>
                <div class=\"field\" style=\"min-width: 460px; flex: 1\"><label>Extra (JSON)</label><textarea name=\"extra\" placeholder='{"key":"value"}'></textarea></div>
            </div>

            <div class=\"row\" style=\"margin-top:10px\">
                <div class=\"field\" style=\"min-width: 460px; flex: 1\">
                    <label>Attachments (docs/images)</label>
                    <input id=\"attachments\" type=\"file\" multiple />
                    <div class=\"muted\">Optional. Files upload after saving the entry.</div>
                </div>
            </div>

            <div class=\"actions\">
                <button class=\"primary\" type=\"submit\">Save Entry</button>
                <button type=\"button\" id=\"refreshBtn\">Refresh List</button>
                <button type=\"button\" id=\"exportBtn\">Export Excel</button>
            </div>
            <div id=\"status\" class=\"muted\"></div>
            <div id=\"error\" class=\"err\"></div>
        </form>

        <h2>Compiled Entries</h2>
        <div class=\"muted\">Showing latest entries from the backend database.</div>
        <table id=\"staffTable\">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Full Name</th>
                    <th>Designation</th>
                    <th>Facility</th>
                    <th>District</th>
                    <th>Employment</th>
                    <th>Phone</th>
                    <th>Attachments</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>

        <script>
            const statusEl = document.getElementById('status');
            const errEl = document.getElementById('error');
            const tbody = document.querySelector('#staffTable tbody');

            function setStatus(msg) { statusEl.textContent = msg || ''; }
            function setError(msg) { errEl.textContent = msg || ''; }

            function formToPayload(form) {
                const data = new FormData(form);
                const payload = {};
                for (const [k, v] of data.entries()) {
                    // Skip file inputs; they are uploaded separately.
                    if (v instanceof File) continue;
                    const value = (v ?? '').toString().trim();
                    if (value === '') continue;
                    payload[k] = value;
                }
                // Dates are already yyyy-mm-dd from <input type=date>
                if (payload.extra) {
                    try {
                        payload.extra = JSON.parse(payload.extra);
                    } catch (e) {
                        throw new Error('Extra must be valid JSON');
                    }
                }
                return payload;
            }

            async function refreshList() {
                setError('');
                setStatus('Loading...');
                const r = await fetch('/api/hr/staff?limit=50');
                if (!r.ok) {
                    setStatus('');
                    setError('Failed to load list: ' + (await r.text()));
                    return;
                }
                const items = await r.json();
                tbody.innerHTML = '';
                for (const s of items) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${s.id}</td>
                        <td>${s.full_name ?? ''}</td>
                        <td>${s.designation ?? ''}</td>
                        <td>${s.facility_name ?? ''}</td>
                        <td>${s.district ?? ''}</td>
                        <td>${s.employment_type ?? ''}</td>
                        <td>${s.phone ?? ''}</td>
                        <td><a href="/api/hr/staff/${s.id}/attachments" target="_blank" rel="noreferrer">View</a></td>
                        <td>${(s.created_at ?? '').replace('T',' ')}</td>
                    `;
                    tbody.appendChild(tr);
                }
                setStatus(`Loaded ${items.length} entries.`);
            }

            document.getElementById('refreshBtn').addEventListener('click', refreshList);

            document.getElementById('exportBtn').addEventListener('click', () => {
                window.location.href = '/api/hr/staff/export?format=xlsx';
            });

            document.getElementById('staffForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                setError('');
                try {
                    const attachmentsInput = document.getElementById('attachments');
                    const payload = formToPayload(e.target);
                    setStatus('Saving...');
                    const r = await fetch('/api/hr/staff', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    if (!r.ok) {
                        setStatus('');
                        setError(await r.text());
                        return;
                    }
                    const created = await r.json();

                    const files = attachmentsInput?.files ? Array.from(attachmentsInput.files) : [];
                    if (files.length) {
                        setStatus(`Saved. Uploading ${files.length} attachment(s)...`);
                        for (const file of files) {
                            const fd = new FormData();
                            fd.append('file', file);
                            const ur = await fetch(`/api/hr/staff/${created.id}/attachments`, {
                                method: 'POST',
                                body: fd,
                            });
                            if (!ur.ok) {
                                throw new Error('Attachment upload failed: ' + (await ur.text()));
                            }
                        }
                    }

                    setStatus('Saved. Refreshing list...');
                    e.target.reset();
                    await refreshList();
                } catch (err) {
                    setStatus('');
                    setError(String(err?.message ?? err));
                }
            });

            refreshList();
        </script>
    </body>
</html>
"""

cors_origins = _parse_cors(settings.cors_origins)
allow_credentials = False if cors_origins == ["*"] else True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Ensure models are registered before create_all
    from app.models import hr_staff  # noqa: F401
    from app.models import hr_staff_attachment  # noqa: F401

    # Ensure uploads dir exists (local MVP)
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)

    # MVP: auto-create tables. For production, switch to migrations.
    Base.metadata.create_all(bind=engine)


app.include_router(api_router, prefix="/api")
