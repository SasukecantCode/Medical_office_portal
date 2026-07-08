import os
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker

# Paths
SQLITE_URL = "sqlite:///portal.db"
# Read from .env
from dotenv import load_dotenv
load_dotenv()
POSTGRES_URL = os.getenv("DATABASE_URL")

print(f"Migrating from SQLite to {POSTGRES_URL.split('@')[1]}")

sqlite_engine = create_engine(SQLITE_URL)
pg_engine = create_engine(POSTGRES_URL)

# First, ensure all tables are created on Postgres
from app.db.base import Base
Base.metadata.create_all(bind=pg_engine)

meta_sqlite = MetaData()
meta_sqlite.reflect(bind=sqlite_engine)

meta_pg = MetaData()
meta_pg.reflect(bind=pg_engine)

# Truncate tables to ensure a clean slate
with pg_engine.begin() as pg_conn:
    for table in reversed(meta_pg.sorted_tables):
        if table.name != "alembic_version":
            pg_conn.execute(table.delete())

with sqlite_engine.connect() as sqlite_conn:
    for table_name in meta_sqlite.sorted_tables:
        if table_name.name == "alembic_version":
            continue
            
        print(f"Migrating table {table_name.name}...")
        rows = sqlite_conn.execute(table_name.select()).fetchall()
        
        if not rows:
            print(f" - 0 rows, skipping.")
            continue
            
        print(f" - Found {len(rows)} rows.")
        pg_table = meta_pg.tables[table_name.name]
        data_to_insert = [dict(row._mapping) for row in rows]
        
        try:
            with pg_engine.begin() as pg_conn:
                pg_conn.execute(pg_table.insert(), data_to_insert)
            print(f" - Successfully inserted {len(rows)} rows.")
        except Exception as e:
            print(f" - Error inserting into {table_name.name}: {e}")

print("Migration Complete!")
