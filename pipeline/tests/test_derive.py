"""The Python derivation twin. Same cases as tests/derive.test.ts, so the two
implementations are held to the same answers."""

import unittest

from pipeline.derive import (
    DerivationError, derive, electron_count, normalize_configuration, parse_configuration, shell_counts,
)


class Configurations(unittest.TestCase):
    CASES = [
        ("1s1", 1, [1]),
        ("[Ne]3s1", 11, [2, 8, 1]),
        ("[Ar]4s13d10", 29, [2, 8, 18, 1]),
        ("[Kr]5s24d5", 43, [2, 8, 18, 13, 2]),
        ("[Xe]4f145d106s26p2", 82, [2, 8, 18, 32, 18, 4]),
        ("[Rn]5f36d17s2", 92, [2, 8, 18, 32, 21, 9, 2]),
        ("[Rn] 7s2 7p6 5f14 6d10\u200b(predicted)", 118, [2, 8, 18, 32, 32, 18, 8]),
    ]

    def test_parse(self):
        for text, electrons, shells in self.CASES:
            occ = parse_configuration(text)
            self.assertEqual(electron_count(occ), electrons, text)
            self.assertEqual(shell_counts(occ), shells, text)

    def test_rejects(self):
        for text in ("1s2 2d1", "[Ne] 3s3", "[Ne] 3s1 3s1", "[Ne] 2p1", "[Fe] 4s2", "", "garbage"):
            self.assertIsNone(parse_configuration(text), text)

    def test_normalize(self):
        self.assertEqual(normalize_configuration("[Ar]4s13d10"), "[Ar] 3d10 4s1")
        self.assertEqual(normalize_configuration("[Xe]6s24f145d106p2"), "[Xe] 4f14 5d10 6s2 6p2")
        self.assertEqual(normalize_configuration("[Rn] 7s2 7p6 5f14 6d10(predicted)"), "[Rn] 5f14 6d10 7s2 7p6")
        self.assertEqual(normalize_configuration("1s2"), "1s2")


class Rules(unittest.TestCase):
    def test_counts(self):
        self.assertEqual(derive("protons-equal-atomic-number", [11]), 11)
        self.assertEqual(derive("neutrons-from-mass-number", [63, 29]), 34)  # copper-63, not 64
        with self.assertRaises(DerivationError):
            derive("neutrons-from-mass-number", [10, 29])

    def test_valence(self):
        self.assertEqual(derive("valence-main-group", ["1s2", 18]), 2)
        self.assertEqual(derive("valence-main-group", ["[Ne]3s23p5", 17]), 7)
        self.assertEqual(derive("valence-main-group", ["[Xe]4f145d106s26p2", 14]), 4)
        with self.assertRaises(DerivationError):
            derive("valence-main-group", ["[Ar]4s13d10", 11])


if __name__ == "__main__":
    unittest.main()
