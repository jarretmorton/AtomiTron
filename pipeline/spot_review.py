"""Draw the random sample for a human spot review (spec 10.4a).

    python -m pipeline.spot_review checkpoint-1 25

Samples verified facts with a fixed seed (the checkpoint name), so anyone can
re-draw the same sample. The draw uses a quota per category of facts most
likely to hide a mistake:
- derived counts
- values settled by a tiebreak
- agent-checked text
- uncertain values
- single-contributor values

Definitional facts (symbol, name, atomic number, protons and electrons) are
left out. At most two facts are drawn per element.

Writes verification/spot-reviews/<name>-sample.json.
"""

from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "verified" / "elements"
RECORDS = ROOT / "verification" / "records"
OUT = ROOT / "verification" / "spot-reviews"

LABELS = {
    "atomicNumber": "Atomic number", "symbol": "Symbol", "name": "Name", "period": "Period",
    "group": "Group", "atomicWeight": "Atomic weight", "longestLivedIsotopeMassNumber": "Mass number of longest-lived isotope",
    "electronConfiguration": "Electron configuration", "electronegativity": "Electronegativity (Pauling)",
    "valenceElectrons": "Valence electrons", "classification": "Metal / non-metal / semi-metal", "state": "State at room temperature",
    "meltingPoint": "Melting point", "boilingPoint": "Boiling point", "density": "Density",
    "atom/protons": "Protons", "atom/neutrons": "Neutrons", "atom/electrons": "Electrons", "atom/shells": "Electrons in each shell",
    "discovery/year": "Discovered or first isolated", "massNumber": "Mass number", "atomicMass": "Mass", "abundance": "Share of atoms in nature",
    "halfLife": "Half-life",
}

HOW = {
    "extract": "Open the source link and find this value in the named contributor's entry. It should match exactly (the app may show fewer digits, never more).",
    "derive": "This value is calculated. Check its inputs on their source pages, then check the arithmetic or rule.",
    "agent": "Open the source link and read the passage. The statement should say nothing the passage doesn't.",
}


def show(value, unit) -> str:
    if isinstance(value, dict):
        text = f"{value['min']} to {value['max']}"
    elif isinstance(value, list):
        text = ", ".join(map(str, value))
    else:
        text = str(value)
    return f"{text} {unit}" if unit else text


def label(field: str, element: dict) -> str:
    if m := re.fullmatch(r"/isotopes/(\d+)/(\w+)", field):
        iso = element["isotopes"][int(m.group(1))]["massNumber"]["value"]
        return f"{LABELS.get(m.group(2), m.group(2))} of {element['name']['value'].lower()}-{iso}"
    if m := re.fullmatch(r"/(discovery/story|uses)/(\d+)", field):
        return "How it was found" if m.group(1) == "discovery/story" else "What it is used for"
    return LABELS.get(field.lstrip("/"), field)


# Quotas per risk category for a 25-fact sample (scaled for other sizes).
# Trivial definitional facts (symbol, name, atomic number, protons and
# electrons equal to it) are left out: they can't meaningfully be wrong.
QUOTAS = {"agent": 6, "derived": 5, "tiebreak": 3, "uncertain": 3, "single": 4, "other": 4}
TRIVIAL_FIELDS = {"/symbol", "/name", "/atomicNumber", "/atom/protons", "/atom/electrons"}


def category(fact: dict, record: dict) -> str | None:
    field = record["subject"]["field"]
    notes = record.get("notes", "")
    if field in TRIVIAL_FIELDS:
        return None
    if "NIST WebBook matches" in notes or "IAEA mass table matches" in notes:
        return "tiebreak"
    if record["method"] == "agent":
        return "agent"
    if record["method"] == "derive":
        return "derived"
    if fact.get("uncertain"):
        return "uncertain"
    if "single contributor" in notes:
        return "single"
    return "other"


def facts_in(node, path=""):
    if isinstance(node, list):
        for i, x in enumerate(node):
            yield from facts_in(x, f"{path}/{i}")
    elif isinstance(node, dict):
        if "verification" in node:
            yield path, node
            return
        for k, v in node.items():
            yield from facts_in(v, f"{path}/{k}")


def main(name: str, n: int) -> None:
    records = {}
    for f in RECORDS.rglob("*.json"):
        for r in json.loads(f.read_text("utf-8"))["items"]:
            records[r["id"]] = r

    pool = []
    for f in sorted(DATA.glob("*.json")):
        element = json.loads(f.read_text("utf-8"))["items"][0]
        for path, fact in facts_in(element):
            r = records[fact["verification"]["recordId"]]
            pool.append((element, fact, r))

    rng = random.Random(f"atomitron-{name}")
    scale = n / sum(QUOTAS.values())
    quotas = {c: max(1, round(q * scale)) for c, q in QUOTAS.items()}
    picked, per_element = [], {}
    for cat, quota in quotas.items():
        candidates = [t for t in pool if category(t[1], t[2]) == cat]
        rng.shuffle(candidates)
        taken = 0
        for element, fact, r in candidates:
            sym = element["symbol"]["value"]
            if taken == quota:
                break
            if per_element.get(sym, 0) >= 2:
                continue
            per_element[sym] = per_element.get(sym, 0) + 1
            picked.append((element, fact, r))
            taken += 1

    items = []
    for i, (element, fact, r) in enumerate(sorted(picked, key=lambda t: t[0]["atomicNumber"]["value"]), 1):
        inputs = []
        if fact.get("derivation"):
            for rid in fact["derivation"]["inputs"]:
                ir = records[rid]
                inputs.append({"what": label(ir["subject"]["field"], element), "value": show(ir["claimedValue"], ir["unit"]),
                               "sourceUrl": ir["sourceUrl"], "contributor": ir.get("upstream")})
        items.append({
            "n": i,
            "recordId": r["id"],
            "element": element["name"]["value"],
            "symbol": element["symbol"]["value"],
            "field": label(r["subject"]["field"], element),
            "shown": show(fact["value"], fact["unit"]),
            "uncertain": fact["uncertain"],
            "sourceUrl": fact["source"]["url"],
            "contributor": fact["source"].get("via"),
            "method": r["method"],
            "category": category(fact, r),
            "rule": fact["derivation"]["rule"] if fact.get("derivation") else None,
            "inputs": inputs,
            "evidence": r.get("evidence") if r["method"] == "agent" else None,
            "how": HOW[r["method"]],
            "notes": r.get("notes"),
        })

    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{name}-sample.json"
    out.write_text(json.dumps({"checkpoint": name, "seed": f"atomitron-{name}", "poolSize": len(pool), "items": items},
                              indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    by = {}
    for it in items:
        by[it["method"]] = by.get(it["method"], 0) + 1
    print(f"{len(items)} of {len(pool)} facts sampled ({by}) -> {out.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]))
