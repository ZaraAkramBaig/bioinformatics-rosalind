"""
Rosalind KMP - Speeding Up Motif Finding
https://rosalind.info/problems/kmp/

Given a DNA string s in FASTA format, print its failure array P, where P[i]
is the length of the longest proper prefix of s[0..i] that is also a suffix
of s[0..i].

Usage:
    python kmp.py [input_file]
(input_file defaults to kmp_input.txt in the same folder as this script)
"""

import os
import sys


def read_fasta(text):
    """Return the DNA sequence from the first record of a FASTA string."""
    seq_parts = []
    for line in text.strip().splitlines():
        line = line.strip()
        if line.startswith(">"):
            if seq_parts:          # stop at the start of a second record
                break
            continue
        seq_parts.append(line)
    return "".join(seq_parts).upper()


def failure_array(s):
    """
    Return the failure array of s.
    Time: O(n)   Space: O(n)
    """
    n = len(s)
    P = [0] * n
    k = 0                              # length of the current matched prefix

    for i in range(1, n):
        while k > 0 and s[i] != s[k]:  # mismatch: fall back to a shorter prefix
            k = P[k - 1]
        if s[i] == s[k]:               # the matched prefix grows by one
            k += 1
        P[i] = k

    return P


def main():
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    else:
        filename = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kmp_input.txt")

    with open(filename, "r") as file:
        text = file.read()
    s = read_fasta(text)

    print(" ".join(map(str, failure_array(s))))


if __name__ == "__main__":
    main()
