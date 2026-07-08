import os
import sys
import logging
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
SQLITE_DB_URL = "sqlite:///./portal.db"
POSTGRES_DB_URL = os.environ.get("TARGET_DATABASE_URL")

def get_row_count(session, table):
    return session.execute(table.select()).rowcount

def migrate():
    if not POSTGRES_DB_URL:
        logger.error("TARGET_DATABASE_URL environment variable is not set. Migration aborted.")
        sys.exit(1)

    logger.info(f"Connecting to source SQLite DB: {SQLITE_DB_URL}")
    source_engine = create_engine(SQLITE_DB_URL)
    SourceSession = sessionmaker(bind=source_engine)
    source_session = SourceSession()

    logger.info(f"Connecting to target Postgres DB: {POSTGRES_DB_URL}")
    target_engine = create_engine(POSTGRES_DB_URL)
    TargetSession = sessionmaker(bind=target_engine)
    target_session = TargetSession()

    # Reflect source metadata
    source_metadata = MetaData()
    source_metadata.reflect(bind=source_engine)

    # Reflect target metadata (to ensure tables exist)
    target_metadata = MetaData()
    target_metadata.reflect(bind=target_engine)

    # Tables to migrate (in topological order if there are foreign keys)
    # The existing database has hr_staff, hr_field_defs, auth_users, etc.
    tables_to_migrate = [
        "auth_users",
        "auth_invites",
        "hr_staff",
        "hr_field_defs",
        "hr_drafts",
        "hr_notifications",
        "hr_staff_attachments",
        "admin_access_logs"
    ]

    total_rows_migrated = 0

    for table_name in tables_to_migrate:
        if table_name not in source_metadata.tables:
            logger.warning(f"Table {table_name} not found in source database. Skipping.")
            continue
            
        if table_name not in target_metadata.tables:
            logger.error(f"Table {table_name} not found in target database. Did you run Alembic migrations?")
            sys.exit(1)

        source_table = source_metadata.tables[table_name]
        target_table = target_metadata.tables[table_name]

        # Fetch all rows from source
        rows = source_session.execute(source_table.select()).fetchall()
        row_count = len(rows)

        if row_count == 0:
            logger.info(f"Table {table_name} is empty. Skipping.")
            continue

        logger.info(f"Migrating {row_count} rows for table {table_name}...")

        # Convert rows to dictionaries for bulk insert
        records = [dict(row._mapping) for row in rows]
        
        try:
            # We use core insert to handle the bulk insertion
            target_session.execute(target_table.insert(), records)
            target_session.commit()
            total_rows_migrated += row_count
            logger.info(f"Successfully migrated {table_name}.")
        except Exception as e:
            target_session.rollback()
            logger.error(f"Failed to migrate table {table_name}: {e}")
            sys.exit(1)
            
    logger.info(f"Migration completed successfully! Total rows transferred: {total_rows_migrated}")

if __name__ == "__main__":
    migrate()
