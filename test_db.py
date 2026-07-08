from sqlalchemy import create_engine
import traceback

regions = ["ap-south-1", "ap-southeast-1"]

for region in regions:
    pooler_url = f"postgresql://postgres.cjcrthgoiejhjjkqnunf:Gewsion%40302005@aws-0-{region}.pooler.supabase.com:6543/postgres"
    print(f"Testing {region}...")
    try:
        engine = create_engine(pooler_url, connect_args={'connect_timeout': 5})
        with engine.connect() as conn:
            result = conn.execute("SELECT 1;").fetchone()
            print(f"Success in {region}: {result}")
            break
    except Exception as e:
        print(f"Failed in {region}: {e}")

