import os
import sqlite3
from app.services.document_storage import get_document_storage_service

def clear_bucket():
    try:
        storage = get_document_storage_service()
        # Use underlying client to delete everything if it's GCS
        if hasattr(storage, 'bucket'):
            blobs = list(storage.bucket.list_blobs())
            for blob in blobs:
                blob.delete()
            print(f"Deleted {len(blobs)} files from GCS bucket.")
        else:
            # local
            pass
    except Exception as e:
        print(f"GCS error: {e}")

def clear_db():
    conn = sqlite3.connect("portal.db")
    c = conn.cursor()
    try:
        c.execute("DELETE FROM hr_staff")
        c.execute("DELETE FROM hr_staff_attachments")
        conn.commit()
        print("Cleared hr_staff and attachments tables.")
    except Exception as e:
        print(f"DB error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    clear_bucket()
    clear_db()
