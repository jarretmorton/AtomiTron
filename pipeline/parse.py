"""Strict parsers for the strings on PubChem element pages.

Every parser returns None for anything it doesn't fully recognize, so the
value is dropped and reported, never guessed (verification/methodology.md).
The formats handled here were catalogued across all 118 element pages.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import ROUND_HALF_DOWN, ROUND_HALF_UP, Decimal

# ---- Numbers ------------------------------------------------------------------


@dataclass(frozen=True)
class Num:
    """A number as the source wrote it. `text` keeps the digits for precision."""

    value: float
    text: str
    # Absolute standard uncertainty from concise notation: '47.867(1)' -> 0.001.
    uncertainty: float | None = None

    @property
    def decimals(self) -> int:
        return len(self.text.split(".")[1]) if "." in self.text else 0

    @property
    def half_ulp(self) -> float:
        """Half a unit in the last written place: the rounding a bare number implies."""
        return 0.5 * 10 ** -self.decimals


def clean(s: str) -> str:
    """Remove zero-width spaces; normalize minus signs; trim."""
    return s.replace("\u200b", "").replace("−", "-").strip()


_NUM = r"-?\d+(?:\.\d+)?"


def number(s: str) -> Num | None:
    """'22.989 769 28(2)' -> 22.98976928. Digit-group spaces and a trailing
    standard-uncertainty '(2)' are allowed; anything else is rejected."""
    s = clean(s)
    unc_digits = None
    if m := re.search(r"\((\d+)#?\)$", s):  # concise uncertainty, e.g. (2) or (71#)
        unc_digits, s = m.group(1), s[: m.start()]
    s = re.sub(r"(?<=\d) (?=\d)", "", s)  # digit grouping: '4.002 602'
    if not re.fullmatch(_NUM, s):
        return None
    decimals = len(s.split(".")[1]) if "." in s else 0
    unc = int(unc_digits) * 10 ** -decimals if unc_digits else None
    return Num(float(s), s, unc)


def agree(a: Num, b: Num) -> bool:
    """Do two contributors' values agree (methodology section 4)?

    If either states an uncertainty, they agree when they differ by no more
    than the stated uncertainties combined (a bare number counts as +/- half
    its last digit). 18.998403162(5) agrees with 18.998403163(6).

    Otherwise the shorter value must be the longer one correctly rounded:
    22.99 agrees with 22.98976928, but 63.6 does not agree with 63.546.
    Decimal arithmetic, so no float surprises. An exact half may round
    either way, since conventions differ."""
    if a.uncertainty is not None or b.uncertainty is not None:
        tol = (a.uncertainty if a.uncertainty is not None else a.half_ulp) + (
            b.uncertainty if b.uncertainty is not None else b.half_ulp)
        return abs(Decimal(a.text) - Decimal(b.text)) <= Decimal(repr(tol)) * (1 + Decimal("1e-9"))
    short, long_ = (a, b) if a.decimals <= b.decimals else (b, a)
    q = Decimal(1).scaleb(-short.decimals)
    target = Decimal(short.text)
    return any(Decimal(long_.text).quantize(q, rounding=r) == target for r in (ROUND_HALF_UP, ROUND_HALF_DOWN))


def in_interval(v: Num, lo: Num, hi: Num) -> bool:
    """Is a bare value consistent with an interval, at the value's own
    precision? Los Alamos's 14.01 is consistent with [14.006 43, 14.007 28]."""
    q = Decimal(1).scaleb(-v.decimals)
    x = Decimal(v.text)
    return Decimal(lo.text).quantize(q, rounding=ROUND_HALF_UP) <= x <= Decimal(hi.text).quantize(q, rounding=ROUND_HALF_UP)


def interval(s: str) -> tuple[Num, Num] | None:
    """'[1.007 84, 1.008 11]' -> (1.00784, 1.00811)."""
    m = re.fullmatch(r"\[\s*([\d .]+?)\s*,\s*([\d .]+?)\s*\]", clean(s))
    if not m:
        return None
    lo, hi = number(m.group(1)), number(m.group(2))
    if lo is None or hi is None or lo.value > hi.value:
        return None
    return lo, hi


# ---- Identity, period, group, state ------------------------------------------


def period(s: str) -> int | None:
    m = re.fullmatch(r"[1-7]", clean(s))
    return int(m.group(0)) if m else None


