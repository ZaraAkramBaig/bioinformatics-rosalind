import os
import sys

COMPLEMENT = {"A": "T", "T": "A", "C": "G", "G": "C"}


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


def reverse_complement(s):
    """Return the reverse complement of a DNA string."""
    return "".join(COMPLEMENT[base] for base in reversed(s))


def find_reverse_palindromes(dna, min_len=4, max_len=12):
    """
    Return a list of (position, length) pairs for every reverse palindrome
    in dna whose length is between min_len and max_len (positions are 1-based).
    """
    results = []
    n = len(dna)

    for i in range(n):                                  # start index (0-based)
        for length in range(min_len, max_len + 1):      # candidate length
            if i + length > n:                          # would run past the end
                break
            sub = dna[i:i + length]
            if sub == reverse_complement(sub):
                results.append((i + 1, length))         # convert to 1-based

    return results


def main():
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    else:
        filename = os.path.join(os.path.dirname(os.path.abspath(__file__)), "input.txt")

    with open(filename, "r") as file:
        text = file.read()
    dna = read_fasta(text)

    for pos, length in find_reverse_palindromes(dna):
        print(pos, length)


if __name__ == "__main__":
    main()
