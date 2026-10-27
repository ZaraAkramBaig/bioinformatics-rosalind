"""
Rosalind EDTA - Edit Distance Alignment
https://rosalind.info/problems/edta/

Given two protein strings s and t in FASTA format, print the edit distance
d_E(s, t) followed by two augmented strings s' and t' forming an optimal
alignment.

Usage:
    python edit_distance_alignment.py [input_file]
(input_file defaults to input.txt in the same folder as this script)
"""

import os
import sys


def read_fasta(filename):
    """Return the list of sequences in a FASTA file (headers are skipped)."""
    sequences = []
    current = ""
    with open(filename, "r") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            if line.startswith(">"):
                if current:
                    sequences.append(current)
                current = ""
            else:
                current += line
    if current:
        sequences.append(current)
    return sequences


def build_dp_table(s, t):
    """dp[i][j] = edit distance between the first i chars of s and first j chars of t."""
    m, n = len(s), len(t)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    # Base cases: turning a prefix into the empty string (or vice versa)
    for i in range(m + 1):
        dp[i][0] = i  # i deletions
    for j in range(n + 1):
        dp[0][j] = j  # j insertions

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if s[i - 1] == t[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,         # deletion  (s[i-1] aligned with '-')
                dp[i][j - 1] + 1,         # insertion ('-' aligned with t[j-1])
                dp[i - 1][j - 1] + cost,  # match / substitution
            )
    return dp


def traceback_path(s, t, dp):
    """Walk from dp[m][n] back to dp[0][0].

    Returns the moves taken as (i, j, op) tuples, where (i, j) is the cell the
    move starts from and op is "ins", "match", "sub" or "del".
    """
    path = []
    i, j = len(s), len(t)

    # When several moves give the same optimal score (a tie), we check them in
    # the order left -> diagonal -> up. Any order gives an optimal alignment;
    # this one reproduces the alignment shown in Rosalind's sample output.
    while i > 0 or j > 0:
        # Left: insertion of t[j-1]  ('-' aligned with t[j-1])
        if j > 0 and dp[i][j] == dp[i][j - 1] + 1:
            path.append((i, j, "ins"))
            j -= 1
        # Diagonal: match or substitution
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + (0 if s[i - 1] == t[j - 1] else 1):
            path.append((i, j, "match" if s[i - 1] == t[j - 1] else "sub"))
            i -= 1
            j -= 1
        # Up: deletion of s[i-1]  (s[i-1] aligned with '-')
        else:
            path.append((i, j, "del"))
            i -= 1
    return path


def traceback(s, t, dp):
    """Turn the traceback path into the two aligned strings s' and t'."""
    aligned_s = []
    aligned_t = []
    for i, j, op in traceback_path(s, t, dp):
        aligned_s.append("-" if op == "ins" else s[i - 1])
        aligned_t.append("-" if op == "del" else t[j - 1])

    # We built the alignment backwards, so reverse it
    return "".join(reversed(aligned_s)), "".join(reversed(aligned_t))


def edit_distance_alignment(s, t):
    dp = build_dp_table(s, t)
    aligned_s, aligned_t = traceback(s, t, dp)
    return dp[len(s)][len(t)], aligned_s, aligned_t


def main():
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    else:
        filename = os.path.join(os.path.dirname(os.path.abspath(__file__)), "input.txt")

    s, t = read_fasta(filename)[:2]
    distance, aligned_s, aligned_t = edit_distance_alignment(s, t)

    print(distance)
    print(aligned_s)
    print(aligned_t)


if __name__ == "__main__":
    main()
