"""Streamlit server startup and health probe tester."""

import subprocess
import sys
import time
import urllib.request


def test_streamlit_server() -> bool:
    print("Starting Streamlit server on port 8501...")
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "streamlit",
            "run",
            "apps/ui/app.py",
            "--server.headless",
            "true",
            "--server.port",
            "8501",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    success = False
    try:
        # Wait up to 15 seconds for server to start and respond
        for attempt in range(15):
            time.sleep(1)
            try:
                with urllib.request.urlopen(
                    "http://localhost:8501/_stcore/health", timeout=3
                ) as resp:
                    code = resp.getcode()
                    content = resp.read().decode("utf-8").strip()
                    print(f"Attempt {attempt + 1}: Received HTTP {code} - {content!r}")
                    if code == 200:
                        print("Streamlit server is healthy and responding with HTTP 200 OK!")
                        success = True
                        break
            except Exception:
                # Still starting up
                pass
        else:
            print("Streamlit server did not become ready in time.")
    finally:
        print("Terminating Streamlit test process...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Streamlit test process terminated cleanly.")

    return success


if __name__ == "__main__":
    ok = test_streamlit_server()
    sys.exit(0 if ok else 1)
