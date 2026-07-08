# Database Migration Guide: Local SQLite to Cloud SQL (Postgres)

This guide outlines the process of migrating the existing local database (`portal.db`, SQLite) into the new managed Cloud SQL (Postgres) database, which is accessed by our Python (FastAPI) backend.

## 1. Schema Migration (Alembic)

We use Alembic to manage the database schema. Before transferring data, you must initialize the schema on the empty Postgres database.

1. Ensure the `DATABASE_URL` environment variable is set to your Cloud SQL Postgres instance:
   ```bash
   export DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db_name>"
   ```
2. Apply the Alembic migrations from the `backend/` directory:
   ```bash
   cd backend
   alembic upgrade head
   ```
This will create all the required tables: `hr_staff`, `hr_drafts`, `hr_notifications`, `hr_staff_attachments`, `hr_field_defs`, `auth_users`, `auth_invites`, `admin_access_logs`, and `alembic_version`.

## 2. Data Migration

A script is provided to read from the local SQLite database and bulk-insert into the target Postgres database using SQLAlchemy.

1. Set the environment variables:
   ```bash
   # Source database (SQLite)
   export SQLITE_DB_URL="sqlite:///./portal.db" 
   
   # Target database (Cloud SQL Postgres)
   export TARGET_DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db_name>"
   ```
2. Run the migration script:
   ```bash
   cd backend
   PYTHONPATH=. python scripts/migrate_sqlite_to_postgres.py
   ```
   
The script automatically copies data across all 8 core tables:
- `auth_users`
- `auth_invites`
- `hr_staff`
- `hr_field_defs`
- `hr_drafts`
- `hr_notifications`
- `hr_staff_attachments`
- `admin_access_logs`

*Note: The script safely skips any tables that are empty in the source database.*

## 3. Post-Migration Verification

1.  Connect to your Cloud SQL instance using `psql` or a UI tool like pgAdmin/DBeaver.
2.  Verify the row counts in the `hr_staff` and `auth_users` tables match the output of the migration script.
3.  Test the API: Log in using an existing user account to ensure password hashes and roles migrated successfully.
