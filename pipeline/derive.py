"""Python twin of app/src/data/derive.ts.

The pipeline computes derived values here. The build gate recomputes them
independently with the TypeScript version, so a bug in either one shows up as
a disagreement instead of shipping silently.
"""

from __future__ import annotations

import re

CAPACITY = {"s": 2, "p": 6, "d": 10, "f": 14}
FIRST_SHELL = {"s": 1, "p": 2, "d": 3, "f": 4}
CORES = {
    "He": "1s2",
    "Ne": "[He] 2s2 2p6",
    "Ar": "[Ne] 3s2 3p6",
    "Kr": "[Ar] 3d10 4s2 4p6",
    "Xe": "[Kr] 4d10 5s2 5p6",
    "Rn": "[Xe] 4f14 5d10 6s2 6p6",
}
MAIN_GROUPS = {1, 2, 13, 14, 15, 16, 17, 18}
ORDER = "spdf"


class DerivationError(ValueError):
    pass


def parse_configuration(text: str) -> dict[str, int] | None:
    """Same grammar as derive.ts: core, then subshells split by capacity with
    backtracking, ignoring '(predicted)' and whitespace."""
    s = re.sub(r"\(?(predicted|calculated)\)?|probably", "", text, flags=re.I)
    s = re.sub(r"[\s\u200b]+", "", s)
    occ: dict[str, int] = {}
    if m := re.match(r"^\[(He|Ne|Ar|Kr|Xe|Rn)\]", s):
        inner = parse_configuration(CORES[m.group(1)])
        if inner is None:
            return None
        occ.update(inner)
        s = s[m.end():]
    body = _body(s, 0)
    if body is None:
        return None
    for k, v in body:
        if k in occ:
            return None
        occ[k] = v
    return occ or None


def _body(s: str, i: int) -> list[tuple[str, int]] | None:
    if i == len(s):
        return []
    m = re.match(r"([1-7])([spdf])", s[i:])
    if not m:
        return None
    n, letter = int(m.group(1)), m.group(2)
    if n < FIRST_SHELL[letter]:
        return None
    start = i + 2
    for length in (2, 1):
        digits = s[start:start + length]
        if len(digits) != length or not re.fullmatch(r"[1-9]\d?", digits):
            continue
        count = int(digits)
        if count > CAPACITY[letter]:
            continue
        rest = _body(s, start + length)
        if rest is not None:
            return [(f"{n}{letter}", count), *rest]
    return None


def normalize_configuration(text: str) -> str | None:
    """'[Ar]4s13d10' -> '[Ar] 3d10 4s1': keep the noble-gas core, then list
    the remaining subshells by shell, then s, p, d, f."""
    occ = parse_configuration(text)
    if occ is None:
        return None
    s = re.sub(r"[\s\u200b]+", "", re.sub(r"\(?(predicted|calculated)\)?|probably", "", text, flags=re.I))
    core = re.match(r"^\[(He|Ne|Ar|Kr|Xe|Rn)\]", s)
    core_occ = parse_configuration(CORES[core.group(1)]) if core else {}
    rest = sorted(
        ((k, v) for k, v in occ.items() if k not in (core_occ or {})),
        key=lambda kv: (int(kv[0][0]), ORDER.index(kv[0][1])),
    )
    parts = ([f"[{core.group(1)}]"] if core else []) + [f"{k}{v}" for k, v in rest]
    return " ".join(parts)


def electron_count(occ: dict[str, int]) -> int:
    return sum(occ.values())


def shell_counts(occ: dict[str, int]) -> list[int]:
    shells: list[int] = []
    for sub, count in occ.items():
        n = int(sub[0])
        while len(shells) < n:
            shells.append(0)
        shells[n - 1] += count
    return shells


def valence_main_group(occ: dict[str, int], group: int) -> int:
    if group not in MAIN_GROUPS:
        raise DerivationError(f"valence is only derived for main groups, not group {group}")
    outer = max(int(k[0]) for k in occ if k[1] in "sp")
    return sum(v for k, v in occ.items() if int(k[0]) == outer and k[1] in "sp")


def derive(rule: str, inputs: list) -> int | list[int]:
    def config(v):
        occ = parse_configuration(v) if isinstance(v, str) else None
        if occ is None:
            raise DerivationError(f"unparseable electron configuration: {v!r}")
        return occ

    if rule in ("protons-equal-atomic-number", "electrons-equal-atomic-number"):
        (z,) = inputs
        return z
    if rule == "neutrons-from-mass-number":
        a, z = inputs
        if a < z:
            raise DerivationError("mass number is smaller than atomic number")
        return a - z
    if rule == "shells-from-configuration":
        (c,) = inputs
        return shell_counts(config(c))
    if rule == "valence-main-group":
        c, g = inputs
        return valence_main_group(config(c), g)
    raise DerivationError(f"unknown rule {rule}")
