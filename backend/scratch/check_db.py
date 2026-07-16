import os
import psycopg2
from dotenv import load_dotenv

def main():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found")
        return

    print("Connecting to DB...")
    try:
        conn = psycopg2.connect(db_url)
        with conn.cursor() as cur:
            # Check existing tables
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public';
            """)
            tables = [r[0] for r in cur.fetchall()]
            print("Tables in database:", tables)

            # Check profile rows
            if "profiles" in tables:
                cur.execute("SELECT COUNT(*) FROM public.profiles;")
                print("Profiles count:", cur.fetchone()[0])
                cur.execute("SELECT * FROM public.profiles LIMIT 5;")
                print("Profiles sample:", cur.fetchall())

            # Check source_contexts rows
            if "source_contexts" in tables:
                cur.execute("SELECT COUNT(*) FROM public.source_contexts;")
                print("Source contexts count:", cur.fetchone()[0])
                cur.execute("SELECT * FROM public.source_contexts LIMIT 5;")
                print("Source contexts sample:", cur.fetchall())

            # Check audit_runs rows
            if "audit_runs" in tables:
                cur.execute("SELECT COUNT(*) FROM public.audit_runs;")
                print("Audit runs count:", cur.fetchone()[0])

        conn.close()
    except Exception as e:
        print("Error connecting/querying DB:", e)

if __name__ == "__main__":
    main()
