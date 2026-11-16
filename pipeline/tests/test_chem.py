"""Formula, equation and enthalpy arithmetic. Same cases as
tests/reactions.test.ts, so the Python and TypeScript versions are held to
the same answers."""

import unittest

from pipeline.chem import (
    energy_direction, in_lowest_terms, is_balanced, parse_equation, parse_formula, reaction_enthalpy,
    state_at_room_temperature,
)
from pipeline.compounds import choose, enthalpy_value, Row


class Formulas(unittest.TestCase):
    def test_parse(self):
        self.assertEqual(parse_formula("NaCl"), {"Na": 1, "Cl": 1})
        self.assertEqual(parse_formula("Ca(OH)2"), {"Ca": 1, "O": 2, "H": 2})
        self.assertEqual(parse_formula("C6H12O6"), {"C": 6, "H": 12, "O": 6})
        self.assertEqual(parse_formula("Al2(SO4)3"), {"Al": 2, "S": 3, "O": 12})
        self.assertEqual(parse_formula("ClNa"), parse_formula("NaCl"))

    def test_reject(self):
        for f in ("", "nacl", "Na+", "Na Cl", "Ca(OH", "Ca)OH(", "2H2O", "H0", "CuSO4.5H2O"):
            self.assertIsNone(parse_formula(f), f)


class Equations(unittest.TestCase):
    def test_parse_and_balance(self):
        r, p = parse_equation("CH4(g) + 2 O2(g) -> CO2(g) + 2 H2O(l)")
        self.assertEqual(r, [(1, "CH4", "g"), (2, "O2", "g")])
        self.assertEqual(p, [(1, "CO2", "g"), (2, "H2O", "l")])
        side = lambda terms: [(c, parse_formula(f)) for c, f, _ in terms]
        self.assertTrue(is_balanced(side(r), side(p)))
        r, p = parse_equation("H2(g) + O2(g) -> H2O(l)")
        self.assertFalse(is_balanced(side(r), side(p)))
        self.assertIsNone(parse_equation("2 Na + Cl2 -> 2 NaCl"))

    def test_lowest_terms(self):
        self.assertTrue(in_lowest_terms([2, 1, 2]))
        self.assertFalse(in_lowest_terms([4, 2, 4]))


class Enthalpy(unittest.TestCase):
    def test_same_answers_as_typescript(self):
        self.assertEqual(reaction_enthalpy([0, 0, -411.12], [-2, -1, 2]), -822.24)
        self.assertEqual(reaction_enthalpy([-285.83, 0, 0], [-2, 2, 1]), 571.66)
        self.assertEqual(reaction_enthalpy([-74.6, 0, -393.51, -285.83], [-1, -2, 1, 2]), -890.6)
        self.assertEqual(reaction_enthalpy([0.25, 0.1], [1, 1]), 0.4)
        self.assertEqual(reaction_enthalpy([-0.25, -0.1], [1, 1]), -0.4)
        self.assertEqual(reaction_enthalpy([0.1, 0.2], [1, 1]), 0.3)
        self.assertEqual(reaction_enthalpy([0, 0], [-1, 1]), 0)

    def test_ranges(self):
        mgo = {"min": -601.6, "max": -601.24}
        self.assertEqual(reaction_enthalpy([0, 0, mgo], [-2, -1, 2]), {"min": -1203.2, "max": -1202.5})
        self.assertEqual(reaction_enthalpy([mgo, 0, 0], [-2, 2, 1]), {"min": 1202.5, "max": 1203.2})
        self.assertEqual(energy_direction({"min": -1203.2, "max": -1202.5}), "exothermic")
        with self.assertRaises(ValueError):
            energy_direction({"min": -1, "max": 1})

    def test_state(self):
        self.assertEqual(state_at_room_temperature(97.8, 883), "solid")
        self.assertEqual(state_at_room_temperature(-7.2, 58.8), "liquid")
        self.assertEqual(state_at_room_temperature(-101.5, -34.04), "gas")
        for mp, bp in ((25, 100), (100, 50)):
            with self.assertRaises(ValueError):
                state_at_room_temperature(mp, bp)
        self.assertEqual(state_at_room_temperature(660.32), "solid")
        with self.assertRaises(ValueError):
            state_at_room_temperature(-7.2)

    def test_direction(self):
        self.assertEqual(energy_direction(-822.24), "exothermic")
        self.assertEqual(energy_direction(571.66), "endothermic")


class Ghs(unittest.TestCase):
    def test_statement(self):
        from pipeline.compounds import GHS
        m = GHS.match("H260 (100%): In contact with water releases flammable gases which may ignite spontaneously [Danger Substances]")
        self.assertEqual((m.group(1), m.group(2), m.group(3)),
                         ("H260", "100", "In contact with water releases flammable gases which may ignite spontaneously"))
        self.assertEqual(GHS.match("H318 (45.1%): Causes serious eye damage [Danger Serious eye damage]").group(2), "45.1")
        self.assertIsNone(GHS.match("H260: In contact with water releases flammable gases"))  # no share given


class NistValues(unittest.TestCase):
    def row(self, raw, method="Review", ref="Chase, 1998"):
        return Row("s", enthalpy_value(raw), raw, method, ref)

    def test_values(self):
        self.assertEqual(enthalpy_value("-601.60 ± 0.30").uncertainty, 0.30)
        self.assertEqual(enthalpy_value("-84. ± 0.4").value, -84)
        self.assertIsNone(enthalpy_value("about -84"))

    def test_choose(self):
        best, others, q, _ = choose([self.row("-285.83"), self.row("-285.830 ± 0.040", ref="Cox, Wagman, et al., 1984")])
        self.assertEqual((best.reference[:3], len(others), q), ("Cox", 1, None))
        best, _, q, _ = choose([self.row("-1274.5", "Ccb", "Huffman and Fox, 1938")])
        self.assertEqual((best.num.value, q), (-1274.5, "single measurement"))
        # Two reviews that differ beyond the stated uncertainty: a range.
        best, both, q, note = choose([self.row("-601.60 ± 0.30", ref="Cox, Wagman, et al., 1984"), self.row("-601.24")])
        self.assertIsNone(best)
        self.assertEqual((len(both), q), (2, "reviewed sources differ"))
        # Measurements that disagree are still left out.
        best, both, _, note = choose([self.row("-10.0 ± 0.1", "Ccb", "A, 1990"), self.row("-12.0 ± 0.1", "Ccb", "B, 1991")])
        self.assertEqual((best, both), (None, []))
        self.assertIn("disagree", note)
        # A review outranks measurements.
        best, others, q, _ = choose([self.row("-74.5 ± 0.4", "Ccb", "Pittam, 1972"), self.row("-74.87")])
        self.assertEqual((best.num.value, others, q), (-74.87, [], None))


if __name__ == "__main__":
    unittest.main()
