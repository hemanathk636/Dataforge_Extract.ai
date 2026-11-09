import os
import sys
import socket
import webbrowser
import threading
import time
import uvicorn

# Ensure utf-8 encoding for standard output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def get_lan_ip() -> str:
    """Detects the local area network (LAN) IP for mobile access on same Wi-Fi."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def is_port_in_use(port: int, host: str = "0.0.0.0") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0

def find_available_port(preferred: int = 8080) -> int:
    for port in [preferred, 8000, 8081, 8082, 8888]:
        if not is_port_in_use(port):
            return port
    return 8080

def open_browser(port: int):
    time.sleep(1.2)
    url = f"http://127.0.0.1:{port}"
    webbrowser.open(url)

if __name__ == "__main__":
    root_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, root_dir)

    target_port = find_available_port(8080)
    lan_ip = get_lan_ip()

    print("=" * 68)
    print("  * [Extract AI Studio] - Autonomous Web Scraping & PDF Suite")
    print(f"  * Local PC URL:      http://127.0.0.1:{target_port}")
    print(f"  * Mobile Phone URL:  http://{lan_ip}:{target_port}  (Open on Phone Wi-Fi)")
    print("  * PWA App Mode:      Active (Installable on Desktop & Mobile)")
    print("=" * 68)

    # Launch browser on desktop
    threading.Thread(target=open_browser, args=(target_port,), daemon=True).start()

    # Start FastAPI server on 0.0.0.0 so mobile devices on the same Wi-Fi can connect
    uvicorn.run("api.main:app", host="0.0.0.0", port=target_port, reload=False)
