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

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
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
    print(f"\n[DataForge Studio] Interface online at {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    root_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, root_dir)

    target_port = find_available_port(8080)

    print("=" * 64)
    print("  * [DataForge AI Studio] - High-Performance Web Scraper")
    print("  * Enhanced with 3D Physics, Lenis Smooth Scroll & GSAP")
    print(f"  * Running on: http://127.0.0.1:{target_port}")
    print("=" * 64)

    # Launch browser in a background thread
    threading.Thread(target=open_browser, args=(target_port,), daemon=True).start()

    # Start FastAPI server via uvicorn
    uvicorn.run("api.main:app", host="127.0.0.1", port=target_port, reload=False)
