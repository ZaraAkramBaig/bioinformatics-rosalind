import sys
from bisect import bisect_left


def longest_increasing_subsequence(arr):
    """
    Returns one longest strictly increasing subsequence of arr.
    Time: O(n log n)   Space: O(n)
    """
    n = len(arr)
    tails = []                 # tails[k] = smallest tail value of an inc. subseq. of length k+1
    tails_idx = []             # tails_idx[k] = index in arr of that tail value
    parent = [-1] * n          # parent[i] = index of previous element in the subsequence ending at i

    for i, x in enumerate(arr):
        pos = bisect_left(tails, x)          # first position where tails[pos] >= x

        if pos == len(tails):                # x extends the longest subsequence so far
            tails.append(x)
            tails_idx.append(i)
        else:                                # x gives a smaller tail for length pos+1
            tails[pos] = x
            tails_idx[pos] = i

        parent[i] = tails_idx[pos - 1] if pos > 0 else -1

    # Reconstruct the subsequence by walking back through parent pointers
    result = []
    k = tails_idx[-1]
    while k != -1:
        result.append(arr[k])
        k = parent[k]
    result.reverse()
    return result


def solve(n, perm):
    inc = longest_increasing_subsequence(perm)

    # Longest decreasing subsequence = LIS of the negated sequence
    neg = [-x for x in perm]
    dec = [-x for x in longest_increasing_subsequence(neg)]

    return inc, dec


def main():
    data = sys.stdin.read().split()
    n = int(data[0])
    perm = list(map(int, data[1:1 + n]))

    inc, dec = solve(n, perm)

    print(" ".join(map(str, inc)))
    print(" ".join(map(str, dec)))


if __name__ == "__main__":
    main()