"""Extract and verify element facts from PubChem (verification/methodology.md).

    python -m pipeline.elements            # all 118, using the download cache
    python -m pipeline.elements --refresh  # fetch everything again
    python -m pipeline.elements --only 11  # one element, for debugging

Writes data/verified/elements/, verification/records/elements/ and a release
report in verification/reports/. Text facts (history, uses) are added by a
separate agent step and are not produced here.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from . import parse as P
from .derive import MAIN_GROUPS, derive, electron_count, normalize_configuration, parse_configuration
from .fetch import fetch
from .nist import PhaseData, phase_data

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "verified" / "elements"
RECORDS_DIR = ROOT / "verification" / "records" / "elements"
REPORTS_DIR = ROOT / "verification" / "reports"
VERIFIER = "pipeline/elements.py"

PAGE = "https://pubchem.ncbi.nlm.nih.gov/element/{z}"
LT_CONFIGS = ("https://chem.libretexts.org/Ancillary_Materials/Reference/Reference_Tables/"
              "Atomic_and_Molecular_Properties/A1%3A_Atomic_Electron_Configurations")
PUG_VIEW = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/element/{z}/JSON"

_LT = "https://chem.libretexts.org/Bookshelves/Introductory_Chemistry/Introductory_Chemistry_(LibreTexts)"
CONCEPTS = {
    "protons-equal-atomic-number": f"{_LT}/04%3A_Atoms_and_Elements/4.05%3A_Elements-_Defined_by_Their_Number_of_Protons",
    "electrons-equal-atomic-number": f"{_LT}/04%3A_Atoms_and_Elements/4.05%3A_Elements-_Defined_by_Their_Number_of_Protons",
    "neutrons-from-mass-number": f"{_LT}/04%3A_Atoms_and_Elements/4.08%3A_Isotopes_-_When_the_Number_of_Neutrons_Varies",
    "shells-from-configuration": f"{_LT}/09%3A_Electrons_in_Atoms_and_the_Periodic_Table/9.06%3A_Quantum-Mechanical_Orbitals_and_Electron_Configurations",
    "valence-main-group": f"{_LT}/09%3A_Electrons_in_Atoms_and_the_Periodic_Table/9.07%3A_Electron_Configurations_and_the_Periodic_Table",
}

CONTRIBUTORS = {
    "IUPAC Commission on Isotopic Abundances and Atomic Weights": "IUPAC CIAAW",
    "Jefferson Lab": "Jefferson Lab",
    "Los Alamos National Laboratory": "Los Alamos National Laboratory",
    "NIST Physical Measurement Laboratory": "NIST Physical Measurement Laboratory",
    "Atomic Mass Data Center": "IAEA Atomic Mass Data Center",
    "PubChem": "PubChem",
}

TEMP_TOLERANCE_C = 1.0  # methodology section 5
ROOM_C = 25.0
NO_BULK_SAMPLE_Z = 100  # fermium onward: never made in visible amounts (methodology section 9)
PREDICTED_CONFIG_Z = 104  # rutherfordium onward: configurations are calculated, not measured


def contributor(source_name: str) -> str:
    for prefix, short in CONTRIBUTORS.items():
        if source_name.startswith(prefix):
            return short
    return source_name


def anchor(heading: str) -> str:
    return "#section=" + re.sub(r"[^A-Za-z0-9]+", "-", heading).strip("-")


def expected_period(z: int) -> int:
    return next(p for p, end in enumerate((2, 10, 18, 36, 54, 86, 118), start=1) if z <= end)


def expected_group(z: int) -> int | None:
    """Group in the standard 18-column table. None for lanthanum to ytterbium
    and actinium to nobelium, which sit in the separate f-block rows."""
    if z == 1:
        return 1
    if z == 2:
        return 18
    p = expected_period(z)
    start = (0, 0, 3, 11, 19, 37, 55, 87)[p]
    i = z - start  # position in its period, from 0
    if p in (2, 3):
        return i + 1 if i < 2 else i + 11
    if p in (4, 5):
        return i + 1
    if i < 2:
        return i + 1
    if i < 16:
        return None  # f-block
    return i - 13


# ---- Reading a PubChem element record ---------------------------------------------


@dataclass
class Info:
    contributor: str
    name: str
    strings: list[str]
    number: list[float]

    @property
    def text(self) -> str:
        return " ".join(self.strings)


def read_sections(record: dict) -> dict[str, list[Info]]:
    refs = {r["ReferenceNumber"]: r.get("SourceName", "") for r in record.get("Reference", [])}
    out: dict[str, list[Info]] = {}

    def walk(sections):
        for s in sections:
            for i in s.get("Information", []):
                v = i.get("Value", {})
                out.setdefault(s["TOCHeading"], []).append(
                    Info(
                        contributor(refs.get(i.get("ReferenceNumber"), "")),
                        i.get("Name", ""),
                        [x["String"] for x in v.get("StringWithMarkup", [])],
                        v.get("Number", []),
                    )
                )
            walk(s.get("Section", []))

    walk(record.get("Section", []))
    return out


def libretexts_configurations(refresh: bool) -> tuple[dict[int, tuple[str, bool]], str]:
    """LibreTexts reference table A1: {Z: (configuration, 'probably')}."""
    body, retrieved = fetch(LT_CONFIGS, "libretexts/a1-electron-configurations.html", refresh)
    page = body.decode("utf-8", errors="replace")
    out = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip()
                 for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
        if len(cells) == 1 and (m := re.fullmatch(r"(\d+) ([A-Z][a-z]?) [a-z]+ : (probably )?(.+)", cells[0])):
            out[int(m.group(1))] = (m.group(4), bool(m.group(3)))
    return out, retrieved


# ---- Building one element ------------------------------------------------------------


@dataclass
class Built:
    element: dict | None
    records: list[dict]
    drops: list[tuple[str, str]]
    notes: list[str]


@dataclass
class ElementBuilder:
    z: int
    record: dict
    retrieved: str
    checked_at: str
    nist: Callable[[str], PhaseData | None]
    lt_configs: tuple[dict[int, tuple[str, bool]], str]
    facts: dict[str, dict] = field(default_factory=dict)
    records: dict[str, dict] = field(default_factory=dict)
    corroborated: set[str] = field(default_factory=set)
    drops: list[tuple[str, str]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def __post_init__(self):
        self.sections = read_sections(self.record)
        self.symbol = self.first("Element Symbol", "PubChem")
        self.page = PAGE.format(z=self.z)

    # -- helpers --

    def infos(self, heading: str, who: str | None = None) -> list[Info]:
        return [i for i in self.sections.get(heading, []) if who is None or i.contributor == who]

    def first(self, heading: str, who: str) -> str | None:
        found = self.infos(heading, who)
        return P.clean(found[0].text) if found and found[0].strings else None

    def rid(self, pointer: str) -> str:
        return f"{self.symbol}{pointer.replace('/', '.')}"

    def drop(self, pointer: str, reason: str) -> None:
        self.drops.append((pointer, reason))
        self.facts.pop(pointer, None)
        self.records.pop(self.rid(pointer), None)

    def add(self, pointer: str, value: Any, unit: str | None, heading: str | None, via: str, raw: str, *,
            uncertain: bool = False, corroboration: list[dict] | None = None, tolerance: dict | None = None,
            notes: str | None = None, url: str | None = None, retrieved: str | None = None) -> None:
        source_url = url or (self.page + (anchor(heading) if heading else ""))
        rid = self.rid(pointer)
        self.facts[pointer] = {
            "value": value,
            "unit": unit,
            "uncertain": uncertain,
            "source": {"url": source_url, "retrieved": retrieved or self.retrieved, "via": via},
            "verification": {"status": "pass", "recordId": rid},
        }
        record = {
            "id": rid,
            "subject": {"entity": f"element:{self.symbol}", "field": pointer},
            "method": "extract",
            "claimedValue": value,
            "unit": unit,
            "sourceUrl": source_url,
            "upstream": via,
            "retrievedValue": value,
            "evidence": raw[:400],
            "result": "pass",
            "checkedAt": self.checked_at,
            "consistency": {"runs": 1, "agreeing": 1},
            "verifier": VERIFIER,
        }
        if tolerance:
            record["tolerance"] = tolerance
        if corroboration:
            record["corroboration"] = corroboration
            self.corroborated.add(pointer)
        if notes:
            record["notes"] = notes
        self.records[rid] = record

    def add_derived(self, pointer: str, rule: str, inputs: list[str]) -> None:
        values = [self.facts[p]["value"] for p in inputs]
        value = derive(rule, values)
        rid = self.rid(pointer)
        uncertain = any(self.facts[p]["uncertain"] for p in inputs)
        url = CONCEPTS[rule]
        self.facts[pointer] = {
            "value": value,
            "unit": None,
            "uncertain": uncertain,
            "source": {"url": url, "retrieved": self.retrieved, "via": "LibreTexts Chemistry"},
            "verification": {"status": "pass", "recordId": rid},
            "derivation": {"rule": rule, "inputs": [self.rid(p) for p in inputs]},
        }
        self.records[rid] = {
            "id": rid,
            "subject": {"entity": f"element:{self.symbol}", "field": pointer},
            "method": "derive",
            "claimedValue": value,
            "unit": None,
            "sourceUrl": url,
            "retrievedValue": value,
            "result": "pass",
            "checkedAt": self.checked_at,
            "consistency": {"runs": 1, "agreeing": 1},
            "verifier": VERIFIER,
            "notes": f"{rule} from {', '.join(self.rid(p) for p in inputs)}",
        }

    # -- fields --

    def identity(self) -> bool:
        name = self.first("Element Name", "PubChem")
        ciaaw_symbol = self.first("Element Symbol", "IUPAC CIAAW")
        if not self.symbol or not name or self.record.get("RecordNumber") != self.z:
            self.drops.append(("/", "identity missing from the PubChem record"))
            return False
        if ciaaw_symbol and ciaaw_symbol != self.symbol:
            self.drops.append(("/", f"symbol disagrees: PubChem {self.symbol}, CIAAW {ciaaw_symbol}"))
            return False
        self.add("/atomicNumber", self.z, None, None, "PubChem", f"RecordNumber {self.z}")
        self.add("/symbol", self.symbol, None, "Element Symbol", "PubChem", self.symbol,
                 corroboration=[{"sourceUrl": self.page + anchor("Element Symbol"), "upstream": "IUPAC CIAAW", "value": ciaaw_symbol}] if ciaaw_symbol else None)
        ciaaw_name = self.first("Element Name", "IUPAC CIAAW")
        self.add("/name", name, None, "Element Name", "PubChem", name,
                 notes=f"CIAAW spells it {ciaaw_name}" if ciaaw_name and ciaaw_name.lower() != name.lower() else None)
        return True

    def period_and_group(self) -> None:
        raw = self.first("Element Period Number", "Jefferson Lab")
        p = P.period(raw) if raw else None
        if p is None:
            self.drops.append(("/period", f"missing or unparseable: {raw!r}"))
        elif p != expected_period(self.z):
            self.drops.append(("/period", f"{p} doesn't fit atomic number {self.z}"))
        else:
            self.add("/period", p, None, "Element Period Number", "Jefferson Lab", raw,
                     notes="consistent with the period boundaries at Z = 2, 10, 18, 36, 54, 86, 118")

        raw = self.first("Element Group Number", "Jefferson Lab")
        g = P.group(raw) if raw else None
        want = expected_group(self.z)
        if g == "none" and want is None:
            self.notes.append("no numbered group (f-block)")
        elif g is None or g == "none":
            self.drops.append(("/group", f"missing or unparseable: {raw!r}"))
        elif g != want:
            self.drops.append(("/group", f"{g} doesn't fit the standard table position ({want})"))
        else:
            self.add("/group", g, None, "Element Group Number", "Jefferson Lab", raw,
                     notes="consistent with the standard 18-column table position")

    def atomic_weight(self) -> None:
        ciaaw = [i for i in self.infos("Atomic Weight", "IUPAC CIAAW") if i.strings]
        if not ciaaw:
            self.notes.append("no standard atomic weight (CIAAW gives none)")
            return
        raw = P.clean(ciaaw[0].text)
        primary = P.interval(raw) if raw.startswith("[") else P.number(raw)
        if primary is None:
            self.drops.append(("/atomicWeight", f"unparseable CIAAW value {raw!r}"))
            return
        agreeing, disagreeing = [], []
        for who in ("NIST Physical Measurement Laboratory", "Jefferson Lab", "Los Alamos National Laboratory"):
            for i in self.infos("Atomic Weight", who):
                text = P.clean(i.text)
                if not text or text.startswith("Relative Mass"):
                    continue
                other = P.interval(text) if text.startswith("[") and "," in text else P.number(text)
                if other is None:
                    continue
                if isinstance(primary, tuple):
                    ok = (isinstance(other, tuple) and P.agree(other[0], primary[0]) and P.agree(other[1], primary[1])) or (
                        isinstance(other, P.Num) and P.in_interval(other, *primary))
                else:
                    ok = isinstance(other, P.Num) and P.agree(primary, other)
                (agreeing if ok else disagreeing).append({"sourceUrl": self.page + anchor("Atomic Weight"), "upstream": who, "value": text})
        # CIAAW defines the standard atomic weight, so it is authoritative. It
        # still needs one agreeing contributor; others with older values are
        # noted, not blocking (methodology section 5).
        if not agreeing:
            self.drops.append(("/atomicWeight", f"CIAAW {raw}: no contributor agrees ("
                               + "; ".join(f"{d['upstream']} {d['value']}" for d in disagreeing) + ")"))
            return
        notes = ["an interval because it varies in nature"] if isinstance(primary, tuple) else []
        if disagreeing:
            notes.append("older values not matching CIAAW: " + "; ".join(f"{d['upstream']} {d['value']}" for d in disagreeing))
        value = {"min": primary[0].value, "max": primary[1].value} if isinstance(primary, tuple) else primary.value
        self.add("/atomicWeight", value, "u", "Atomic Weight", "IUPAC CIAAW", raw, corroboration=agreeing,
                 notes="; ".join(notes) or None)

    def configuration(self) -> bool:
        """Los Alamos (via PubChem) and the LibreTexts A1 table must agree by
        subshell occupancy. Either alone is a single contributor."""
        heading = "Electron Configuration"
        lanl = self.first(heading, "Los Alamos National Laboratory")
        table, lt_retrieved = self.lt_configs
        lt, lt_probably = table.get(self.z, (None, False))
        parsed = {}
        for who, raw in (("Los Alamos National Laboratory", lanl), ("LibreTexts Chemistry", lt)):
            if raw is None:
                continue
            occ = parse_configuration(raw)
            if occ is None:
                self.notes.append(f"electron configuration: unparseable {who} value {raw!r}, ignored")
            elif electron_count(occ) != self.z:
                self.notes.append(f"electron configuration: {who} {raw} holds {electron_count(occ)} electrons, not {self.z}; ignored")
            else:
                parsed[who] = (raw, occ)
        if not parsed:
            self.drops.append(("/electronConfiguration", f"no usable value (Los Alamos {lanl!r}, LibreTexts {lt!r})"))
            return False
        if len(parsed) == 2 and parsed["Los Alamos National Laboratory"][1] != parsed["LibreTexts Chemistry"][1]:
            self.drops.append(("/electronConfiguration", f"contributors disagree: Los Alamos {lanl}; LibreTexts {lt}"))
            return False

        marked = bool(lanl and re.search(r"predicted|calculated", lanl, re.I)) or (lt is not None and lt_probably)
        predicted = marked or self.z >= PREDICTED_CONFIG_Z
        why = ("marked by the source" if marked else f"calculated for Z >= {PREDICTED_CONFIG_Z}") if predicted else None
        if "Los Alamos National Laboratory" in parsed:
            raw = parsed["Los Alamos National Laboratory"][0]
            corroboration = [{"sourceUrl": LT_CONFIGS, "upstream": "LibreTexts Chemistry", "value": lt}] if "LibreTexts Chemistry" in parsed else None
            self.add("/electronConfiguration", normalize_configuration(raw), None, heading, "Los Alamos National Laboratory", raw,
                     uncertain=predicted, corroboration=corroboration,
                     notes=f"predicted: {why}" if predicted else ("electron count equals the atomic number"
                           + ("" if corroboration else "; single contributor")))
        else:
            raw = parsed["LibreTexts Chemistry"][0]
            self.add("/electronConfiguration", normalize_configuration(raw), None, None, "LibreTexts Chemistry", raw,
                     uncertain=predicted, url=LT_CONFIGS, retrieved=lt_retrieved,
                     notes=(f"predicted: {why}; " if predicted else "") + "PubChem's page has no configuration; LibreTexts table A1 only")
        return True

    def electronegativity(self) -> None:
        found = [i for i in self.infos("Electronegativity", "PubChem") if "Pauling" in i.name]
        if not found:
            return
        raw = P.clean(found[0].text)
        v = P.electronegativity(raw)
        if v is None or not 0.5 <= v.value <= 4.0:
            self.drops.append(("/electronegativity", f"unparseable or implausible: {raw!r}"))
            return
        self.add("/electronegativity", v.value, None, "Electronegativity", "PubChem", raw, notes="Pauling scale; single contributor")

    def state(self) -> None:
        raw = self.first("Physical Description", "Jefferson Lab")
        if not raw:
            return
        parsed = P.state(raw)
        if parsed is None:
            self.drops.append(("/state", f"unparseable: {raw!r}"))
            return
        text, expected = parsed
        predicted = expected or self.z >= NO_BULK_SAMPLE_Z
        self.add("/state", text, None, "Physical Description", "Jefferson Lab", raw, uncertain=predicted,
                 notes=f"predicted: never made in visible amounts (Z >= {NO_BULK_SAMPLE_Z})" if predicted and not expected else None)

    def temperature(self, pointer: str, heading: str) -> None:
        parsed: dict[str, P.Temperature] = {}
        raws: dict[str, str] = {}
        for who in ("Jefferson Lab", "Los Alamos National Laboratory"):
            for i in self.infos(heading, who):
                raw = P.clean(i.text)
                t = P.temperature(raw)
                if t is None:
                    self.notes.append(f"{heading}: unparseable {who} value {raw!r}, ignored")
                    continue
                parsed[who], raws[who] = t, raw
        if not parsed:
            return
        if any(t.qualifier for t in parsed.values()):
            self.drops.append((pointer, "qualified value (a specific form or condition): " + "; ".join(f"{w} {raws[w]}" for w in parsed)))
            return

        predicted = self.z >= NO_BULK_SAMPLE_Z or any(t.marker for t in parsed.values())
        if predicted:
            ranged = [(w, t) for w, t in parsed.items() if t.celsius.is_range and not t.celsius.approx]
            if not ranged:
                self.drops.append((pointer, "predicted value with no stated range: " + "; ".join(f"{w} {raws[w]}" for w in parsed)))
                return
            w, t = ranged[0]
            self.add(pointer, {"min": t.celsius.low.value, "max": t.celsius.high.value}, "°C", heading, w, raws[w], uncertain=True,
                     notes="predicted or extrapolated; stated as a range by the source")
            return

        usable: dict[str, P.Temperature] = {}
        for w, t in parsed.items():
            if t.celsius.approx or t.celsius.is_range:
                self.notes.append(f"{heading}: {w} value {raws[w]!r} is approximate or a range, not used")
            elif not P.temperature_self_consistent(t):
                self.notes.append(f"{heading}: {w} value {raws[w]!r} disagrees with itself across units, not used")
            else:
                usable[w] = t
        if not usable:
            self.drops.append((pointer, "no usable value: " + "; ".join(f"{w} {raws[w]}" for w in parsed)))
            return

        primary = "Jefferson Lab" if "Jefferson Lab" in usable else next(iter(usable))
        value = usable[primary].celsius.low.value
        others = {w: t.celsius.low.value for w, t in usable.items() if w != primary}
        tolerance = {"absolute": TEMP_TOLERANCE_C}
        if not others:
            self.add(pointer, value, "°C", heading, primary, raws[primary],
                     notes="single contributor; must pass the consistency checks")
            return
        (other_who, other_value), = others.items()
        if abs(value - other_value) <= TEMP_TOLERANCE_C:
            self.add(pointer, value, "°C", heading, primary, raws[primary], tolerance=tolerance,
                     corroboration=[{"sourceUrl": self.page + anchor(heading), "upstream": other_who, "value": raws[other_who]}])
            return

        # Contributors disagree: ask the NIST WebBook to break the tie.
        name = self.facts["/name"]["value"]
        nist = self.nist(name)
        nist_k = (nist.melting_k if pointer == "/meltingPoint" else nist.boiling_k) if nist else []
        nist_c = [k - 273.15 for k in nist_k]
        matches = [w for w, v in ((primary, value), (other_who, other_value)) if any(abs(v - c) <= TEMP_TOLERANCE_C for c in nist_c)]
        both = f"{primary} {raws[primary]}; {other_who} {raws[other_who]}"
        if len(matches) == 1:
            w = matches[0]
            loser = other_who if w == primary else primary
            self.add(pointer, usable[w].celsius.low.value, "°C", heading, w, raws[w], tolerance=tolerance, url=None,
                     corroboration=[{"sourceUrl": nist.url, "upstream": "NIST Chemistry WebBook",
                                     "value": ", ".join(f"{c:.2f} °C" for c in nist_c)}],
                     notes=f"contributors disagreed ({both}); NIST WebBook matches {w}, so {loser}'s value was rejected")
        else:
            reason = "no NIST WebBook data" if not nist_c else f"NIST WebBook ({', '.join(f'{c:.2f}' for c in nist_c)} °C) doesn't settle it"
            self.drops.append((pointer, f"contributors disagree ({both}); {reason}"))

    def classification(self) -> None:
        """Metal, Non-metal or Semi-metal: colors the periodic table."""
        raw = self.first("Element Classification", "Jefferson Lab")
        if not raw:
            return
        if raw not in ("Metal", "Non-metal", "Semi-metal"):
            self.drops.append(("/classification", f"unrecognized: {raw!r}"))
            return
        predicted = self.z >= NO_BULK_SAMPLE_Z
        self.add("/classification", raw, None, "Element Classification", "Jefferson Lab", raw, uncertain=predicted,
                 notes=f"predicted: never made in visible amounts (Z >= {NO_BULK_SAMPLE_Z})" if predicted else "single contributor")

    def density(self) -> None:
        raw = self.first("Density", "Jefferson Lab")
        if not raw:
            return
        parsed = P.density(raw)
        if parsed is None:
            self.drops.append(("/density", f"unparseable: {raw!r}"))
        elif parsed[1]:
            self.drops.append(("/density", f"approximate value: {raw!r}"))
        elif self.z >= NO_BULK_SAMPLE_Z:
            self.drops.append(("/density", f"predicted value with no stated range (Z >= {NO_BULK_SAMPLE_Z}): {raw!r}"))
        else:
            self.add("/density", parsed[0].value, "g/cm³", "Density", "Jefferson Lab", raw, notes="single contributor")

    # -- isotopes and the atom --

    def _table(self, heading: str, who: str) -> dict[str, list[str]]:
        return {i.name: i.strings for i in self.infos(heading, who)}

    def _half_lives(self) -> dict[int, P.HalfLife | str]:
        t = self._table("Atomic Mass, Half Life, and Decay", "IAEA Atomic Mass Data Center")
        out: dict[int, P.HalfLife | str] = {}
        for nuc, hl in zip(t.get("Nuclide", []), t.get("Half Life and Uncertainty", [])):
            parsed = P.nuclide(nuc)
            if parsed and parsed[1] == self.symbol and not parsed[2]:  # ground states only
                h = P.half_life(hl)
                if h is not None:
                    out[parsed[0]] = h
        return out

    def _add_half_life(self, pointer: str, h: P.HalfLife | str) -> None:
        heading = "Atomic Mass, Half Life, and Decay"
        via = "IAEA Atomic Mass Data Center"
        if h == "Stable":
            self.add(pointer, "Stable", None, heading, via, "Stable")
        else:
            self.add(pointer, h.value.value, h.unit, heading, via, f"{h.value.text} {h.unit} ± {h.uncertainty:g}")

    def isotopes(self) -> int | None:
        """Adds the isotope facts and returns the mass number the atom shows."""
        heading = "Isotope Mass and Abundance"
        ciaaw = self._table(heading, "IUPAC CIAAW")
        nist = self._table(heading, "NIST Physical Measurement Laboratory")
        nist_rows = {}
        for nuc, mass, ab in zip(nist.get("Isotope", []), nist.get("Atomic Mass (uncertainty) [u]", []), nist.get("Abundance (uncertainty)", [])):
            parsed = P.nuclide(nuc)
            if parsed and parsed[1] == self.symbol:
                nist_rows[parsed[0]] = (P.clean(mass), P.clean(ab))
        half_lives = self._half_lives()
        amdc = self._table("Atomic Mass, Half Life, and Decay", "IAEA Atomic Mass Data Center")
        amdc_masses = {}
        for nuc, m in zip(amdc.get("Nuclide", []), amdc.get("Atomic Mass and Uncertainty [u]", [])):
            parsed = P.nuclide(nuc)
            if parsed and parsed[1] == self.symbol and not parsed[2] and (n := P.amdc_mass(m)):
                amdc_masses[parsed[0]] = (n, P.clean(m))
        page_iso = self.page + anchor(heading)
        page_amdc = self.page + anchor("Atomic Mass, Half Life, and Decay")

        rows = []  # (mass number, via, mass raw, abundance raw, corroborating NIST row)
        if ciaaw.get("Isotope"):
            for nuc, mass, ab in zip(ciaaw["Isotope"], ciaaw.get("Atomic Mass (uncertainty)", []), ciaaw.get("Abundance (uncertainty)", [])):
                parsed = P.nuclide(nuc)
                if parsed and parsed[1] == self.symbol:
                    rows.append((parsed[0], "IUPAC CIAAW", P.clean(mass), P.clean(ab), nist_rows.get(parsed[0])))
        else:
            rows = [(a, "NIST Physical Measurement Laboratory", m, ab, None) for a, (m, ab) in nist_rows.items() if ab]

        natural = []
        for i, (a, via, mass_raw, ab_raw, nist_row) in enumerate(rows):
            base = f"/isotopes/{i}"
            self.add(f"{base}/massNumber", a, None, heading, via, f"{a}{self.symbol}")
            mass = P.number(mass_raw)
            if mass is not None:
                n_mass = P.number(nist_row[0]) if nist_row else None
                if n_mass is None or P.agree(mass, n_mass):
                    self.add(f"{base}/atomicMass", mass.value, "u", heading, via, mass_raw,
                             corroboration=[{"sourceUrl": page_iso, "upstream": "NIST Physical Measurement Laboratory", "value": nist_row[0]}] if n_mass else None)
                else:
                    # Disagreement: the IAEA mass table breaks the tie.
                    am = amdc_masses.get(a)
                    ciaaw_ok, nist_ok = (P.agree(mass, am[0]), P.agree(n_mass, am[0])) if am else (False, False)
                    both = f"{via} {mass_raw}; NIST {nist_row[0]}"
                    tie = [{"sourceUrl": page_amdc, "upstream": "IAEA Atomic Mass Data Center", "value": am[1]}] if am else None
                    if ciaaw_ok and not nist_ok:
                        self.add(f"{base}/atomicMass", mass.value, "u", heading, via, mass_raw, corroboration=tie,
                                 notes=f"contributors disagreed ({both}); the IAEA mass table matches {via}")
                    elif nist_ok and not ciaaw_ok:
                        self.add(f"{base}/atomicMass", n_mass.value, "u", heading, "NIST Physical Measurement Laboratory", nist_row[0],
                                 corroboration=tie, notes=f"contributors disagreed ({both}); the IAEA mass table matches NIST")
                    else:
                        self.drop(f"{base}/atomicMass", f"isotope {a}: {both}; the IAEA mass table "
                                  + (f"({am[1]}) doesn't settle it" if am else "has no measured value"))
            ab = P.abundance(ab_raw)
            if ab is not None:
                n_ab = P.abundance(nist_row[1]) if nist_row else None
                agrees = isinstance(n_ab, P.Num) and (P.in_interval(n_ab, *ab) if isinstance(ab, tuple) else P.agree(ab, n_ab))
                notes = "fraction of atoms in nature"
                if isinstance(n_ab, P.Num) and not agrees:
                    # CIAAW is the IUPAC body for isotopic composition; NIST may
                    # carry an older evaluation. CIAAW stands alone and must pass
                    # the abundance-sum check below (methodology section 5).
                    notes += f"; NIST gives an older value, {nist_row[1]}"
                value = {"min": ab[0].value, "max": ab[1].value} if isinstance(ab, tuple) else ab.value
                self.add(f"{base}/abundance", value, None, heading, via, ab_raw, notes=notes,
                         corroboration=[{"sourceUrl": page_iso, "upstream": "NIST Physical Measurement Laboratory", "value": nist_row[1]}] if agrees else None)
                natural.append((a, value, base, ab.uncertainty if isinstance(ab, P.Num) else None))
            if a in half_lives:
                self._add_half_life(f"{base}/halfLife", half_lives[a])

        if natural:
            # Abundances must add up to 1 (within their stated spread).
            lo = sum(v["min"] if isinstance(v, dict) else v for _, v, _, _ in natural)
            hi = sum(v["max"] if isinstance(v, dict) else v for _, v, _, _ in natural)
            slack = max(0.001, sum(u or 0 for *_, u in natural))
            if len(natural) != len(rows) or not (lo - slack <= 1.0 <= hi + slack):
                for _, _, base, _ in natural:
                    self.drop(f"{base}/abundance", f"abundances sum to {lo:.5f}..{hi:.5f}, not 1")
                self.drops.append(("/atom", "can't choose the isotope to draw: abundances failed their check"))
                return None
            center = lambda v: (v["min"] + v["max"]) / 2 if isinstance(v, dict) else v
            return max(natural, key=lambda n: center(n[1]))[0]

        if rows:
            self.drops.append(("/atom", "natural isotopes listed but no usable abundances"))
            return None

        # No natural isotopes: the longest-lived ground state with a measured half-life.
        timed = sorted(((a, h) for a, h in half_lives.items() if isinstance(h, P.HalfLife)), key=lambda x: -x[1].seconds)
        if not timed:
            self.drops.append(("/atom", "no natural isotopes and no measured half-lives"))
            return None
        best_a, best = timed[0]
        note = f"longest measured half-life among {len(timed)} ground-state isotopes"
        if len(timed) > 1:
            runner_a, runner = timed[1]
            if runner.bounds()[1] >= best.bounds()[0]:
                note += f"; near tie with {self.symbol}-{runner_a} ({runner.value.text} {runner.unit}), whose uncertainty overlaps"
                self.notes.append(f"near tie for longest-lived isotope: {best_a} vs {runner_a}")
        amdc = self._table("Atomic Mass, Half Life, and Decay", "IAEA Atomic Mass Data Center")
        mass_raw = next((m for n, m in zip(amdc.get("Nuclide", []), amdc.get("Atomic Mass and Uncertainty [u]", []))
                         if P.nuclide(n) == (best_a, self.symbol, "")), None)
        heading = "Atomic Mass, Half Life, and Decay"
        via = "IAEA Atomic Mass Data Center"
        self.add("/longestLivedIsotopeMassNumber", best_a, None, heading, via, f"{best_a}{self.symbol}", notes=note)
        self.add("/isotopes/0/massNumber", best_a, None, heading, via, f"{best_a}{self.symbol}")
        mass = P.amdc_mass(mass_raw) if mass_raw else None
        if mass is not None:
            self.add("/isotopes/0/atomicMass", mass.value, "u", heading, via, P.clean(mass_raw))
        self._add_half_life("/isotopes/0/halfLife", best)
        return best_a

    # -- consistency checks (methodology section 6) --

    def consistency(self) -> None:
        def single(p):
            f = self.facts.get(p)
            return f["value"] if f and not f["uncertain"] and isinstance(f["value"], (int, float)) else None

        def fail(pointers: list[str], reason: str) -> None:
            weak = [p for p in pointers if p in self.facts and p not in self.corroborated]
            for p in weak or [p for p in pointers if p in self.facts]:
                self.drop(p, f"failed consistency check: {reason}")

        mp, bp = single("/meltingPoint"), single("/boilingPoint")
        if mp is not None and bp is not None and not mp < bp:
            fail(["/meltingPoint", "/boilingPoint"], f"melting point {mp} °C is not below boiling point {bp} °C")
        state = self.facts.get("/state")
        if state and not state["uncertain"]:
            s = state["value"]
            mp, bp = single("/meltingPoint"), single("/boilingPoint")
            if s == "Solid" and mp is not None and not mp > ROOM_C:
                fail(["/meltingPoint", "/state"], f"Solid at room temperature but melts at {mp} °C")
            if s == "Liquid" and ((mp is not None and not mp < ROOM_C) or (bp is not None and not bp > ROOM_C)):
                fail(["/meltingPoint", "/boilingPoint", "/state"], f"Liquid at room temperature but melts at {mp} °C, boils at {bp} °C")
            if s == "Gas" and ((bp is not None and not bp < ROOM_C) or (mp is not None and not mp < ROOM_C)):
                fail(["/meltingPoint", "/boilingPoint", "/state"], f"Gas at room temperature but melts at {mp} °C, boils at {bp} °C")
        weight = self.facts.get("/atomicWeight")
        natural = [m.group(1) for p in self.facts if (m := re.fullmatch(r"(/isotopes/\d+)/abundance", p))]
        masses = [self.facts[f"{b}/atomicMass"]["value"] for b in natural if f"{b}/atomicMass" in self.facts]
        if weight and natural and len(masses) == len(natural):  # only on a complete set
            w = weight["value"]
            lo, hi = (w["min"], w["max"]) if isinstance(w, dict) else (w, w)
            # CIAAW rounds interval bounds outward, so allow one unit in their last place.
            ulp = 10 ** -max(P.Num(v, repr(v)).decimals for v in (lo, hi))
            if not (min(masses) - ulp <= lo and hi <= max(masses) + ulp):
                fail(["/atomicWeight"], f"atomic weight {w} lies outside the isotope masses {min(masses)}..{max(masses)}")

    # -- assemble --

    def build(self) -> Built:
        if not self.identity():
            return Built(None, [], self.drops, self.notes)
        self.period_and_group()
        self.atomic_weight()
        has_config = self.configuration()
        self.electronegativity()
        self.state()
        self.classification()
        self.temperature("/meltingPoint", "Melting Point")
        self.temperature("/boilingPoint", "Boiling Point")
        self.density()
        drawn = self.isotopes()
        self.consistency()

        if drawn is None or "/period" not in self.facts:
            self.drops.append(("/", "element not shipped: a required field is missing"))
            return Built(None, [], self.drops, self.notes)

        drawn_ptr = next(p for p, f in self.facts.items() if re.fullmatch(r"/isotopes/\d+/massNumber", p) and f["value"] == drawn)
        self.add_derived("/atom/protons", "protons-equal-atomic-number", ["/atomicNumber"])
        self.add_derived("/atom/electrons", "electrons-equal-atomic-number", ["/atomicNumber"])
        self.add_derived("/atom/neutrons", "neutrons-from-mass-number", [drawn_ptr, "/atomicNumber"])
        if not has_config:
            self.notes.append("shipped without an electron configuration, shells or valence: the configuration is disputed")
        else:
            self.add_derived("/atom/shells", "shells-from-configuration", ["/electronConfiguration"])
        group = self.facts.get("/group")
        if has_config and group and group["value"] in MAIN_GROUPS:
            if self.facts["/electronConfiguration"]["uncertain"]:
                self.drops.append(("/valenceElectrons", "configuration is only predicted, so no single number is shown"))
            else:
                self.add_derived("/valenceElectrons", "valence-main-group", ["/electronConfiguration", "/group"])

        return Built(self.assemble(drawn), list(self.records.values()), self.drops, self.notes)

    def assemble(self, drawn: int) -> dict:
        f = self.facts
        el: dict[str, Any] = {"id": f"element:{self.symbol}"}
        for key in ("atomicNumber", "symbol", "name", "period", "group", "atomicWeight", "longestLivedIsotopeMassNumber",
                    "electronConfiguration", "electronegativity", "valenceElectrons", "classification", "state", "meltingPoint", "boilingPoint", "density"):
            if f"/{key}" in f:
                el[key] = f[f"/{key}"]
        isotopes = []
        i = 0
        while f"/isotopes/{i}/massNumber" in f:
            iso = {"massNumber": f[f"/isotopes/{i}/massNumber"]}
            for key in ("atomicMass", "abundance", "halfLife"):
                if f"/isotopes/{i}/{key}" in f:
                    iso[key] = f[f"/isotopes/{i}/{key}"]
            isotopes.append(iso)
            i += 1
        el["isotopes"] = isotopes
        el["atom"] = {"isotope": drawn, **{k: f[f"/atom/{k}"] for k in ("protons", "neutrons", "electrons", "shells") if f"/atom/{k}" in f}}
        el["uses"] = []
        return el


# ---- Run ------------------------------------------------------------------------------


def load(z: int, refresh: bool) -> tuple[dict, str]:
    body, retrieved = fetch(PUG_VIEW.format(z=z), f"pubchem/element-{z}.json", refresh)
    return json.loads(body)["Record"], retrieved


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="fetch from the sources again instead of using the cache")
    ap.add_argument("--only", type=int, help="process a single atomic number and print the result")
    args = ap.parse_args(argv)

    checked_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    nist_cache: dict[str, PhaseData | None] = {}

    def nist(name: str) -> PhaseData | None:
        if name not in nist_cache:
            nist_cache[name] = phase_data(name, args.refresh)
        return nist_cache[name]

    lt_configs = libretexts_configurations(args.refresh)
    zs = [args.only] if args.only else list(range(1, 119))
    results: list[tuple[int, str, Built]] = []
    for z in zs:
        record, retrieved = load(z, args.refresh)
        b = ElementBuilder(z, record, retrieved, checked_at, nist, lt_configs)
        results.append((z, b.symbol or "?", b.build()))

    if args.only:
        z, sym, built = results[0]
        print(json.dumps({"drops": built.drops, "notes": built.notes, "element": built.element}, indent=2, ensure_ascii=False))
        return

    for d in (DATA_DIR, RECORDS_DIR):
        for old in d.glob("*.json") if d.exists() else []:
            old.unlink()
    for z, sym, built in results:
        if built.element is None:
            continue
        name = f"{z:03d}-{sym}.json"
        write_json(DATA_DIR / name, {"schemaVersion": 2, "kind": "elements", "items": [built.element]})
        write_json(RECORDS_DIR / name, {"schemaVersion": 2, "kind": "verification-records", "items": built.records})
    report = write_report(results, checked_at)
    shipped = sum(1 for *_, b in results if b.element)
    print(f"{shipped} of {len(results)} elements shipped; {sum(len(b.records) for *_, b in results)} facts; report: {report.relative_to(ROOT)}")


FIELDS = ["atomicWeight", "electronConfiguration", "electronegativity", "valenceElectrons", "classification", "state", "meltingPoint", "boilingPoint", "density"]


def write_report(results: list[tuple[int, str, Built]], checked_at: str) -> Path:
    shipped = [(z, s, b) for z, s, b in results if b.element]
    lines = [
        f"# Element verification report, {checked_at[:10]}",
        "",
        f"Generated by `{VERIFIER}` at {checked_at}, following [the methodology](../methodology.md).",
        "",
        "## Summary",
        "",
        f"- Elements shipped: **{len(shipped)} of {len(results)}**",
        f"- Facts shipped: **{sum(len(b.records) for _, _, b in shipped)}**, each with a passing record in `verification/records/elements/`",
        f"- Values left out: **{sum(len(b.drops) for *_, b in results)}** (listed below with the reason)",
        "",
        "## Coverage by field",
        "",
        "| Field | Shipped | Certain | Uncertain (predicted) |",
        "|---|---|---|---|",
    ]
    for key in FIELDS:
        vals = [b.element[key] for _, _, b in shipped if key in b.element]
        unc = sum(1 for v in vals if v["uncertain"])
        lines.append(f"| {key} | {len(vals)} | {len(vals) - unc} | {unc} |")
    lines += ["", "## Settled by the NIST WebBook tiebreak", ""]
    tiebreaks = [(z, s, r) for z, s, b in shipped for r in b.records if "NIST WebBook matches" in r.get("notes", "")]
    lines += [f"- {s} ({z}) `{r['subject']['field']}`: {r['notes']}" for z, s, r in tiebreaks] or ["None."]
    lines += ["", "## Left out, with reasons", "", "| Element | Field | Reason |", "|---|---|---|"]
    for z, s, b in results:
        for pointer, reason in b.drops:
            lines.append(f"| {s} ({z}) | `{pointer}` | {reason.replace('|', '/')} |")
    lines += ["", "## Notes", ""]
    for z, s, b in results:
        for n in b.notes:
            lines.append(f"- {s} ({z}): {n}")
    path = REPORTS_DIR / f"elements-{checked_at[:10]}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return path


if __name__ == "__main__":
    main()
