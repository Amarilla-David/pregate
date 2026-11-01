import collections


collect = lambda item, acc=[]: acc + [item]


def group(rows, *, buckets=collections.defaultdict(list)):
    for key, row in rows:
        buckets[key].append(row)
    return buckets