def group(s: str) -> int | None | str:
    """'1 - Alkali Metal' -> 1; '17' -> 17. '- Lanthanide' / '- Actinide' ->
    'none' (no numbered group). Anything else -> None (unparseable)."""
    s = clean(s)
    if re.fullmatch(r"- (Lanthanide|Actinide)", s):
        return "none"
    m = re.fullmatch(r"(\d{1,2})(?: - [A-Za-z ]+)?", s)
    if m and 1 <= int(m.group(1)) <= 18:
        return int(m.group(1))
    return None


def state(s: str) -> tuple[str, bool] | None:
    """'Solid' -> ('Solid', False); 'Expected to be a Gas' -> (same, True)."""
    s = clean(s)
    m = re.fullmatch(r"(Expected to be an? )?(Solid|Liquid|Gas)", s)
    return (s, bool(m.group(1))) if m else None


def electronegativity(s: str) -> Num | None:
    m = re.fullmatch(r"(\d+(?:\.\d+)?) \(Pauling Scale\)", clean(s))
    return number(m.group(1)) if m else None


def density(s: str) -> tuple[Num, bool] | None:
    """'0.97 grams per cubic centimeter' -> (0.97, approx=False)."""
    m = re.fullmatch(r"(about )?(\d+(?:\.\d+)?) grams per cubic centimeter", clean(s))
    if not m:
        return None
    return number(m.group(2)), bool(m.group(1))  # type: ignore[return-value]


# ---- Temperatures --------------------------------------------------------------

_VAL = r"~?-?\d+(?:\.\d+)?(?:–-?\d+(?:\.\d+)?|±\d+(?:\.\d+)?|\+\d+(?:\.\d+)?-\d+(?:\.\d+)?)?"
_TEMPLATES = [
    # Jefferson Lab: '453.65 K (180.50°C or 356.90°F)'
    re.compile(rf"(?P<k>{_VAL}) K \((?P<c>{_VAL})°C or (?P<f>{_VAL})°F\)"),
    # Los Alamos: '180.5°C'
    re.compile(rf"(?P<c>{_VAL})°C"),
    # Los Alamos: '2400K(2100°C,3800°F)' (zero-width spaces already removed)
    re.compile(rf"(?P<k>{_VAL})K\((?P<c>{_VAL})°C,(?P<f>{_VAL})°F\)"),
]


@dataclass(frozen=True)
class TempValue:
    """One temperature as written: a single value, or a range from '–', '±'
    or '+u-l' notation. `approx` is set by a leading '~'."""

    low: Num
    high: Num
    approx: bool

    @property
    def is_range(self) -> bool:
        return self.low.value != self.high.value or self.low.text != self.high.text


def _temp_value(s: str) -> TempValue | None:
    approx = s.startswith("~")
    s = s.lstrip("~")
    if m := re.fullmatch(rf"({_NUM})–({_NUM})", s):
        lo, hi = number(m.group(1)), number(m.group(2))
    elif m := re.fullmatch(rf"({_NUM})±(\d+(?:\.\d+)?)", s):
        c, d = number(m.group(1)), number(m.group(2))
        if c is None or d is None:
            return None
        lo = Num(c.value - d.value, _fmt(c.value - d.value, max(c.decimals, d.decimals)))
        hi = Num(c.value + d.value, _fmt(c.value + d.value, max(c.decimals, d.decimals)))
    elif m := re.fullmatch(rf"({_NUM})\+(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)", s):
        c, u, l = number(m.group(1)), number(m.group(2)), number(m.group(3))
        if c is None or u is None or l is None:
            return None
        places = max(c.decimals, u.decimals, l.decimals)
        lo = Num(c.value - l.value, _fmt(c.value - l.value, places))
        hi = Num(c.value + u.value, _fmt(c.value + u.value, places))
    else:
        lo = hi = number(s)
    if lo is None or hi is None or lo.value > hi.value:
        return None
    return TempValue(lo, hi, approx)


def _fmt(v: float, places: int) -> str:
    return f"{v:.{places}f}"


@dataclass(frozen=True)
class Temperature:
    # None only when a qualifier is present but the value itself has no
    # recognizable unit, e.g. '44.15(whitephosphorus)'. Qualified values
    # are dropped anyway (methodology section 5).
    celsius: TempValue | None
    kelvin: TempValue | None
    fahrenheit: TempValue | None
    marker: str | None  # 'predicted' | 'extrapolated' | 'estimated'
    qualifier: str | None  # e.g. 'diamond', 'sublimation', 'whitephosphorus'


