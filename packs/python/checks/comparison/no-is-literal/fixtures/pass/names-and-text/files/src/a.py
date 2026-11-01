MISSING = object()


def same(a, b):
    # a is 1 only in this comment
    note = "a is 1"
    return a is b or a is MISSING
