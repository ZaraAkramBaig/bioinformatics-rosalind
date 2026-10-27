"""
Backend for the EDTA visualizer.

Serves the frontend in ./static and exposes one API endpoint that runs the
real solution from edit_distance_alignment.py:

    POST /api/align   {"s": "PRETTY", "t": "PRTTEIN"}
    -> {"s", "t", "distance", "aligned_s", "aligned_t", "dp", "path"}

Usage:
    python server.py [port]        (default port 8000)
Then open http://localhost:8000 in a browser.
"""

import json
import os
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from edit_distance_alignment import build_dp_table, traceback, traceback_path

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
MAX_LENGTH = 30  # keeps the table small enough to draw on screen


def align(s, t):
    """Run the EDTA solution and return everything the frontend needs to draw it."""
    dp = build_dp_table(s, t)
    aligned_s, aligned_t = traceback(s, t, dp)
    path = [{"i": i, "j": j, "op": op} for i, j, op in traceback_path(s, t, dp)]
    return {
        "s": s,
        "t": t,
        "distance": dp[len(s)][len(t)],
        "aligned_s": aligned_s,
        "aligned_t": aligned_t,
        "dp": dp,
        "path": path,
    }


def clean(value):
    """Keep letters only, in upper case (protein / DNA alphabet)."""
    return "".join(ch for ch in str(value).upper() if "A" <= ch <= "Z")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/api/align":
            self.send_json(404, {"error": "Unknown endpoint."})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Request body must be JSON like {\"s\": \"...\", \"t\": \"...\"}."})
            return

        s, t = clean(payload.get("s", "")), clean(payload.get("t", ""))
        if not s or not t:
            self.send_json(400, {"error": "Enter at least one letter in both s and t."})
            return
        if len(s) > MAX_LENGTH or len(t) > MAX_LENGTH:
            self.send_json(400, {"error": f"Each sequence can have at most {MAX_LENGTH} letters in the visualizer."})
            return

        self.send_json(200, align(s, t))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://localhost:{port}"
    print(f"EDTA visualizer running at {url}  (Ctrl+C to stop)")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
