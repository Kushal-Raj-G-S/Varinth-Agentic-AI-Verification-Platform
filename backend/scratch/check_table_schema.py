import os
import psycopg2
from dotenv import load_dotenv

def main():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found")
        return

    try:
        conn = psycopg2.connect(db_url)
        with conn.cursor() as cur:
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'source_contexts';
            """)
            print("Columns in source_contexts:")
            for row in cur.fetchall():
                print(f"Col: {row[0]}, Type: {row[1]}, Nullable: {row[2]}")
        conn.close()
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
