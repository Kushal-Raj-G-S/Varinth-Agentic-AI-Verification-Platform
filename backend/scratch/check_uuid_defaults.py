import os
import psycopg2
from dotenv import load_dotenv

def main():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url: return

    try:
        conn = psycopg2.connect(db_url)
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, column_default 
                FROM information_schema.columns 
                WHERE table_name = 'source_contexts' AND column_name = 'source_context_id';
            """)
            print("Default for source_context_id:", cur.fetchone())
        conn.close()
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
