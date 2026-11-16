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


def reaction_enthalpy(values: list, weights: list[int]):
    """Sum of value x weight (products positive, reactants negative), rounded
    half away from zero to the decimal places of the least precise input. An
    exact 0 (an element in its standard state) doesn't limit the precision.

    An input may be a range {"min", "max"}, where two reviewed sources
    differ; the result is then the range from the lowest possible sum to the
    highest."""
    if len(values) != len(weights):
        raise ValueError("one weight is needed per formation enthalpy")
    ends = [(v["min"], v["max"]) if isinstance(v, dict) else (v, v) for v in values]
    places = [_places(x) for e in ends for x in e if x != 0]
    if not places:
        return 0
    q = Decimal(1).scaleb(-min(places))

    def total(lowest: bool):
        # A positive weight is lowest at the input's minimum; a negative one at its maximum.
        t = sum(Decimal(repr(float(e[0] if (w > 0) == lowest else e[1]))) * w for e, w in zip(ends, weights))
        out = float(t.copy_abs().quantize(q, rounding=ROUND_HALF_UP).copy_sign(t))
        return (int(out) if min(places) == 0 else out) or 0

    lo, hi = total(True), total(False)
    return lo if lo == hi else {"min": lo, "max": hi}


ROOM_TEMPERATURE_C = 25


def state_at_room_temperature(melting_c, boiling_c: float | None = None) -> str:
    """Solid, liquid or gas at 25 °C, from the melting and boiling points in
    °C. A melting point alone is enough for a solid. A melting range (a
    substance that melts or decomposes over a span) is a solid if even its
    lowest point is above room temperature."""
    if isinstance(melting_c, dict):
        if boiling_c is None and melting_c["min"] > ROOM_TEMPERATURE_C:
            return "solid"
        raise ValueError("a melting range reaching room temperature has no single state")
    if boiling_c is not None and melting_c >= boiling_c:
        raise ValueError("melting point must be below boiling point")
    if melting_c > ROOM_TEMPERATURE_C:
        return "solid"
    if boiling_c is None:
        raise ValueError("below room temperature, the state also needs the boiling point")
    if boiling_c < ROOM_TEMPERATURE_C:
        return "gas"
    if melting_c < ROOM_TEMPERATURE_C < boiling_c:
        return "liquid"
    raise ValueError("a melting or boiling point at exactly room temperature has no single state")


def _listed(names: list[str]) -> str:
    return "".join(names) if len(names) < 2 else f"{', '.join(names[:-1])} and {names[-1]}"


def summary_from_equation(names: list[str], weights: list[int]) -> str:
    """The plain-language summary of an equation (twin of summaryFromEquation)."""
    if any(w not in (1, -1) for w in weights):
        raise ValueError("weights must be -1 (reactant) or 1 (product)")
    reactants = [n for n, w in zip(names, weights) if w == -1]
    products = [n for n, w in zip(names, weights) if w == 1]
    if not reactants:
        raise ValueError("an equation needs at least one reactant")
    if 1 in weights and max(i for i, w in enumerate(weights) if w == -1) > weights.index(1):
        raise ValueError("reactants must come before products")
    if not products:
        if len(reactants) < 2:
            raise ValueError("a no-reaction pair needs two substances")
        sentence = f"{_listed(reactants)} don't react under everyday conditions."
    elif len(reactants) == 1:
        sentence = f"{reactants[0]} breaks down into {_listed(products)}."
    elif len(products) == 1:
        sentence = f"{_listed(reactants)} combine to make {products[0]}."
    else:
        sentence = f"{_listed(reactants)} react to make {_listed(products)}."
    return sentence[0].upper() + sentence[1:]


def energy_direction(enthalpy) -> str:
    lo, hi = (enthalpy["min"], enthalpy["max"]) if isinstance(enthalpy, dict) else (enthalpy, enthalpy)
    if hi < 0:
        return "exothermic"
    if lo > 0:
        return "endothermic"
    raise ValueError("a reaction enthalpy of zero, or a range that spans zero, has no direction")
