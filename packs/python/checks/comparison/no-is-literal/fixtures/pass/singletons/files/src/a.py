def check(value, flag):
    if value is None or flag is True:
        return 0 < len(value or ()) is not None
    return value is not Ellipsis
