from sqlalchemy import create_engine
import traceback
import concurrent.futures

regions = [
    "ap-south-1", "ap-southeast-1", "us-east-1", "eu-central-1",
    "us-west-1", "us-west-2", "eu-west-1", "eu-west-2",
    "ap-northeast-1", "ap-northeast-2", "ap-southeast-2",
    "sa-east-1", "ca-central-1"
]

def test_region(region):
    pooler_url = f"postgresql://postgres.cjcrthgoiejhjjkqnunf:Gewsion%40302005@aws-0-{region}.pooler.supabase.com:6543/postgres"
    try:
        engine = create_engine(pooler_url, connect_args={'connect_timeout': 5})
        with engine.connect() as conn:
            result = conn.execute("SELECT 1;").fetchone()
            return f"Success in {region}: {result}"
    except Exception as e:
        return f"Failed in {region}: {str(e).splitlines()[0]}"

with concurrent.futures.ThreadPoolExecutor(max_workers=len(regions)) as executor:
    results = executor.map(test_region, regions)
    for result in results:
        print(result)

