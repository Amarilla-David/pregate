from dataclasses import dataclass, field


@dataclass
class Order:
    lines: list = field(default_factory=list)
    totals = {}
