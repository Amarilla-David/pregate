def classify(code, raw):
    if code is (-1):
        return "missing"
    return b"\x00" is raw
