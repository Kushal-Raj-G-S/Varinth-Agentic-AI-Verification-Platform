import os
import psycopg2
from dotenv import load_dotenv

def main():
    # Load environment variables
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in .env")
        return

    sql_path = r"C:\Users\kushalrajgs\.gemini\antigravity-ide\brain\fb75216c-cf6b-4a5a-99eb-ceee9daee7ac\supabase_profiles_schema.sql"
    if not os.path.exists(sql_path):
        print(f"Error: SQL file not found at {sql_path}")
        return

    with open(sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    print("Connecting to Supabase PostgreSQL database...")
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            print("Executing migration SQL...")
            cur.execute(sql_content)
            print("Migration executed successfully!")
        conn.close()
    except Exception as e:
        print(f"Failed to execute migration: {e}")

if __name__ == "__main__":
    main()
