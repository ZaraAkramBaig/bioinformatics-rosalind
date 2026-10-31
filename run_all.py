"""
Run all three solutions on their sample input and print the output.

    python run_all.py
"""

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))

PROBLEMS = [
    ("Alignment (EDTA)", "alignment", "edit_distance_alignment.py"),
    ("Dynamic Programming (LGIS)", "dynamicprogramming", "liss.py"),
    ("String Algorithms (KMP)", "string", "kmp.py"),
]


def main():
    for name, folder, script in PROBLEMS:
        print(f"=== {name} ===", flush=True)
        subprocess.run([sys.executable, os.path.join(ROOT, folder, script)])
        print(flush=True)


if __name__ == "__main__":
    main()
