"""
Backend for the REVP visualizer.

Serves the frontend in ./static and exposes one API endpoint:

    POST /api/revp   {"dataset": ">Rosalind_24\nTCAATGCATGCGGGTCTATATGCAT"}
    -> {"dna", "results", "trace"}

"trace" lists every window the loops in find_reverse_palindromes look at,
so the page can replay the search one window at a time.

Usage:
    python server.py [port]        (default port 8002)
Then open http://localhost:8002 in a browser.
"""

import json
import os
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from revp import find_reverse_palindromes, read_fasta, reverse_complement

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
MAX_LENGTH = 60  # keeps the sequence short enough to draw on screen
MIN_LEN, MAX_LEN = 4, 12


def trace_search(dna):
    """Repeat the loops of find_reverse_palindromes, recording every window.

    The hits are checked against revp.py so the trace can never drift away
    from the real solution.
    """
    trace = []
    n = len(dna)
    for i in range(n):
        for length in range(MIN_LEN, MAX_LEN + 1):
            if i + length > n:
                trace.append({"i": i, "length": length, "brk": True})
                break
            sub = dna[i:i + length]
            rc = reverse_complement(sub)
            trace.append({"i": i, "length": length, "sub": sub, "rc": rc, "hit": sub == rc})

    hits = [(t["i"] + 1, t["length"]) for t in trace if t.get("hit")]
    results = find_reverse_palindromes(dna, MIN_LEN, MAX_LEN)
    if hits != results:
        raise RuntimeError("Trace does not match revp.py")
    return trace, results


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
        if self.path != "/api/revp":
            self.send_json(404, {"error": "Unknown endpoint."})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Request body must be JSON like {\"dataset\": \"...\"}."})
            return

        dna = read_fasta(str(payload.get("dataset", "")))
        if not dna:
            self.send_json(400, {"error": "Enter a DNA sequence in FASTA format (a >name line, then the bases)."})
            return
        bad = sorted(set(dna) - set("ACGT"))
        if bad:
            self.send_json(400, {"error": f"DNA can only contain A, C, G and T. Found: {', '.join(bad)}."})
            return
        if len(dna) > MAX_LENGTH:
            self.send_json(400, {"error": f"The visualizer shows up to {MAX_LENGTH} bases. This sequence has {len(dna)}."})
            return

        trace, results = trace_search(dna)
        self.send_json(200, {"dna": dna, "results": results, "trace": trace})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8002
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://localhost:{port}"
    print(f"REVP visualizer running at {url}  (Ctrl+C to stop)")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
