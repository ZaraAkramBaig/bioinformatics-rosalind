"""
Backend for the LGIS visualizer.

Serves the frontend in ./static and exposes one API endpoint:

    POST /api/lgis   {"dataset": "5\n5 1 4 2 3"}   (Rosalind input format)
    -> {"n", "perm", "output", "increasing", "decreasing"}

"increasing" and "decreasing" each hold a step-by-step trace of the
tails / binary-search algorithm from liss.py, so the page can replay it.

Usage:
    python server.py [port]        (default port 8001)
Then open http://localhost:8001 in a browser.
"""

import json
import os
import sys
import webbrowser
from bisect import bisect_left
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from liss import longest_increasing_subsequence, solve

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
MAX_N = 30  # keeps the rows small enough to draw on screen


def trace_lis(arr):
    """Repeat the steps of longest_increasing_subsequence, recording each one.

    The final answer is checked against liss.py so the trace can never drift
    away from the real solution.
    """
    tails, tails_idx, parent = [], [], [-1] * len(arr)
    steps = []

    for i, x in enumerate(arr):
        pos = bisect_left(tails, x)
        replaced, replaced_idx = None, None
        if pos == len(tails):
            tails.append(x)
            tails_idx.append(i)
        else:
            replaced, replaced_idx = tails[pos], tails_idx[pos]
            tails[pos] = x
            tails_idx[pos] = i
        parent[i] = tails_idx[pos - 1] if pos > 0 else -1
        steps.append({
            "i": i, "x": x, "pos": pos,
            "replaced": replaced, "replaced_idx": replaced_idx,
            "tails": list(tails), "tails_idx": list(tails_idx),
            "parent": parent[i],
        })

    # Walk back through parent pointers, exactly like liss.py does
    chain = []
    k = tails_idx[-1]
    while k != -1:
        chain.append(k)
        k = parent[k]
    result = [arr[k] for k in reversed(chain)]

    if result != longest_increasing_subsequence(arr):
        raise RuntimeError("Trace does not match liss.py")
    return {"array": arr, "steps": steps, "chain": chain, "result": result}


def parse_dataset(text):
    """Read n and the permutation the same way liss.py's main() does."""
    data = str(text).split()
    if not data:
        raise ValueError("Enter n on the first line, then the permutation.")
    try:
        n = int(data[0])
        perm = list(map(int, data[1:1 + n]))
    except ValueError:
        raise ValueError("The dataset can only contain whole numbers.")
    if n < 1 or n > MAX_N:
        raise ValueError(f"n must be between 1 and {MAX_N} in the visualizer.")
    if len(perm) != n:
        raise ValueError(f"n is {n}, but {len(perm)} number(s) follow it.")
    return n, perm


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
        if self.path != "/api/lgis":
            self.send_json(404, {"error": "Unknown endpoint."})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
            n, perm = parse_dataset(payload.get("dataset", ""))
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Request body must be JSON like {\"dataset\": \"...\"}."})
            return
        except ValueError as err:
            self.send_json(400, {"error": str(err)})
            return

        inc, dec = solve(n, perm)
        decreasing = trace_lis([-x for x in perm])
        self.send_json(200, {
            "n": n,
            "perm": perm,
            "output": {"increasing": inc, "decreasing": dec},
            "increasing": trace_lis(perm),
            "decreasing": decreasing,
        })


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://localhost:{port}"
    print(f"LGIS visualizer running at {url}  (Ctrl+C to stop)")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
