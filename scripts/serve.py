#!/usr/bin/env python3
"""
Local dev server for La Cucina recipe site.
Run from the project folder:  python3 scripts/serve.py
Then open:                    http://localhost:8000

Stop server:
- Same terminal: Ctrl+C
- Different terminal:
pgrep -fa scripts/serve.py
kill <PID>
kill -9 <PID>   # only if needed
- By port (fallback):
fuser -k 8000/tcp

"""

import http.server
import socketserver
import os
import sys

PORT = 8000
HOST = "localhost"
FALLBACK_PORT = 8001


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


class Handler(http.server.SimpleHTTPRequestHandler):
    # Suppress per-request log noise — comment out to see all requests
    def log_message(self, format, *args):
        pass

    # Ignore client disconnects while streaming a response (common during dev refreshes).
    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass


def create_server_with_fallback():
    """Bind to PORT, or FALLBACK_PORT if PORT is already in use."""
    try:
        return ReusableTCPServer((HOST, PORT), Handler), PORT
    except OSError as first_error:
        if "Address already in use" not in str(first_error):
            raise

        try:
            print(
                f"⚠  Port {PORT} is already in use. Falling back to port {FALLBACK_PORT}."
            )
            return ReusableTCPServer((HOST, FALLBACK_PORT), Handler), FALLBACK_PORT
        except OSError as second_error:
            if "Address already in use" in str(second_error):
                print(f"✗  Ports {PORT} and {FALLBACK_PORT} are already in use.")
                print(
                    "   Stop the other process(es) or change PORT/FALLBACK_PORT in scripts/serve.py."
                )
                sys.exit(1)
            raise


def main():
    # Serve from project root (parent of the scripts/ directory)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    os.chdir(project_root)

    # Check that the key files are present
    missing = [
        f
        for f in ("index.html", "style.css", "app.js", "data/recipes.json")
        if not os.path.exists(f)
    ]
    if missing:
        print(f"⚠  Missing files: {', '.join(missing)}")
        print("   Make sure you're running this script from the project structure.")
        sys.exit(1)

    try:
        httpd, active_port = create_server_with_fallback()
        with httpd:
            print()
            print("  ✦  La Cucina — local dev server")
            print(f"     Serving from: {project_root}")
            print(f"     URL:          http://{HOST}:{active_port}")
            print()
            print("  Press Ctrl+C to stop.")
            print(f"  Open in browser: http://{HOST}:{active_port}")
            print()

            httpd.serve_forever()

    except OSError as e:
        if "Address already in use" in str(e):
            print(f"✗  Port {PORT} is already in use.")
            print(
                "   Either stop the other process, or change PORT in scripts/serve.py."
            )
        else:
            print(f"✗  Server error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n  Server stopped. Goodbye!")


if __name__ == "__main__":
    main()
