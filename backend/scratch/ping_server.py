import socket

def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(('127.0.0.1', 8000))
        print("Port 8000 is OPEN")
        s.close()
    except Exception as e:
        print("Port 8000 is CLOSED:", e)

if __name__ == "__main__":
    main()
