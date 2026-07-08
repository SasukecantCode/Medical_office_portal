# DMO Namsai Portal

Welcome to the DMO Namsai Portal monorepo. This system is a secure, local-first medical office document management system and HR portal tailored for government operations in Namsai. It is designed around a lightweight Windows desktop client backed by a stateless cloud API and managed database.

## Why a Desktop App for Government HR?

Transitioning to a native desktop application provides several key benefits for government HR workflows:

*   **Familiar Workflow:** Government staff are deeply accustomed to using native Microsoft Word for drafting official letters, memos, and notifications. Instead of forcing them to learn a clunky web-based editor, this app hooks directly into the Word interface they already know.
*   **Data Sovereignty & Security:** Documents never linger on third-party web servers (like ONLYOFFICE). Drafts are pulled directly to the local machine, edited natively, and pushed securely to the managed cloud database.
*   **Offline Tolerance:** The native file-watcher can gracefully queue uploads or handle transient network drops much better than a browser tab, which is crucial for areas with intermittent connectivity.
*   **Robust Auditing:** By bridging native OS interactions with our cloud API, every single document view, edit, and save is securely tied to the staff member's authenticated identity, ensuring strict compliance with government data accountability standards.

## Architecture Overview

*   **`desktop-app/`**: The Windows desktop client built using Tauri (Rust + Vanilla JS/HTML). It provides the secure vault interface and delegates document editing directly to native Microsoft Word.
*   **`backend/`**: A stateless Python FastAPI backend API. It mediates all access to the Postgres database and Google Cloud Storage (GCS), enforcing role-based access control and handling field-level encryption.
*   **`frontend/`**: The legacy web-based HR portal built with Vanilla JS/Vite, primarily used for dashboard reporting and basic tasks.

## Local Development Setup

### Prerequisites

1.  **Node.js**: v18 or higher (for building the desktop/web frontends).
2.  **Rust**: Latest stable `rustup`, `rustc`, `cargo` (for Tauri desktop app development).
3.  **Python 3.11+**: For the FastAPI backend.
4.  **PostgreSQL**: v14+ running locally (or via Docker).
5.  **Visual Studio 2022 Build Tools** *(Windows Only)*: Requires the "Desktop development with C++" workload (MSVC and Windows SDK) to compile Tauri on Windows.

### Required Environment Variables

**`backend/.env`:**
```env
# Example backend configuration
GEMINI_API_KEY=<your_api_key>
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcs-key.json
```
*(Review `backend/app/core/config.py` for other DB strings and secret parameters needed)*

### Running Locally

1.  **Backend API:**
    ```bash
    cd backend
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    make start
    ```
    
2.  **Desktop App:**
    ```bash
    cd desktop-app
    npm install
    npm run tauri dev
    ```

## Deployment Steps

1.  **Database:** Apply Alembic migrations to your managed Postgres database (`cd backend && alembic upgrade head`).
2.  **Storage:** Provision the GCS bucket. Ensure the backend API Service Account has `Storage Object Admin` rights.
3.  **Backend:** Deploy the FastAPI backend using Docker / Cloud Run.
4.  **Desktop:** Build the Windows installer locally by running `npm run tauri build` on a Windows machine. Distribute the resulting `.msi` or `.exe` installers.
