# DMO Namsai Portal (Thin-Client Pivot)

Welcome to the newly structured DMO Namsai Portal monorepo. This system has transitioned from a server-heavy ONLYOFFICE deployment to a lightweight Windows thin-client architecture backed by a stateless cloud API and managed database.

## Architecture Overview

*   **`desktop-app/`**: The Windows thin client built using Tauri (Rust + React/TypeScript). It delegates document editing to native Microsoft Word.
*   **`backend-api/`**: A stateless Node.js (Fastify) API deployed on Google Cloud Run, mediating all access to storage and database.
*   **`infra/`**: Infrastructure as Code (IaC) and configuration files for setting up GCP (Cloud Run, GCS) and Supabase.
*   **`docs/`**: Architecture diagrams, workflow documentation, and operational runbooks.

## Local Development Setup

### Prerequisites

1.  **Node.js**: v20 or higher.
2.  **Rust**: Latest stable (for Tauri desktop app development).
3.  **Supabase CLI**: For local database development (optional but recommended).
4.  **Google Cloud CLI (`gcloud`)**: For storage interaction and Cloud Run deployment.

### Required Environment Variables (Secrets)

**DO NOT hardcode these in any file.** You must provide them via `.env` files in their respective directories (`backend-api/.env` and `desktop-app/.env`).

**`backend-api/.env`:**
```env
PORT=8080
NODE_ENV=development
SUPABASE_URL=https://<YOUR_PROJECT_ID>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY> # Keep secret!
JWT_SECRET=<YOUR_LONG_RANDOM_SECRET>
GCP_PROJECT_ID=<YOUR_GCP_PROJECT_ID>
GCS_BUCKET_NAME=<YOUR_GCS_BUCKET_NAME>
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**`desktop-app/.env`:**
```env
VITE_API_BASE_URL=http://localhost:8080 # Or the Cloud Run URL in production
```

### Running Locally

1.  **Backend API:**
    ```bash
    cd backend-api
    npm install
    npm run dev
    ```
2.  **Desktop App:**
    ```bash
    cd desktop-app
    npm install
    npm run tauri dev
    ```

## Deployment Steps

1.  **Database:** Apply migrations to your Supabase project (see `infra/supabase`).
2.  **Storage:** Provision the GCS bucket with lifecycle rules for temp files. Ensure the backend API Service Account has `Storage Object Admin` rights.
3.  **Backend:** Deploy the API to Google Cloud Run using `gcloud run deploy`. Inject the required environment variables during deployment.
4.  **Desktop:** Build the Windows installer using `npm run tauri build`. Distribute the resulting `.msi` or `.exe`.
