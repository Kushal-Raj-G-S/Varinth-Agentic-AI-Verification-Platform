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
                SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
                FROM pg_policies 
                WHERE schemaname = 'public';
            """)
            rows = cur.fetchall()
            print("RLS Policies in database:")
            for row in rows:
                print(f"Table: {row[0]}, Name: {row[1]}, Cmd: {row[4]}, Qual: {row[5]}, WithCheck: {row[6]}")
        conn.close()
    except Exception as e:
        print("Error querying policies:", e)

if __name__ == "__main__":
    main()
