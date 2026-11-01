def expensive(arg, *, _cache={}):
    if arg not in _cache:
        _cache[arg] = arg * 2
    return _cache[arg]
