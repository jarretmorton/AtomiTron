"""Extract and verify compound facts, and compute reaction energies
(verification/methodology.md, section 14).

    python -m pipeline.compounds            # uses the download cache
    python -m pipeline.compounds --refresh  # fetch everything again

Reads data/reactions/definitions.json (the curated list of exact IDs and
equations). For each substance it reads PubChem (name, formula) by CID and
the NIST WebBook (formula, formation enthalpies) by ID, and checks the
formula against both. For each reaction it checks the balance and computes
the enthalpy.

Writes data/staged/reactions.json and verification/reports/reactions-<date>.md.
The staged file holds verified facts with their records, but not yet whole
compound and reaction entries: those also need text facts (state, summary,
bonding, hazards), which the agent step adds before anything reaches
data/verified/.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from . import parse as P
from .chem import (
    energy_direction, in_lowest_terms, is_balanced, parse_equation, parse_formula, reaction_enthalpy,
    state_at_room_temperature, summary_from_equation,
)
from .fetch import fetch

ROOT = Path(__file__).resolve().parent.parent
DEFINITIONS = ROOT / "data" / "reactions" / "definitions.json"
STAGED = ROOT / "data" / "staged" / "reactions.json"
REPORTS = ROOT / "verification" / "reports"
VERIFIER = "pipeline/compounds.py"

PUBCHEM_PAGE = "https://pubchem.ncbi.nlm.nih.gov/compound/{cid}"
PUBCHEM_API = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/property/MolecularFormula,Title/JSON"
PUBCHEM_VIEW = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON"
PUBCHEM_SYNONYMS = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/synonyms/JSON"
ELEMENTS_DIR = ROOT / "data" / "verified" / "elements"
NIST_PAGE = "https://webbook.nist.gov/cgi/cbook.cgi?ID={id}&Units=SI&cTG=on&cTC=on"
_LT = "https://chem.libretexts.org/Bookshelves/Introductory_Chemistry/Introductory_Chemistry_(LibreTexts)"
# OpenStax Chemistry 2e on LibreTexts, section 5.3 "Enthalpy". It states all
# three energy rules: the zero for an element in its most stable form, that a
# negative change is exothermic and a positive one endothermic, and that
# reversing an equation flips the sign.
_ENTHALPY = "https://chem.libretexts.org/Bookshelves/General_Chemistry/Chemistry_2e_(OpenStax)/05%3A_Thermochemistry/5.03%3A_Enthalpy"
# Pages that explain the rules behind derived values. Checked by the agent
# step like the element explanations before anything is published.
RULE_PAGES = {
    "zero-for-element-in-standard-state": _ENTHALPY,
    "reaction-enthalpy": _ENTHALPY,
    "energy-direction": _ENTHALPY,
    "state-at-room-temperature": f"{_LT}/03%3A_Matter_and_Energy/3.03%3A_Classifying_Matter_According_to_Its_StateSolid_Liquid_and_Gas",
    "summary-from-equation": f"{_LT}/07%3A_Chemical_Reactions/7.03%3A_The_Chemical_Equation",
}
STATE_PHASE = {"solid": "s", "liquid": "l", "gas": "g"}
# GHS statements: ECHA's aggregated notifications give the share of
# notifiers for each code, e.g. "H260 (100%): In contact with water ...".
GHS = re.compile(r"^(H\d{3})(?:\+H\d{3})* \((\d+(?:\.\d+)?)%\): ([^\[]+?)\s*(?:\[.*)?$")
ECHA = "European Chemicals Agency (ECHA)"
PHASES = {"gas": "g", "liquid": "l", "solid": "s"}


# ---- NIST WebBook ------------------------------------------------------------------


@dataclass(frozen=True)
class Row:
    phase: str  # s | l | g
    num: P.Num
    raw: str
    method: str  # "Review", "Ccb", ...
    reference: str

    @property
    def year(self) -> int:
        m = re.search(r"(1[89]\d\d|20\d\d)", self.reference)
        return int(m.group(1)) if m else 0


def enthalpy_value(text: str) -> P.Num | None:
    """'-601.60 ± 0.30' -> Num(-601.60, uncertainty 0.30); '-411.12' -> Num."""
    m = re.fullmatch(r"(-?\d+(?:\.\d*)?)(?: ± (\d+(?:\.\d+)?))?", P.clean(text))
    if not m:
        return None
    digits = m.group(1).rstrip(".")  # the WebBook writes "-84." for -84
    return P.Num(float(digits), digits, float(m.group(2)) if m.group(2) else None)


def parse_nist(page: str) -> tuple[str | None, list[Row]]:
    """(formula, formation-enthalpy rows) from a WebBook substance page."""
    f = re.search(r"Formula</a>:</strong>\s*(.*?)</li>", page, re.S)
    formula = html.unescape(re.sub(r"<[^>]+>", "", f.group(1))).strip() if f else None
    rows = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        c = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
        if len(c) >= 5 and c[0].startswith("ΔfH°") and c[2] == "kJ/mol":
            phase = PHASES.get(c[0].replace("ΔfH°", ""))
            num = enthalpy_value(c[1])
            if phase and num:
                rows.append(Row(phase, num, c[1], c[3], c[4]))
    return formula, rows


def choose(rows: list[Row]) -> tuple[Row | None, list[Row], str | None, str]:
    """Pick the value for one phase (methodology section 14).

    Returns (chosen, agreeing others, qualifier, note); chosen is None when
    the rows disagree."""
    reviews = [r for r in rows if r.method == "Review"]
    pool, qualifier = (reviews, None) if reviews else (rows, "single measurement" if len(rows) == 1 else "measured values")
    for a in pool:
        for b in pool:
            if a is not b and not P.agree(a.num, b.num):
                listed = "; ".join(f"{r.raw} ({r.reference})" for r in pool)
                if reviews:
                    # Reviewed sources that differ beyond their stated
                    # uncertainty are shown as a range (decided 2026-11-15).
                    return None, pool, "reviewed sources differ", f"reviewed values differ: {listed}"
                return None, [], None, f"values disagree: {listed}"
    # Prefer a value that states its uncertainty; then CODATA; then the newest.
    best = sorted(pool, key=lambda r: (r.num.uncertainty is None, "Cox" not in r.reference, -r.year))[0]
    others = [r for r in pool if r is not best]
    kind = "reviewed" if reviews else "measured"
    note = f"{len(pool)} {kind} value(s) in the WebBook" + ("; they agree" if others else "; single source")
    return best, others, qualifier, note


# ---- Build ---------------------------------------------------------------------------


class Builder:
    def __init__(self, refresh: bool):
        self.refresh = refresh
        self.checked_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        self.records: list[dict] = []
        self.drops: list[tuple[str, str]] = []
        self.notes: list[str] = []

    def fact(self, entity: str, field: str, value, unit, url: str, retrieved: str, via: str, raw: str, *,
             qualifier: str | None = None, as_written: str | None = None, corroboration: list | None = None,
             notes: str | None = None, derivation: dict | None = None, uncertain: bool = False) -> dict:
        rid = f"{entity.split(':', 1)[1]}{field.replace('/', '.')}"
        fact = {"value": value, "unit": unit, "uncertain": uncertain}
        if qualifier:
            fact["qualifier"] = qualifier
        fact["source"] = {"url": url, "retrieved": retrieved, "via": via, **({"asWritten": as_written} if as_written else {})}
        fact["verification"] = {"status": "pass", "recordId": rid}
        if derivation:
            fact["derivation"] = derivation
        record = {
            "id": rid, "subject": {"entity": entity, "field": field}, "method": "derive" if derivation else "extract",
            "claimedValue": value, "unit": unit, "sourceUrl": url, "upstream": via, "retrievedValue": value,
            **({} if derivation else {"evidence": raw[:400]}),
            **({"corroboration": corroboration} if corroboration else {}),
            "result": "pass", "checkedAt": self.checked_at, "consistency": {"runs": 1, "agreeing": 1}, "verifier": VERIFIER,
            **({"notes": notes} if notes else {}),
        }
        self.records.append(record)
        return fact

    def substance(self, key: str, d: dict) -> dict | None:
        """Identity and formation enthalpies for one substance."""
        entity = f"compound:cid-{d['cid']}"
        wanted = parse_formula(key)
        body, retrieved = fetch(PUBCHEM_API.format(cid=d["cid"]), f"pubchem/compound-{d['cid']}.json", self.refresh)
        props = json.loads(body)["PropertyTable"]["Properties"][0]
        pc_formula, title = props["MolecularFormula"], props["Title"]
        if wanted is None or parse_formula(pc_formula) != wanted:
            self.drops.append((key, f"PubChem CID {d['cid']} is {title} with formula {pc_formula}, not {key}"))
            return None
        page = PUBCHEM_PAGE.format(cid=d["cid"])
        # The display name is curated, because PubChem's page titles aren't
        # always the right name (CID 313, gaseous HCl, is titled "Hydrochloric
        # Acid"). It must be one of PubChem's own names for that CID.
        body, s_retrieved = fetch(PUBCHEM_SYNONYMS.format(cid=d["cid"]), f"pubchem/synonyms-{d['cid']}.json", self.refresh)
        synonyms = json.loads(body)["InformationList"]["Information"][0].get("Synonym", [])
        written = next((s for s in synonyms if same_name(s, d["name"])), None)
        if written is None:
            self.drops.append((key, f"the name {d['name']!r} isn't among PubChem's names for CID {d['cid']}"))
            return None
        out = {
            "key": key, "id": entity, **({"element": f"element:{d['element']}"} if d.get("element") else {}),
            **({"nistId": d["nist"]} if d.get("nist") else {}),
            "name": self.fact(entity, "/name", d["name"], None, page + "#section=Synonyms", s_retrieved, "PubChem", written,
                              as_written=written if written != d["name"] else None,
                              notes=f"one of PubChem's names for CID {d['cid']} (page title: {title})"),
            "formula": self.fact(entity, "/formula", key, None, page + "#section=Molecular-Formula", retrieved, "PubChem", pc_formula,
                                 as_written=pc_formula if pc_formula != key else None,
                                 notes="same atoms as the source's formula, in the usual written order" if pc_formula != key else None),
            "formationEnthalpies": [],
        }
        if d.get("element") and set(wanted) != {d["element"]}:
            self.drops.append((key, f"marked as element {d['element']} but its formula is {key}"))
            return None
        if d.get("element"):
            self.element_state(out, d["element"])
        out["hazards"] = self.hazards(entity, d["cid"])
        if not d.get("nist"):
            self.notes.append(f"{key}: no NIST WebBook entry")
            return out
        url = NIST_PAGE.format(id=d["nist"])
        body, n_retrieved = fetch(url, f"nist/id-{d['nist']}.html", self.refresh)
        n_formula, rows = parse_nist(body.decode("utf-8", errors="replace"))
        if n_formula is None or parse_formula(n_formula) != wanted:
            self.drops.append((key, f"NIST {d['nist']} has formula {n_formula}, not {key}; its enthalpies are not used"))
            return out
        for phase in ("s", "l", "g"):
            in_phase = [r for r in rows if r.phase == phase]
            if not in_phase:
                continue
            best, others, qualifier, note = choose(in_phase)
            if best is None and others:
                lo, hi = min(r.num.value for r in others), max(r.num.value for r in others)
                self.notes.append(f"{key}({phase}): {note}; shown as a range")
                out["formationEnthalpies"].append({"phase": phase, "value": self.fact(
                    entity, f"/formationEnthalpies/{phase}", {"min": lo, "max": hi}, "kJ/mol", url, n_retrieved,
                    "; ".join(r.reference for r in others), "; ".join(r.raw for r in others), qualifier=qualifier, notes=note)})
                continue
            if best is None:
                self.drops.append((f"{key}({phase})", f"formation enthalpy: {note}"))
                continue
            out["formationEnthalpies"].append({"phase": phase, "value": self.fact(
                entity, f"/formationEnthalpies/{phase}", best.num.value, "kJ/mol", url, n_retrieved, best.reference, best.raw,
                qualifier=qualifier, notes=note,
                corroboration=[{"sourceUrl": url, "upstream": r.reference, "value": r.raw} for r in others] or None)})
        return out

    def reaction(self, r: dict, subs: dict[str, dict]) -> dict | None:
        rid = f"reaction:{r['id']}"
        if "noReaction" in r:
            missing = [k for k in r["noReaction"] if k not in subs]
            if missing:
                self.drops.append((r["id"], f"unknown substances {missing}"))
                return None
            out = {"id": rid, "title": r["title"], "kind": "no-reaction", "inputs": [input_id(subs[k]) for k in r["noReaction"]]}
            out["summary"] = [self.summary(rid, [(subs[k], -1) for k in r["noReaction"]])]
            return out
        parsed = parse_equation(r["equation"])
        if parsed is None:
            self.drops.append((r["id"], f"equation doesn't parse: {r['equation']}"))
            return None
        reactants, products = parsed
        unknown = [f for _, f, _ in reactants + products if f not in subs]
        if unknown:
            self.drops.append((r["id"], f"substances not verified: {unknown}"))
            return None
        side = lambda terms: [(c, parse_formula(f)) for c, f, _ in terms]
        if not is_balanced(side(reactants), side(products)):
            self.drops.append((r["id"], f"equation doesn't balance: {r['equation']}"))
            return None
        if not in_lowest_terms([c for c, _, _ in reactants + products]):
            self.drops.append((r["id"], f"coefficients share a common factor: {r['equation']}"))
            return None
        species = lambda terms: [{"substance": subs[f]["id"], "coefficient": c, "phase": p} for c, f, p in terms]
        out = {"id": rid, "title": r["title"], "kind": "reaction", "equation": r["equation"],
               "inputs": [input_id(subs[f]) for _, f, _ in reactants],
               "reactants": species(reactants), "products": species(products)}
        out["summary"] = [self.summary(rid, [(subs[f], -1) for _, f, _ in reactants] + [(subs[f], 1) for _, f, _ in products])]

        if r.get("noEnergy"):
            out["energy"] = {"unavailable": r["noEnergy"]}
            return out
        inputs, weights, values, missing = [], [], [], []
        for sign, terms in ((-1, reactants), (1, products)):
            for c, f, p in terms:
                h = self.enthalpy_for(subs[f], p)
                if h is None:
                    missing.append(f"{f}({p})")
                else:
                    inputs.append(h["verification"]["recordId"])
                    weights.append(sign * c)
                    values.append(h["value"])
        if missing:
            names = " and ".join(subs[m.split("(")[0]]["name"]["value"].lower() for m in missing)
            out["energy"] = {"unavailable": f"The NIST WebBook has no formation enthalpy for {names}."}
            self.notes.append(f"{r['id']}: no energy, missing {', '.join(missing)}")
            return out
        value = reaction_enthalpy(values, weights)
        qualifiers = sorted({q for f in [*reactants, *products] if (q := (self.enthalpy_for(subs[f[1]], f[2]) or {}).get("qualifier"))})
        retrieved = max(subs[f]["name"]["source"]["retrieved"] for _, f, _ in reactants + products)
        enthalpy = self.fact(rid, "/energy/enthalpy", value, "kJ", RULE_PAGES["reaction-enthalpy"], retrieved, "LibreTexts Chemistry", "",
                             # An energy is only as firm as its weakest input.
                             qualifier="; ".join(qualifiers) or None,
                             derivation={"rule": "reaction-enthalpy", "inputs": inputs, "weights": weights},
                             notes=f"reaction-enthalpy for {r['equation']}")
        direction = self.fact(rid, "/energy/direction", energy_direction(value), None, RULE_PAGES["energy-direction"], retrieved,
                              "LibreTexts Chemistry", "", derivation={"rule": "energy-direction", "inputs": [enthalpy["verification"]["recordId"]]})
        out["energy"] = {"enthalpy": enthalpy, "direction": direction}
        return out

    def enthalpy_for(self, sub: dict, phase: str) -> dict | None:
        """The substance's formation enthalpy in this phase. For an element,
        the phase the equation uses is taken as its standard state and gets
        the defined zero; the agent step must confirm that state before the
        entry is published."""
        for h in sub["formationEnthalpies"]:
            if h["phase"] == phase:
                return h["value"]
        state = sub.get("standardState")
        if sub.get("element") and state and STATE_PHASE[state["value"]] != phase:
            # The zero is only for the element's own standard state.
            self.notes.append(f"{sub['key']}: the equation has it as ({phase}), but it is a {state['value']} at room temperature")
            return None
        if sub.get("element"):
            zero = self.fact(sub["id"], f"/formationEnthalpies/{phase}", 0, "kJ/mol", RULE_PAGES["zero-for-element-in-standard-state"],
                             sub["name"]["source"]["retrieved"], "LibreTexts Chemistry", "",
                             derivation={"rule": "zero-for-element-in-standard-state", "inputs": [f"{sub['id'].split(':', 1)[1]}.standardState"]},
                             notes="element in its standard state" + ("" if state else "; the standard state is confirmed by the agent step"))
            sub["formationEnthalpies"].append({"phase": phase, "value": zero})
            return zero
        return None


    def summary(self, rid: str, parts: list[tuple[dict, int]]) -> dict:
        """The first summary statement, written by code from the verified
        names and the equation (rule summary-from-equation)."""
        names = [s["name"] for s, _ in parts]
        weights = [w for _, w in parts]
        text = summary_from_equation([n["value"] for n in names], weights)
        return self.fact(rid, "/summary/0", text, None, RULE_PAGES["summary-from-equation"],
                         max(n["source"]["retrieved"] for n in names), "LibreTexts Chemistry", "",
                         derivation={"rule": "summary-from-equation", "inputs": [n["verification"]["recordId"] for n in names],
                                     "weights": weights},
                         notes="written by code from the verified names and the balanced equation")

    def element_state(self, out: dict, symbol: str) -> None:
        """An element's state at 25 °C, derived from its verified melting and
        boiling points. Left for the agent step when either is missing."""
        path = next(ELEMENTS_DIR.glob(f"*-{symbol}.json"), None)
        e = json.loads(path.read_text("utf-8"))["items"][0] if path else {}
        number = lambda f: f and isinstance(f["value"], (int, float))
        mp, bp = e.get("meltingPoint"), e.get("boilingPoint")
        if not number(mp):
            self.notes.append(f"{out['key']}: no verified melting point; its state is left to the agent step")
            return
        # A melting point above room temperature settles it on its own.
        inputs = [mp] + ([bp] if number(bp) else [])
        try:
            state = state_at_room_temperature(*(f["value"] for f in inputs))
        except ValueError as err:
            self.notes.append(f"{out['key']}: {err}; its state is left to the agent step")
            return
        out["standardState"] = self.fact(
            out["id"], "/standardState", state, None, RULE_PAGES["state-at-room-temperature"], mp["source"]["retrieved"],
            "LibreTexts Chemistry", "", uncertain=any(f["uncertain"] for f in inputs),
            derivation={"rule": "state-at-room-temperature", "inputs": [f["verification"]["recordId"] for f in inputs]},
            notes=f"melting point {mp['value']} °C" + (f" and boiling point {bp['value']} °C" if len(inputs) == 2 else "")
            + ", against room temperature (25 °C)")

    def hazards(self, entity: str, cid: int) -> list[dict]:
        """GHS hazard statements that more than half of ECHA's notifiers
        report (decided 2026-11-15)."""
        body, retrieved = fetch(PUBCHEM_VIEW.format(cid=cid), f"pubchem/compound-full-{cid}.json", self.refresh)
        rec = json.loads(body)["Record"]
        refs = {r["ReferenceNumber"]: r.get("SourceName", "") for r in rec.get("Reference", [])}
        url = PUBCHEM_PAGE.format(cid=cid) + "#section=GHS-Classification"
        out, seen = [], set()

        def walk(sections):
            for s in sections:
                if s["TOCHeading"] == "GHS Classification":
                    for i in s.get("Information", []):
                        if i.get("Name") == "GHS Hazard Statements" and refs.get(i.get("ReferenceNumber")) == ECHA:
                            for x in i["Value"]["StringWithMarkup"]:
                                m = GHS.match(x["String"].strip())
                                if not m or m.group(1) in seen:
                                    continue
                                share = float(m.group(2))
                                if share <= 50:
                                    continue
                                code, text = m.group(1), m.group(3).strip()
                                seen.add(code)
                                n = len(out)
                                out.append({
                                    "code": code,
                                    "statement": self.fact(entity, f"/hazards/{n}/statement", text, None, url, retrieved, ECHA,
                                                           x["String"], notes=f"GHS {code}"),
                                    "reportedBy": self.fact(entity, f"/hazards/{n}/reportedBy", share, "%", url, retrieved, ECHA,
                                                            x["String"], notes=f"share of ECHA notifiers reporting {code}"),
                                })
                walk(s.get("Section", []))

        walk(rec.get("Section", []))
        return out


def same_name(a: str, b: str) -> bool:
    """Names match ignoring case and spaces around brackets:
    "iron (III) oxide" is "iron(III) oxide"."""
    norm = lambda s: re.sub(r"\s*([()])\s*", r"\1", s.strip().lower())
    return norm(a) == norm(b)


def shown(value) -> str:
    return f"{value['min']} to {value['max']}" if isinstance(value, dict) else str(value)


def input_id(sub: dict) -> str:
    return sub.get("element") or sub["id"]


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args(argv)
    defs = json.loads(DEFINITIONS.read_text("utf-8"))
    b = Builder(args.refresh)
    subs = {k: s for k, d in defs["substances"].items() if (s := b.substance(k, d))}
    reactions = [x for r in defs["reactions"] if (x := b.reaction(r, subs))]

    STAGED.parent.mkdir(parents=True, exist_ok=True)
    STAGED.write_text(json.dumps({"generatedAt": b.checked_at, "substances": list(subs.values()), "reactions": reactions,
                                  "records": b.records}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    report = write_report(b, subs, reactions)
    with_energy = sum(1 for r in reactions if "enthalpy" in r.get("energy", {}))
    print(f"{len(subs)} of {len(defs['substances'])} substances; {len(reactions)} of {len(defs['reactions'])} entries; "
          f"{with_energy} reactions with a computed enthalpy; report: {report.relative_to(ROOT).as_posix()}")


def write_report(b: Builder, subs: dict, reactions: list[dict]) -> Path:
    name = {s["id"]: s["key"] for s in subs.values()}
    lines = [f"# Reaction energies report, {b.checked_at[:10]}", "",
             f"Generated by `{VERIFIER}` at {b.checked_at}, following [the methodology](../methodology.md) (section 14).",
             "These values are staged, not published: each entry still needs its text facts.", "",
             "## Reactions", "", "| Reaction | Equation | Enthalpy (kJ) | Note |", "|---|---|---|---|"]
    for r in reactions:
        if r["kind"] == "no-reaction":
            lines.append(f"| {r['title']} | no reaction | | |")
            continue
        e = r["energy"]
        if "enthalpy" in e:
            f = e["enthalpy"]
            lines.append(f"| {r['title']} | {r['equation']} | {shown(f['value'])} ({e['direction']['value']}) | {f.get('qualifier', '')} |")
        else:
            lines.append(f"| {r['title']} | {r['equation']} | none | {e['unavailable']} |")
    lines += ["", "## Formation enthalpies used", "", "| Substance | Phase | ΔfH° (kJ/mol) | Reference | Note |", "|---|---|---|---|---|"]
    for s in subs.values():
        for h in s["formationEnthalpies"]:
            f = h["value"]
            rec = next(x for x in b.records if x["id"] == f["verification"]["recordId"])
            lines.append(f"| {s['key']} | {h['phase']} | {shown(f['value'])} | {f['source']['via']} | {f.get('qualifier') or ''} {rec.get('notes', '')} |")
    lines += ["", "## States and hazard statements", "", "| Substance | State at 25 °C | Hazard statements (share of notifiers) |", "|---|---|---|"]
    for s in subs.values():
        st = s.get("standardState")
        state = f"{st['value']} (derived from {len(st['derivation']['inputs'])} verified point(s))" if st else "agent step"
        hz = "; ".join(f"{h['code']} {h['statement']['value']} ({h['reportedBy']['value']:g}%)" for h in s["hazards"]) or "none above half"
        lines.append(f"| {s['key']} | {state} | {hz} |")
    lines += ["", "## Left out, with reasons", ""] + ([f"- `{k}`: {why}" for k, why in b.drops] or ["None."])
    lines += ["", "## Notes", ""] + ([f"- {n}" for n in b.notes] or ["None."])
    path = REPORTS / f"reactions-{b.checked_at[:10]}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    return path


if __name__ == "__main__":
    main()
