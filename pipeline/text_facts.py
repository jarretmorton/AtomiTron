"""Text facts (history, uses, explanations): code checks around the agents.

    python -m pipeline.text_facts claims   RUN_DIR   # drafts.json -> claims.json
    python -m pipeline.text_facts evaluate RUN_DIR   # claims + 3 verdicts -> facts

The agents (pipeline/prompts/) draft and judge. Code does everything that can
be checked mechanically (verification/methodology.md, section 3):
- every excerpt must appear word for word in the cited passage
- a passage must belong to the element and section the claim is about
- the safety screen: no numbers in uses, and only stated years in history
- a claim passes only if all three independent verifiers support it, each
  with a verbatim excerpt

Passing element facts go to data/text/elements/<Z>-<symbol>.json, which
pipeline.elements merges into the verified element files. Explanation records
go to verification/records/concepts.json. RUN_DIR keeps the drafts, claims,
verdicts and a report as the audit trail (short excerpts only, never the full
passages).
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from .text_sources import OUT as SOURCES_DIR, normalize

ROOT = Path(__file__).resolve().parent.parent
TEXT_DIR = ROOT / "data" / "text" / "elements"
CONCEPT_RECORDS = ROOT / "verification" / "records" / "concepts.json"
RUNS = 3
VERIFIER = "Claude Code subagents (claude-opus-5-5): 1 drafter, 3 independent verifiers; prototype run"
MAX_EXCERPT_WORDS = 25

# Words that signal operational or hazardous content. A match sends the claim
# back rather than to the verifiers (spec 4: textbook level only).
SCREEN = re.compile(
    r"\b(weapon|bomb|explosive|explode|poison|toxic gas|drug|overdose|recipe|mix(ed|ing)? with|"
    r"heat(ed|ing)? to|dissolve|grams?|liters?|litres?|milli|percent|concentrat)\w*",
    re.I,
)


def load_json(path: Path):
    return json.loads(path.read_text("utf-8"))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def sources() -> dict[str, dict]:
    return {p["id"]: p for p in load_json(SOURCES_DIR / "sources.json")}


def verbatim(excerpt: str | None, passage: dict) -> bool:
    if not excerpt or "..." in excerpt or "…" in excerpt:
        return False
    e = normalize(excerpt)
    return 0 < len(e.split()) <= MAX_EXCERPT_WORDS and e in passage["text"]


def screen(kind: str, text: str) -> str | None:
    """Why a statement fails the safety screen, or None if it passes."""
    if SCREEN.search(text):
        return f"safety screen: {SCREEN.search(text).group(0)!r}"
    digits = re.sub(r"\b1\d{3}\b|\b20\d{2}\b", "", text) if kind == "story" else text
    if re.search(r"\d", digits):
        return "safety screen: numbers aren't allowed here" if kind == "uses" else "safety screen: only years may be numbers"
    if len(text.split()) > 25:
        return "longer than 25 words"
    return None


# ---- claims -------------------------------------------------------------------


def build_claims(run: Path) -> None:
    src = sources()
    drafts = load_json(run / "drafts.json")["elements"]
    claims, rejected = [], []
    names = {p["element"]: p["elementName"] for p in src.values() if "element" in p}

    def take(cid: str, text: str, item: dict, kind: str, element: str) -> None:
        p = src.get(item.get("passage", ""))
        heading = "History" if kind in ("story", "year") else "Uses"
        if p is None or p.get("element") != element or p.get("heading") != heading:
            rejected.append((cid, f"cites {item.get('passage')!r}, not a {heading} passage for {element}"))
        elif not verbatim(item.get("excerpt"), p):
            rejected.append((cid, "drafter's excerpt isn't word for word in the passage"))
        elif kind != "year" and (why := screen(kind, text)):
            rejected.append((cid, why))
        elif kind == "year" and str(item["value"]) not in normalize(item["excerpt"]) and item["value"] != "Ancient":
            rejected.append((cid, "the year isn't in the drafter's excerpt"))
        else:
            claims.append({"id": cid, "text": text, "passage": p["id"]})

    for sym, d in drafts.items():
        name = names.get(sym, sym)
        y = d.get("discoveryYear")
        if y:
            text = (f"{name} has been known since ancient times." if y["value"] == "Ancient"
                    else f"{name} was discovered or first isolated in {y['value']}.")
            take(f"{sym}.discoveryYear", text, y, "year", sym)
        for kind in ("story", "uses"):
            for i, item in enumerate(d.get(kind, [])):
                take(f"{sym}.{kind}.{i}", item["text"].strip(), item, kind, sym)

    claims += load_json(SOURCES_DIR / "claims-concepts.json")
    write_json(run / "claims.json", claims)
    write_json(run / "rejected-before-verification.json", [{"id": c, "reason": r} for c, r in rejected])
    print(f"{len(claims)} claims for verification ({len(rejected)} rejected by code first) -> {run / 'claims.json'}")


# ---- evaluate -----------------------------------------------------------------


def evaluate(run: Path) -> None:
    src = sources()
    claims = {c["id"]: c for c in load_json(run / "claims.json")}
    drafts = load_json(run / "drafts.json")["elements"]
    verdicts = [load_json(run / f"verdicts-{i}.json")["claims"] for i in range(1, RUNS + 1)]
    checked_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    results = {}
    for cid, claim in claims.items():
        passage = src[claim["passage"]]
        agreeing, excerpts, reasons = 0, [], []
        for n, v in enumerate(verdicts, 1):
            got = v.get(cid)
            if not got:
                reasons.append(f"verifier {n}: no verdict")
            elif got.get("verdict") != "supported":
                reasons.append(f"verifier {n}: {got.get('reason', 'not supported')}")
            elif not verbatim(got.get("excerpt"), passage):
                reasons.append(f"verifier {n}: excerpt isn't word for word in the passage")
            else:
                agreeing += 1
                excerpts.append(normalize(got["excerpt"]))
        results[cid] = {"claim": claim, "passage": passage, "agreeing": agreeing,
                        "excerpt": excerpts[0] if excerpts else None, "reasons": reasons,
                        "pass": agreeing == RUNS}

    def record(rid, entity, field, value, r) -> dict:
        p = r["passage"]
        return {
            "id": rid,
            "subject": {"entity": entity, "field": field},
            "method": "agent",
            "claimedValue": value,
            "unit": None,
            "sourceUrl": p["url"],
            "upstream": p["contributor"],
            "retrievedValue": r["excerpt"],
            "evidence": r["excerpt"],
            "result": "pass",
            "checkedAt": checked_at,
            "consistency": {"runs": RUNS, "agreeing": r["agreeing"]},
            "verifier": VERIFIER,
            "notes": f"prompts: pipeline/prompts/; audit trail: {run.relative_to(ROOT).as_posix()}",
        }

    def fact(value, rid, r) -> dict:
        p = r["passage"]
        return {"value": value, "unit": None, "uncertain": False,
                "source": {"url": p["url"], "retrieved": p["retrieved"], "via": p["contributor"]},
                "verification": {"status": "pass", "recordId": rid}}

    # Element text facts, renumbered so only passing statements remain.
    TEXT_DIR.mkdir(parents=True, exist_ok=True)
    for sym, d in drafts.items():  # empty for a concepts-only retry run
        p0 = next(p for p in src.values() if p.get("element") == sym)
        out = {"element": f"element:{sym}", "discovery": None, "uses": [], "records": []}
        story = []
        y = results.get(f"{sym}.discoveryYear")
        year = None
        if y and y["pass"]:
            value = d["discoveryYear"]["value"]
            year = fact(value, f"{sym}.discovery.year", y)
            out["records"].append(record(f"{sym}.discovery.year", f"element:{sym}", "/discovery/year", value, y))
        for i in range(len(d.get("story", []))):
            r = results.get(f"{sym}.story.{i}")
            if r and r["pass"]:
                rid = f"{sym}.discovery.story.{len(story)}"
                story.append(fact(r["claim"]["text"], rid, r))
                out["records"].append(record(rid, f"element:{sym}", f"/discovery/story/{len(story) - 1}", r["claim"]["text"], r))
        for i in range(len(d.get("uses", []))):
            r = results.get(f"{sym}.uses.{i}")
            if r and r["pass"]:
                rid = f"{sym}.uses.{len(out['uses'])}"
                out["uses"].append(fact(r["claim"]["text"], rid, r))
                out["records"].append(record(rid, f"element:{sym}", f"/uses/{len(out['uses']) - 1}", r["claim"]["text"], r))
        if story:
            out["discovery"] = {"story": story, **({"year": year} if year else {})}
        elif year:
            # The schema needs a story to hold a year; keep the year's record out too.
            out["records"] = [x for x in out["records"] if x["id"] != f"{sym}.discovery.year"]
        write_json(TEXT_DIR / f"{p0['z']:03d}-{sym}.json", out)

    # Explanation sentences.
    # Merge by id, so a retry run for some sentences keeps the others' records.
    existing = {r["id"]: r for r in load_json(CONCEPT_RECORDS)["items"]} if CONCEPT_RECORDS.exists() else {}
    for cid, r in results.items():
        if cid.startswith("concept."):
            existing.pop(cid, None)
            if r["pass"]:
                existing[cid] = record(cid, f"concept:{cid.split('.', 1)[1]}", "/text", r["claim"]["text"], r)
    write_json(CONCEPT_RECORDS, {"schemaVersion": 2, "kind": "verification-records", "items": sorted(existing.values(), key=lambda x: x["id"])})

    # Report.
    rejected = load_json(run / "rejected-before-verification.json")
    passed = sum(r["pass"] for r in results.values())
    lines = [f"# Text facts: pilot run {run.name}", "",
             f"Checked {checked_at}. Prompts: `pipeline/prompts/`. {RUNS} independent verifiers; a claim passes only with "
             f"{RUNS} of {RUNS}, each with a word-for-word excerpt.", "",
             f"- Claims verified: **{len(results)}**, passed: **{passed}**, failed: **{len(results) - passed}**",
             f"- Rejected by code before verification: **{len(rejected)}**", "",
             "## Failed verification", "", "| Claim | Text | Agreeing | Why |", "|---|---|---|---|"]
    for cid, r in results.items():
        if not r["pass"]:
            lines.append(f"| `{cid}` | {r['claim']['text']} | {r['agreeing']}/{RUNS} | {'; '.join(r['reasons']).replace('|', '/')} |")
    lines += ["", "## Rejected before verification", "", "| Claim | Why |", "|---|---|"]
    lines += [f"| `{x['id']}` | {x['reason']} |" for x in rejected] or ["| none | |"]
    lines += ["", "## Passed", ""]
    lines += [f"- `{cid}` ({r['passage']['contributor']}): {r['claim']['text']}" for cid, r in results.items() if r["pass"]]
    (run / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"{passed} of {len(results)} claims passed; report: {(run / 'report.md').relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    cmd, run_dir = sys.argv[1], Path(sys.argv[2]).resolve()
    {"claims": build_claims, "evaluate": evaluate}[cmd](run_dir)
