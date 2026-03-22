#!/usr/bin/env python3
"""
Local dev server for La Cucina recipe site.
Run from the project folder:  python3 serve.py
Then open:                    http://localhost:8000
"""

import http.server
import socketserver
import webbrowser
import threading
import os
import sys

PORT = 8000
HOST = "localhost"


class Handler(http.server.SimpleHTTPRequestHandler):
    # Suppress per-request log noise — comment out to see all requests
    def log_message(self, format, *args):
        pass


def open_browser():
    url = f"http://{HOST}:{PORT}"
    print(f"  Opening {url} in your browser...")
    webbrowser.open(url)


def main():
    # Make sure we serve from the directory where this script lives
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    # Check that the key files are present
    missing = [f for f in ("index.html", "style.css", "script.js", "recipes.json")
               if not os.path.exists(f)]
    if missing:
        print(f"⚠  Missing files: {', '.join(missing)}")
        print("   Make sure serve.py is in the same folder as index.html.")
        sys.exit(1)

    try:
        with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
            print()
            print("  ✦  La Cucina — local dev server")
            print(f"     Serving from: {script_dir}")
            print(f"     URL:          http://{HOST}:{PORT}")
            print()
            print("  Press Ctrl+C to stop.")
            print()

            # Open the browser half a second after the server starts
            timer = threading.Timer(0.5, open_browser)
            timer.start()

            httpd.serve_forever()

    except OSError as e:
        if "Address already in use" in str(e):
            print(f"✗  Port {PORT} is already in use.")
            print(f"   Either stop the other process, or change PORT in serve.py.")
        else:
            print(f"✗  Server error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n  Server stopped. Goodbye!")


if __name__ == "__main__":
    main()