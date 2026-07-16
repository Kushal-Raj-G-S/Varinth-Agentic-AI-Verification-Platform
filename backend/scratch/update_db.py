import os
import sys
import psycopg2
from dotenv import load_dotenv

# Add parent dir to path to import config if needed
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

load_dotenv()
db_url = os.getenv("DATABASE_URL")

if not db_url:
    print("Error: DATABASE_URL not found in environment.")
    sys.exit(1)

print(f"Connecting to database...")
try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("Altering public.memories table to add properties_json column...")
    cur.execute("ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS properties_json JSONB DEFAULT '{}'::jsonb NOT NULL;")
    
    conn.commit()
    print("Database updated successfully!")
    cur.close()
    conn.close()
except Exception as exc:
    print(f"Failed to update database: {exc}")
    sys.exit(1)