def temperature(s: str) -> Temperature | None:
    """Parse a melting or boiling point string from Jefferson Lab or Los Alamos."""
    s = clean(s)
    marker = None
    if m := re.search(r"\((predicted|extrapolated|estimated)\)$", s):
        marker, s = m.group(1), s[: m.start()]
    qualifier = None
    if m := re.search(r"\(([a-z ]+)\)$", s):
        qualifier, s = m.group(1), s[: m.start()]
    for t in _TEMPLATES:
        if m := t.fullmatch(s):
            parts = m.groupdict()
            c = _temp_value(parts["c"])
            if c is None:
                return None
            k = _temp_value(parts["k"]) if parts.get("k") else None
            f = _temp_value(parts["f"]) if parts.get("f") else None
            if (parts.get("k") and k is None) or (parts.get("f") and f is None):
                return None
            return Temperature(c, k, f, marker, qualifier)
    return Temperature(None, None, None, marker, qualifier) if qualifier else None


def temperature_self_consistent(t: Temperature) -> bool:
    """A contributor's own K and °F figures must match its °C figure after
    exact conversion, within the rounding of the digits it wrote."""

    def ok(a: Num, b: Num, scale: float, offset: float) -> bool:
        tol = 0.5 * 10 ** -a.decimals + 0.5 * 10 ** -b.decimals * scale + 1e-9
        return abs(a.value - (b.value * scale + offset)) <= tol

    if t.celsius is None:
        return False
    for other, scale, offset in ((t.kelvin, 1.0, 273.15), (t.fahrenheit, 1.8, 32.0)):
        if other is None:
            continue
        if other.approx or t.celsius.approx:
            continue  # approximate figures can't be checked to a precision
        if not (ok(other.low, t.celsius.low, scale, offset) and ok(other.high, t.celsius.high, scale, offset)):
            return False
    return True


# ---- Isotopes -------------------------------------------------------------------


def nuclide(s: str) -> tuple[int, str, str] | None:
    """' 23Na' -> (23, 'Na', ''); '86Tcm' -> (86, 'Tc', 'm'); NIST's '2D' and
    '3T' are hydrogen-2 and hydrogen-3."""
    m = re.fullmatch(r"(\d{1,3})([A-Z][a-z]?)([m-r]?)", clean(s))
    if not m:
        return None
    symbol = {"D": "H", "T": "H"}.get(m.group(2), m.group(2))
    return int(m.group(1)), symbol, m.group(3)


def abundance(s: str) -> Num | tuple[Num, Num] | None:
    s = clean(s)
    if not s:
        return None
    return interval(s) if s.startswith("[") else number(s)


def amdc_mass(s: str) -> Num | None:
    """'86.938067185 ± 0.0000045' -> 86.938067185. Estimated masses are rejected."""
    s = clean(s)
    if "Estimated" in s:
        return None
    m = re.fullmatch(r"(\d+\.\d+) ± ([\d.]+)", s)
    if not m:
        return None
    n = number(m.group(1))
    return Num(n.value, n.text, float(m.group(2))) if n else None


_SECONDS = {
    "ys": 1e-24, "zs": 1e-21, "as": 1e-18, "fs": 1e-15, "ps": 1e-12, "ns": 1e-9,
    "us": 1e-6, "ms": 1e-3, "s": 1.0, "m": 60.0, "h": 3600.0, "d": 86400.0,
}
_YEAR = 365.2422 * 86400
for _p, _f in {"y": 1, "ky": 1e3, "My": 1e6, "Gy": 1e9, "Ty": 1e12, "Py": 1e15, "Ey": 1e18, "Zy": 1e21, "Yy": 1e24}.items():
    _SECONDS[_p] = _f * _YEAR


@dataclass(frozen=True)
class HalfLife:
    value: Num
    unit: str
    uncertainty: float

    @property
    def seconds(self) -> float:
        return self.value.value * _SECONDS[self.unit]

    def bounds(self) -> tuple[float, float]:
        f = _SECONDS[self.unit]
        return (self.value.value - self.uncertainty) * f, (self.value.value + self.uncertainty) * f


def half_life(s: str) -> HalfLife | str | None:
    """A definite measured half-life ('4.21 My ± 0.16'), the string 'Stable',
    or None. Estimated values, bounds and 'Not-specified' return None."""
    s = clean(s)
    if s == "Stable":
        return "Stable"
    m = re.fullmatch(r"(\d+(?:\.\d+)?) ([A-Za-z]+) ± (\d+(?:\.\d+)?)", s)
    if not m or m.group(2) not in _SECONDS:
        return None
    return HalfLife(number(m.group(1)), m.group(2), float(m.group(3)))  # type: ignore[arg-type]
