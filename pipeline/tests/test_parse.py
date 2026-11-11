"""Parsers, tested on real string formats catalogued from PubChem element pages."""

import unittest

from pipeline import parse as P
from pipeline.elements import expected_group, expected_period


class Numbers(unittest.TestCase):
    def test_grouped_digits_and_uncertainty(self):
        self.assertEqual(P.number("22.989 769 28(2)").value, 22.98976928)
        self.assertEqual(P.number("4.002602(2)").text, "4.002602")
        self.assertEqual(P.number("259.10103(11#)").value, 259.10103)

    def test_rejects_anything_else(self):
        for s in ("[98]", "about 7", "1.0.0", "", "Relative Mass: 294.21392(71#)"):
            self.assertIsNone(P.number(s), s)

    def test_agree_at_shorter_precision(self):
        self.assertTrue(P.agree(P.number("22.99"), P.number("22.98976928")))
        self.assertTrue(P.agree(P.number("63.55"), P.number("63.546")))
        self.assertFalse(P.agree(P.number("63.6"), P.number("63.546")))

    def test_interval(self):
        lo, hi = P.interval("[1.007 84, 1.008 11]")
        self.assertEqual((lo.value, hi.value), (1.00784, 1.00811))
        self.assertIsNone(P.interval("[1.1, 1.0]"))


class Fields(unittest.TestCase):
    def test_group(self):
        self.assertEqual(P.group("1 - Alkali Metal"), 1)
        self.assertEqual(P.group("11"), 11)
        self.assertEqual(P.group("3 - Lanthanide"), 3)
        self.assertEqual(P.group("- Actinide"), "none")
        self.assertIsNone(P.group("19"))

    def test_state(self):
        self.assertEqual(P.state("Solid"), ("Solid", False))
        self.assertEqual(P.state("Expected to be a Gas"), ("Expected to be a Gas", True))
        self.assertIsNone(P.state("Plasma"))

    def test_density_and_electronegativity(self):
        self.assertEqual(P.density("0.00008988 grams per cubic centimeter")[0].value, 0.00008988)
        self.assertTrue(P.density("about 7 grams per cubic centimeter")[1])
        self.assertEqual(P.electronegativity("0.93 (Pauling Scale)").value, 0.93)

    def test_table_positions(self):
        self.assertEqual([expected_period(z) for z in (1, 2, 3, 11, 19, 55, 118)], [1, 1, 2, 3, 4, 6, 7])
        self.assertEqual(expected_group(1), 1)
        self.assertEqual(expected_group(2), 18)
        self.assertEqual(expected_group(5), 13)
        self.assertEqual(expected_group(26), 8)
        self.assertEqual(expected_group(57), None)  # lanthanum
        self.assertEqual(expected_group(71), 3)  # lutetium
        self.assertEqual(expected_group(80), 12)
        self.assertEqual(expected_group(103), 3)  # lawrencium
        self.assertEqual(expected_group(118), 18)


class Temperatures(unittest.TestCase):
    def test_jefferson_lab(self):
        t = P.temperature("453.65 K (180.50°C or 356.90°F)")
        self.assertEqual(t.celsius.low.value, 180.5)
        self.assertTrue(P.temperature_self_consistent(t))

    def test_negative_and_rounded(self):
        t = P.temperature("13.81 K (-259.34°C or -434.81°F)")
        self.assertEqual(t.celsius.low.value, -259.34)
        self.assertTrue(P.temperature_self_consistent(P.temperature("1156 K (883°C or 1621°F)")))

    def test_self_inconsistent(self):
        self.assertFalse(P.temperature_self_consistent(P.temperature("300 K (100°C or 212°F)")))

    def test_los_alamos(self):
        self.assertEqual(P.temperature("-259.16°C").celsius.low.value, -259.16)
        self.assertTrue(P.temperature("~817°C").celsius.approx)

    def test_predicted_and_ranges(self):
        t = P.temperature("350±30K\u200b(80±30°C,\u200b170±50°F)(extrapolated)")
        self.assertEqual((t.celsius.low.value, t.celsius.high.value, t.marker), (50, 110, "extrapolated"))
        t = P.temperature("357+112-108K\u200b(84+112-108°C,\u200b183+202-194°F)")
        self.assertEqual((t.celsius.low.value, t.celsius.high.value), (-24, 196))
        t = P.temperature("623–823K\u200b(350–550°C,\u200b662–1022°F)(predicted)")
        self.assertEqual((t.celsius.low.value, t.celsius.high.value, t.marker), (350, 550, "predicted"))

    def test_qualifiers(self):
        self.assertEqual(P.temperature("3550°C(diamond)").qualifier, "diamond")
        self.assertEqual(P.temperature("3800°C(sublimation)").qualifier, "sublimation")
        t = P.temperature("44.15(whitephosphorus)")
        self.assertEqual((t.qualifier, t.celsius), ("whitephosphorus", None))

    def test_unknown_shape(self):
        self.assertIsNone(P.temperature("hot"))


class Isotopes(unittest.TestCase):
    def test_nuclides(self):
        self.assertEqual(P.nuclide(" 23Na"), (23, "Na", ""))
        self.assertEqual(P.nuclide("2D"), (2, "H", ""))
        self.assertEqual(P.nuclide("86Tcm"), (86, "Tc", "m"))

    def test_abundance(self):
        self.assertEqual(P.abundance("0.7576(10)").value, 0.7576)
        lo, hi = P.abundance("[0.999 72, 0.999 99]")
        self.assertEqual((lo.value, hi.value), (0.99972, 0.99999))
        self.assertIsNone(P.abundance(""))

    def test_half_life(self):
        h = P.half_life("4.21 My ± 0.16")
        self.assertEqual((h.value.value, h.unit), (4.21, "My"))
        self.assertGreater(h.seconds, P.half_life("2.6 My ± 0.4").seconds)
        self.assertEqual(P.half_life("Stable"), "Stable")
        for s in ("2 s [Estimated]", ">80 us", "Not-specified", "Stable >1.3Ey"):
            self.assertIsNone(P.half_life(s), s)

    def test_amdc_mass(self):
        self.assertEqual(P.amdc_mass("96.9063667 ± 0.0000040").value, 96.9063667)
        self.assertIsNone(P.amdc_mass("82.966377 ± 0.000537 [Estimated]"))


if __name__ == "__main__":
    unittest.main()
