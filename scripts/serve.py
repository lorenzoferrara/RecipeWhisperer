#!/usr/bin/env python3
"""
Local dev server for La Cucina recipe site.
Run from the project folder:  python3 scripts/serve.py
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
    # Serve from project root (parent of the scripts/ directory)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    os.chdir(project_root)

    # Check that the key files are present
    missing = [f for f in ("index.html", "style.css", "script.js", "data/recipes.json")
               if not os.path.exists(f)]
    if missing:
        print(f"⚠  Missing files: {', '.join(missing)}")
        print("   Make sure you're running this script from the project structure.")
        sys.exit(1)

    try:
        with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
            print()
            print("  ✦  La Cucina — local dev server")
            print(f"     Serving from: {project_root}")
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
            print(f"   Either stop the other process, or change PORT in scripts/serve.py.")
        else:
            print(f"✗  Server error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n  Server stopped. Goodbye!")


if __name__ == "__main__":
    main()