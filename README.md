# DMO Namsai Portal

Welcome to the DMO Namsai Portal monorepo. This system is a secure, local-first medical office document management system and HR portal. It is designed around a lightweight Windows desktop client backed by a stateless cloud API and managed database.

## Architecture Overview

*   **`desktop-app/`**: The Windows desktop client built using Tauri (Rust + Vanilla JS/HTML). It provides the secure vault interface and delegates document editing directly to native Microsoft Word.
*   **`backend/`**: A stateless Python FastAPI backend API. It mediates all access to the Postgres database and Google Cloud Storage (GCS), enforcing role-based access control and handling field-level encryption.
*   **`frontend/`**: The web-based HR portal built with Vanilla JS/Vite.

## How Authentication Works

Authentication in the desktop application bridges standard web JWT flows with native OS integrations seamlessly:

1. **Login Flow:** Users authenticate against the FastAPI backend (`POST /api/auth/login`), which verifies credentials and issues a JSON Web Token (JWT).
2. **Session Storage:** The desktop client currently stores this token in standard local storage to maintain session state across reloads.
3. **Native Backend Hooking:** When a user opens a document to edit in Word, the frontend securely passes the active JWT down to the Tauri Rust core (`edit_document` command) via Inter-Process Communication (IPC).
4. **Authenticated Rust Daemon:** The Rust background thread operates as an authenticated proxy. It attaches the JWT to the `Authorization: Bearer <token>` header to securely download the target document. When the local file watcher detects a save event (e.g., you press `Ctrl+S` in Word), the Rust daemon uses the same JWT to authorize the upload (`PUT`) directly back to the FastAPI cloud backend. 

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
