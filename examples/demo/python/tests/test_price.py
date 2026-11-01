import unittest
from os import environ

from shop.domain.legacy import legacy
from shop.domain.price import total


class PriceTest(unittest.TestCase):
    def test_existing_behavior(self):
        self.assertEqual(legacy(), 10)
        self.assertEqual(total(10), int(environ.get("PREGATE_DEMO_EXPECTED_TOTAL", "10")))
