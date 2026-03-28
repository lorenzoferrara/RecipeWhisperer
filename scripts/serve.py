#!/usr/bin/env python3
"""Run the Vite React dev server for La Cucina.

Usage:
  uv run scripts/serve.py
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

HOST = "localhost"
PORT = 8000
FALLBACK_PORT = 8001


def run_vite(port: int, project_root: str) -> int:
    cmd = [
        "npm",
        "run",
        "dev",
        "--",
        "--host",
        HOST,
        "--port",
        str(port),
        "--strictPort",
    ]
    return subprocess.run(cmd, cwd=project_root, check=False).returncode


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    os.chdir(project_root)

    if shutil.which("npm") is None:
        print("✗ npm non trovato. Installa Node.js prima di avviare il frontend React.")
        sys.exit(1)

    if not os.path.exists("package.json"):
        print("✗ package.json non trovato. La conversione React sembra incompleta.")
        sys.exit(1)

    print()
    print("  ✦  La Cucina — React dev server")
    print(f"     Serving from: {project_root}")
    print(f"     Preferred URL: http://{HOST}:{PORT}")
    print("  Press Ctrl+C to stop.")
    print()

    code = run_vite(PORT, project_root)
    if code == 0:
        return
    if code == 130:
        print("\n  Server stopped. Goodbye!")
        return

    print(f"⚠  Port {PORT} unavailable. Retrying on {FALLBACK_PORT}.")
    code = run_vite(FALLBACK_PORT, project_root)

    if code == 0:
        return
    if code == 130:
        print("\n  Server stopped. Goodbye!")
        return

    print("✗ Unable to start Vite dev server on both 8000 and 8001.")
    sys.exit(code)


if __name__ == "__main__":
    main()
