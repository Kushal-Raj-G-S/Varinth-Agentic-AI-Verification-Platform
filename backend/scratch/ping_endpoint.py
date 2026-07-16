import urllib.request
import json

def main():
    try:
        response = urllib.request.urlopen("http://127.0.0.1:8000/docs", timeout=5)
        print("GET /docs Status:", response.status)
    except Exception as e:
        print("Error pinging API:", e)

if __name__ == "__main__":
    main()
