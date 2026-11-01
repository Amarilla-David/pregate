def merge(base: dict = {},
          seen: set = set()):
    seen.add(id(base))
    return base
