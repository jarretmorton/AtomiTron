"""Formula, equation and enthalpy arithmetic: the Python twin of
app/src/data/chemistry.ts and the reaction rules in app/src/data/derive.ts.

The pipeline computes with these; the build gate recomputes independently in
TypeScript, so a bug in either shows up as a disagreement.
"""

from __future__ import annotations

import re
from decimal import ROUND_HALF_UP, Decimal
from functools import reduce
from math import gcd


def parse_formula(formula: str) -> dict[str, int] | None:
    """'Ca(OH)2' -> {'Ca': 1, 'O': 2, 'H': 2}. Element symbols, counts and
    round brackets only; anything else returns None."""
    pos = 0

    def group(closing: bool) -> dict[str, int] | None:
        nonlocal pos
        out: dict[str, int] = {}
        found = False
        while pos < len(formula):
            ch = formula[pos]
            if ch == ")":
                if not closing:
                    return None
                break
            if ch == "(":
                pos += 1
                part = group(True)
                if part is None or pos >= len(formula) or formula[pos] != ")":
                    return None
                pos += 1
            else:
                m = re.match(r"[A-Z][a-z]?", formula[pos:])
                if not m:
                    return None
                pos += m.end()
                part = {m.group(0): 1}
            n = re.match(r"[1-9][0-9]*", formula[pos:])
            if n:
                pos += n.end()
            for el, count in part.items():
                out[el] = out.get(el, 0) + count * (int(n.group(0)) if n else 1)
            found = True
        return out if found else None

    result = group(False)
    return result if result is not None and pos == len(formula) else None


def atom_totals(terms: list[tuple[int, dict[str, int]]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for coefficient, composition in terms:
        for el, n in composition.items():
            out[el] = out.get(el, 0) + n * coefficient
    return out


def is_balanced(reactants, products) -> bool:
    return atom_totals(reactants) == atom_totals(products)


def in_lowest_terms(coefficients: list[int]) -> bool:
    return reduce(gcd, coefficients) == 1


_TERM = re.compile(r"(?:(\d+) )?(\S+?)\((s|l|g)\)")


def parse_equation(equation: str) -> tuple[list[tuple[int, str, str]], list[tuple[int, str, str]]] | None:
    """'2 Na(s) + Cl2(g) -> 2 NaCl(s)' -> two lists of (coefficient, formula,
    phase). None if any term doesn't fit that shape."""
    if equation.count(" -> ") != 1:
        return None
    sides = []
    for side in equation.split(" -> "):
        terms = []
        for term in side.split(" + "):
            m = _TERM.fullmatch(term.strip())
            if not m:
                return None
            terms.append((int(m.group(1) or 1), m.group(2), m.group(3)))
        sides.append(terms)
    return sides[0], sides[1]


def _places(v: float) -> int:
    """Decimal places in the number's shortest form, as JavaScript prints it."""
    text = repr(float(v)) if not float(v).is_integer() else str(int(v))
    return len(text.split(".")[1]) if "." in text else 0


def reaction_enthalpy(values: list[float], weights: list[int]) -> float:
    """Sum of value x weight (products positive, reactants negative), rounded
    half away from zero to the decimal places of the least precise input. An
    exact 0 (an element in its standard state) doesn't limit the precision."""
    if len(values) != len(weights):
        raise ValueError("one weight is needed per formation enthalpy")
    places = [_places(v) for v in values if v != 0]
    if not places:
        return 0
    total = sum(Decimal(repr(float(v))) * w for v, w in zip(values, weights))
    q = Decimal(1).scaleb(-min(places))
    rounded = total.copy_abs().quantize(q, rounding=ROUND_HALF_UP).copy_sign(total)
    out = float(rounded)
    return (int(out) if min(places) == 0 else out) or 0


def energy_direction(enthalpy: float) -> str:
    if enthalpy == 0:
        raise ValueError("a reaction enthalpy of zero has no direction")
    return "exothermic" if enthalpy < 0 else "endothermic"
