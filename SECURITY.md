# Security & Encryption Strategy

This document outlines the security measures for the DMO Namsai Portal, focusing specifically on protecting Sensitive Personal Information (SPI) and ensuring full auditability of the system.

## 1. Aadhaar and PAN Encryption (Field-Level)

**Decision:** We will use **Application-Layer Encryption (Field-Level)** rather than database-level encryption (like `pgcrypto`).

### Why Application-Layer Encryption?
1.  **Database Agnostic:** This approach works seamlessly with both our local SQLite development database and the production managed Postgres database (Cloud SQL).
2.  **Zero-Knowledge DB:** The plaintext Aadhaar and PAN numbers never reach the database server, protecting the data even if a database backup is compromised or database query logs are exposed.
3.  **Framework Support:** We will implement a custom SQLAlchemy `TypeDecorator` (e.g., `EncryptedString`) that transparently encrypts data on `INSERT`/`UPDATE` and decrypts on `SELECT`.

### Implementation Plan
1.  **Library:** Use the `cryptography` Python package (`Fernet` symmetric encryption).
2.  **Key Management:** A single master encryption key (`FIELD_ENCRYPTION_KEY`) will be injected into the backend API via environment variables (stored securely in Google Cloud Secret Manager).
3.  **Model Updates:** Change `aadhaar_number` and `pan_number` in `hr_staff` to use the new `EncryptedString` type. The database column type will remain `VARCHAR` (or `TEXT`), but the application will only store the base64-encoded ciphertext.
4.  **Read Access:** Only specific roles (e.g., `hr` or `master`) will be permitted to query these fields via the API.
5.  **Data Migration:** The current plain-text SQLite data will be migrated by writing a script that reads the plaintext, encrypts it, and writes it back before transferring to Cloud SQL.

## 2. Audit Logging

**Current State:** The system currently logs login events to `admin_access_logs`.

**Target State:** We will expand this into a comprehensive `audit_log` system.
*   **What is logged:** Every `CREATE`, `UPDATE`, and `DELETE` on staff records. Every `DOWNLOAD`, `UPLOAD`, and `DELETE` on documents. Every read of a highly sensitive field (Aadhaar/PAN) if exposed in the UI.
*   **Who is logged:** The actor (`user_id` / `role`).
*   **How it works:** We will use SQLAlchemy event listeners (e.g., `after_insert`, `after_update`) to automatically write an audit log entry whenever a model changes, minimizing the chance of developer oversight in the API route handlers.
