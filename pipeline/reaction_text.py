"""Text facts for reactions and substances: the agent step around the
staged energies (verification/methodology.md, section 14).

    python -m pipeline.reaction_text sources pilot|all|ID...   # passages and the task list
    python -m pipeline.reaction_text draft    RUN_DIR          # Claude API: drafts.json
    python -m pipeline.reaction_text claims   RUN_DIR          # code checks: claims.json
    python -m pipeline.agents_api    verify   RUN_DIR          # Claude API: 3 verifiers
    python -m pipeline.reaction_text evaluate RUN_DIR          # 3 of 3 -> facts.json, report.md

Needs data/staged/reactions.json (python -m pipeline.compounds) for the
equations, names and energies. Like the element text, the agents only draft
and judge; code checks every excerpt word for word, applies the safety
screens, and requires all three verifiers to agree. The source passages are
cached under pipeline/.cache/ (git-ignored: only short excerpts are ever
committed).
"""

from __future__ import annotations

import html
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from .fetch import CACHE, fetch
from .text_facts import RUNS, SCREEN, verbatim
from .text_sources import normalize

ROOT = Path(__file__).resolve().parent.parent
DEFINITIONS = ROOT / "data" / "reactions" / "definitions.json"
STAGED = ROOT / "data" / "staged" / "reactions.json"
OUT = CACHE / "text"
SOURCES_FILE = OUT / "reaction-sources.json"
TASKS_FILE = OUT / "reaction-tasks.json"
PROMPT = ROOT / "pipeline" / "prompts" / "draft_reaction_text.md"

PILOT = ["sodium-chlorine", "hydrogen-oxygen", "methane-oxygen", "iron-sulfur", "helium-oxygen"]

PUBCHEM_PAGE = "https://pubchem.ncbi.nlm.nih.gov/compound/{cid}"
PUBCHEM_VIEW = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON"
SUBSTANCE_HEADINGS = ("Record Description", "Physical Description", "Color/Form", "Uses")
REACTION_HEADINGS = ("Record Description", "Reactivity Profile", "Air and Water Reactions", "Chemical Dangers",
                     "Hazards Summary", "Fire Hazards")
# For products only: how they're made, which often names the reaction
# ("Obtained by direct reaction of iron and sulfur").
PRODUCT_HEADINGS = ("Methods of Manufacturing",)
MAX_PASSAGE = 3000  # characters; long CAMEO profiles are cut, and only the kept text can be cited

_LT = "https://chem.libretexts.org/Bookshelves/Introductory_Chemistry/Introductory_Chemistry_(LibreTexts)"
LIBRETEXTS = {
    "lt/ionic-bonds": f"{_LT}/10%3A_Chemical_Bonding/10.03%3A_Lewis_Structures_of_Ionic_Compounds-_Electrons_Transferred",
    "lt/covalent-bonds": f"{_LT}/10%3A_Chemical_Bonding/10.04%3A_Covalent_Lewis_Structures-_Electrons_Shared",
    "lt/energy-change": f"{_LT}/03%3A_Matter_and_Energy/3.09%3A_Energy_and_Chemical_and_Physical_Change",
    "lt/classifying-reactions": f"{_LT}/07%3A_Chemical_Reactions/7.10%3A_Classifying_Chemical_Reactions",
    "lt/activity-series": f"{_LT}/07%3A_Chemical_Reactions/7.11%3A_The_Activity_Series-_Predicting_Spontaneous_Redox_Reactions",
}

# Limits per field, and which screen applies.
REACTION_FIELDS = {"summary": 1, "bondingType": 1, "bondingWhy": 2, "trigger": 1, "hazard": 2, "whyNot": 2}
SUBSTANCE_FIELDS = {"standardState": 1, "appearance": 1, "uses": 3}
VALUE_WORDS = {"bondingType": ("ionic", "covalent"), "standardState": ("solid", "liquid", "gas")}
# Hazard notes and triggers may say a thing can explode or is poisonous (that
# is the point of them) but never how: no amounts, conditions or steps.
HAZARD_SCREEN = re.compile(
    r"\b(weapon|bomb|recipe|instruction|how to|step|mix(es|ed|ing)?\b|add(s|ed|ing)?\b|pour|heat(ed|ing)? to|"
    r"grams?|kilograms?|liters?|litres?|milli|percent|concentrat|ratio|amount|quantit|equipment)\w*",
    re.I,
)


def load_json(path: Path):
    return json.loads(path.read_text("utf-8"))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


# ---- sources ----------------------------------------------------------------------


def page_text(url: str, key: str) -> tuple[str, str]:
    """A LibreTexts page as plain text, without the site's navigation and
    metadata before the lesson and the licence notes after it."""
    body, retrieved = fetch(url, key)
    page = body.decode("utf-8", errors="replace")
    # Every LibreTexts page holds its lesson in one content container.
    start = page.find('class="mt-content-container"')
    if start < 0:
        raise ValueError(f"no lesson content found on {url}")
    page = re.sub(r"<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", page[start:], flags=re.S)
    text = normalize(html.unescape(re.sub(r"<[^>]+>", " ", page)))
    text = re.sub(r'^class="mt-content-container"[^>]*>\s*', "", text)
    ends = [i for i in (text.find("This page titled"), text.find("Contributions & Attributions"),
                        text.find("Contributors and Attributions")) if i > 0]
    return text[:min(ends) if ends else len(text)], retrieved


def pubchem_passages(key: str, cid: int, headings: tuple[str, ...]) -> list[dict]:
    body, retrieved = fetch(PUBCHEM_VIEW.format(cid=cid), f"pubchem/compound-full-{cid}.json")
    rec = json.loads(body)["Record"]
    refs = {r["ReferenceNumber"]: r.get("SourceName", "") for r in rec.get("Reference", [])}
    out: list[dict] = []

    def walk(sections):
        for s in sections:
            if s["TOCHeading"] in headings:
                for i in s.get("Information", []):
                    text = normalize(" ".join(x["String"] for x in i.get("Value", {}).get("StringWithMarkup", [])))
                    # Short fragments (EPA category lists, "Solid") can't support a sentence.
                    if len(text.split()) < 6:
                        continue
                    n = sum(1 for p in out if p["heading"] == s["TOCHeading"])
                    out.append({
                        "id": f"{key}/{s['TOCHeading']}/{n}", "substance": key, "heading": s["TOCHeading"],
                        "contributor": refs.get(i.get("ReferenceNumber"), "PubChem") or "PubChem",
                        "url": PUBCHEM_PAGE.format(cid=cid) + "#section=" + re.sub(r"[^A-Za-z0-9]+", "-", s["TOCHeading"]).strip("-"),
                        "retrieved": retrieved, "text": text[:MAX_PASSAGE],
                    })
            walk(s.get("Section", []))

    walk(rec.get("Section", []))
    return out


def select(args: list[str]) -> list[str]:
    defs = load_json(DEFINITIONS)
    every = [r["id"] for r in defs["reactions"]]
    chosen = PILOT if args == ["pilot"] else every if args in (["all"], []) else args
    unknown = [r for r in chosen if r not in every]
    if unknown:
        sys.exit(f"unknown reactions: {unknown}")
    return chosen


def build_sources(args: list[str]) -> None:
    defs = load_json(DEFINITIONS)
    staged = load_json(STAGED)
    by_id = {r["id"].split(":", 1)[1]: r for r in staged["reactions"]}
    subs = {s["key"]: s for s in staged["substances"]}
    key_of = {s["id"]: s["key"] for s in staged["substances"]}
    chosen = select(args)
    missing = [r for r in chosen if r not in by_id]
    if missing:
        sys.exit(f"not in the staged data (left out by pipeline.compounds): {missing}")

    passages: dict[str, dict] = {}
    for pid, url in LIBRETEXTS.items():
        text, retrieved = page_text(url, f"libretexts/rx-{pid.split('/')[1]}.html")
        passages[pid] = {"id": pid, "contributor": "LibreTexts Chemistry", "url": url, "retrieved": retrieved, "text": text}

    tasks = {"reactions": [], "substances": []}
    used: set[str] = set()
    for rid in chosen:
        r = by_id[rid]
        keys = ([key_of[s["substance"]] for s in r["reactants"] + r["products"]] if r["kind"] == "reaction"
                else next(d["noReaction"] for d in defs["reactions"] if d["id"] == rid))
        keys = list(dict.fromkeys(keys))
        products = {key_of[s["substance"]] for s in r.get("products", [])}
        ids = list(LIBRETEXTS)
        # Pages chosen for this reaction (definitions.json), which describe
        # the reaction itself rather than one substance.
        for n, url in enumerate(next(d for d in defs["reactions"] if d["id"] == rid).get("pages", [])):
            pid = f"lt/{rid}/{n}"
            text, retrieved = page_text(url, f"libretexts/rx-{rid}-{n}.html")
            passages[pid] = {"id": pid, "contributor": "LibreTexts Chemistry", "url": url, "retrieved": retrieved, "text": text}
            ids.append(pid)
        for k in keys:
            headings = REACTION_HEADINGS + (PRODUCT_HEADINGS if k in products else ())
            for p in pubchem_passages(k, int(subs[k]["id"].split("-")[-1]), headings):
                passages[p["id"]] = p
                ids.append(p["id"])
        energy = r.get("energy", {})
        tasks["reactions"].append({
            "id": rid, "title": r["title"], "kind": r["kind"], "equation": r.get("equation"),
            "summary": r["summary"][0]["value"],
            "substances": [{"key": k, "name": subs[k]["name"]["value"], "formula": subs[k]["formula"]["value"]} for k in keys],
            "energy": energy["direction"]["value"] if "direction" in energy else "not available",
            "passages": list(dict.fromkeys(ids)),
        })
        used.update(keys)
    for k in sorted(used):
        s = subs[k]
        fields = [f for f in SUBSTANCE_FIELDS if not (f == "standardState" and "standardState" in s)
                  and not (f == "uses" and s.get("element"))]  # an element's uses are on its own page
        ids = []
        for p in pubchem_passages(k, int(s["id"].split("-")[-1]), SUBSTANCE_HEADINGS):
            passages[p["id"]] = p
            ids.append(p["id"])
        tasks["substances"].append({"key": k, "id": s["id"], "name": s["name"]["value"], "formula": s["formula"]["value"],
                                    "fields": fields, "passages": ids})
    write_json(SOURCES_FILE, list(passages.values()))
    write_json(TASKS_FILE, tasks)
    print(f"{len(tasks['reactions'])} reactions, {len(tasks['substances'])} substances, {len(passages)} passages "
          f"({sum(len(p['text']) for p in passages.values()):,} characters) -> {SOURCES_FILE}")


# ---- draft (Claude API) ------------------------------------------------------------


def _statement(value_enum: tuple[str, ...] | None = None) -> dict:
    props = {"text": {"type": "string"}, "passage": {"type": "string"}, "excerpt": {"type": "string"}}
    if value_enum:
        props = {"value": {"type": "string", "enum": list(value_enum)}, **props}
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


def _list(item: dict) -> dict:
    return {"type": "array", "items": item}


REACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": _list(_statement()), "bondingType": _list(_statement(VALUE_WORDS["bondingType"])),
        "bondingWhy": _list(_statement()), "trigger": _list(_statement()), "hazard": _list(_statement()),
        "whyNot": _list(_statement()),
    },
    "required": list(REACTION_FIELDS),
    "additionalProperties": False,
}
SUBSTANCES_SCHEMA = {
    "type": "object",
    "properties": {"substances": _list({
        "type": "object",
        "properties": {"key": {"type": "string"}, "standardState": _list(_statement(VALUE_WORDS["standardState"])),
                       "appearance": _list(_statement()), "uses": _list(_statement())},
        "required": ["key", *SUBSTANCE_FIELDS],
        "additionalProperties": False,
    })},
    "required": ["substances"],
    "additionalProperties": False,
}
SUBSTANCES_PER_CALL = 8


def draft(run: Path) -> None:
    from . import agents_api as A

    started = now()
    tasks = load_json(TASKS_FILE)
    src = {p["id"]: p for p in load_json(SOURCES_FILE)}
    template = PROMPT.read_text("utf-8")
    system = A.render(template, task="the TASK JSON in the user message", sources="the SOURCES JSON in the user message") \
        + "\n\n" + A.DELIVERY
    caller = A.Caller()

    def sources_json(ids: list[str]) -> str:
        return json.dumps([{k: src[i][k] for k in ("id", "contributor", "text")} for i in ids], ensure_ascii=False)

    jobs = []
    for t in tasks["reactions"]:
        task = {k: t[k] for k in ("id", "title", "kind", "equation", "summary", "substances", "energy")}
        task["draft"] = "one reaction" if t["kind"] == "reaction" else "one no-reaction pair: fill whyNot only"
        jobs.append(("reaction", t["id"], "TASK:\n" + json.dumps(task, ensure_ascii=False) + "\n\nSOURCES:\n" + sources_json(t["passages"])))
    subs = tasks["substances"]
    for n in range(0, len(subs), SUBSTANCES_PER_CALL):
        chunk = subs[n:n + SUBSTANCES_PER_CALL]
        task = {"draft": "these substances; fill only the fields listed for each, and leave the others empty",
                "substances": [{k: s[k] for k in ("key", "name", "formula", "fields")} for s in chunk]}
        ids = [i for s in chunk for i in s["passages"]]
        jobs.append(("substances", f"substances-{n // SUBSTANCES_PER_CALL}",
                     "TASK:\n" + json.dumps(task, ensure_ascii=False) + "\n\nSOURCES:\n" + sources_json(ids)))

    def work(job):
        kind, label, user = job
        schema = REACTION_SCHEMA if kind == "reaction" else SUBSTANCES_SCHEMA
        return kind, label, caller.json_call(system, user, schema, f"draft-{label}")

    drafts = {"reactions": {}, "substances": {}}
    run.mkdir(parents=True, exist_ok=True)
    try:
        with ThreadPoolExecutor(max_workers=A.WORKERS) as pool:
            for kind, label, data in pool.map(work, jobs):
                if not data:
                    continue
                if kind == "reaction":
                    drafts["reactions"][label] = data
                else:
                    for s in data["substances"]:
                        drafts["substances"][s["key"]] = {f: s[f] for f in SUBSTANCE_FIELDS}
    finally:  # keep whatever was drafted, even if the run stops
        write_json(run / "drafts.json", drafts)
        A.write_run_meta(run, caller, started, "draft")
    A.stop_if_stopped(caller)


# ---- claims (code checks) -----------------------------------------------------------


def screen(field: str, text: str) -> str | None:
    """Why a statement fails the safety screen, or None if it passes."""
    pattern = HAZARD_SCREEN if field in ("hazard", "trigger") else SCREEN
    if m := pattern.search(text):
        return f"safety screen: {m.group(0)!r}"
    if re.search(r"\d", text):
        return "safety screen: no numbers here"
    if len(text.split()) > 25:
        return "longer than 25 words"
    return None


def has_word(word: str, text: str) -> bool:
    return re.search(rf"\b{word}\b", normalize(text).lower()) is not None


def build_claims(run: Path) -> None:
    tasks = load_json(TASKS_FILE)
    src = {p["id"]: p for p in load_json(SOURCES_FILE)}
    drafts = load_json(run / "drafts.json")
    claims, rejected = [], []

    def take(cid: str, field: str, item: dict, allowed: list[str], group: str) -> None:
        text = item.get("text", "").strip()
        p = src.get(item.get("passage", ""))
        if p is None or p["id"] not in allowed:
            rejected.append((cid, f"cites {item.get('passage')!r}, which isn't one of its sources"))
        elif not verbatim(item.get("excerpt"), p):
            rejected.append((cid, "drafter's excerpt isn't word for word in the passage"))
        elif why := screen(field, text):
            rejected.append((cid, why))
        elif field in VALUE_WORDS and not (item.get("value") in VALUE_WORDS[field] and has_word(item["value"], text)
                                           and has_word(item["value"], item["excerpt"])):
            rejected.append((cid, f"the sentence and its excerpt must both say {item.get('value')!r} (code check)"))
        else:
            claims.append({"id": cid, "group": group, "text": text, "passage": p["id"],
                           **({"value": item["value"]} if field in VALUE_WORDS else {})})

    for t in tasks["reactions"]:
        d = drafts["reactions"].get(t["id"])
        if not d:
            continue
        for field, limit in REACTION_FIELDS.items():
            wanted = (field == "whyNot") == (t["kind"] == "no-reaction")
            for i, item in enumerate(d.get(field, [])):
                cid = f"{t['id']}.{field}.{i}"
                if not wanted:
                    rejected.append((cid, f"{field} doesn't apply to a {t['kind']} entry"))
                elif i >= limit:
                    rejected.append((cid, f"more than {limit} {field} statement(s)"))
                else:
                    take(cid, field, item, t["passages"], t["id"])
    for s in tasks["substances"]:
        d = drafts["substances"].get(s["key"])
        if not d:
            continue
        for field, limit in SUBSTANCE_FIELDS.items():
            for i, item in enumerate(d.get(field, [])):
                cid = f"{s['key']}.{field}.{i}"
                if field not in s["fields"]:
                    rejected.append((cid, f"{field} isn't drafted for {s['key']} (it comes from code or the element page)"))
                elif i >= limit:
                    rejected.append((cid, f"more than {limit} {field} statement(s)"))
                else:
                    take(cid, field, item, s["passages"], "substances")
    write_json(run / "claims.json", claims)
    write_json(run / "rejected-before-verification.json", [{"id": c, "reason": r} for c, r in rejected])
    print(f"{len(claims)} claims for verification ({len(rejected)} rejected by code first) -> {run / 'claims.json'}")


# ---- evaluate -----------------------------------------------------------------------


def evaluate(run: Path) -> None:
    tasks = load_json(TASKS_FILE)
    src = {p["id"]: p for p in load_json(SOURCES_FILE)}
    claims = load_json(run / "claims.json")
    verdicts = [load_json(run / f"verdicts-{i}.json")["claims"] for i in range(1, RUNS + 1)]
    meta = run / "run.json"
    verifier = load_json(meta).get("verifier", "Claude API") if meta.exists() else "Claude API"
    checked_at = now()

    results = {}
    for c in claims:
        passage = src[c["passage"]]
        field = c["id"].split(".")[1]
        agreeing, excerpts, reasons = 0, [], []
        for n, v in enumerate(verdicts, 1):
            got = v.get(c["id"])
            if not got:
                reasons.append(f"verifier {n}: no verdict")
            elif got.get("verdict") != "supported":
                reasons.append(f"verifier {n}: {got.get('reason', 'not supported')}")
            elif not verbatim(got.get("excerpt"), passage):
                reasons.append(f"verifier {n}: excerpt isn't word for word in the passage")
            elif field in VALUE_WORDS and not has_word(c["value"], got["excerpt"]):
                reasons.append(f"verifier {n}: excerpt doesn't say {c['value']!r} (code check)")
            else:
                agreeing += 1
                excerpts.append(normalize(got["excerpt"]))
        results[c["id"]] = {"claim": c, "passage": passage, "agreeing": agreeing, "reasons": reasons,
                            "excerpt": excerpts[0] if excerpts else None, "pass": agreeing == RUNS}

    records: list[dict] = []

    def fact(entity: str, field_path: str, value: str, r: dict) -> dict:
        rid = f"{entity.split(':', 1)[1]}{field_path.replace('/', '.')}"
        p = r["passage"]
        records.append({
            "id": rid, "subject": {"entity": entity, "field": field_path}, "method": "agent",
            "claimedValue": value, "unit": None, "sourceUrl": p["url"], "upstream": p["contributor"],
            "retrievedValue": r["excerpt"], "evidence": r["excerpt"], "result": "pass", "checkedAt": checked_at,
            "consistency": {"runs": RUNS, "agreeing": r["agreeing"]}, "verifier": verifier,
            "notes": f"prompts: pipeline/prompts/; audit trail: {run.relative_to(ROOT).as_posix()}",
        })
        return {"value": value, "unit": None, "uncertain": False,
                "source": {"url": p["url"], "retrieved": p["retrieved"], "via": p["contributor"]},
                "verification": {"status": "pass", "recordId": rid}}

    def passing(prefix: str, field: str) -> list[dict]:
        out, i = [], 0
        while (r := results.get(f"{prefix}.{field}.{i}")) or i < 3:
            if r and r["pass"]:
                out.append(r)
            i += 1
        return out

    facts = {"reactions": {}, "substances": {}}
    for t in tasks["reactions"]:
        e, rx = f"reaction:{t['id']}", {}
        # /summary/0 is written by code (pipeline.compounds); agent statements follow it.
        rx["summary"] = [fact(e, f"/summary/{n}", r["claim"]["text"], r) for n, r in enumerate(passing(t["id"], "summary"), start=1)]
        if t["kind"] == "no-reaction":
            rx["whyNot"] = [fact(e, f"/whyNot/{n}", r["claim"]["text"], r) for n, r in enumerate(passing(t["id"], "whyNot"))]
        else:
            bt, why = passing(t["id"], "bondingType"), passing(t["id"], "bondingWhy")
            if bt and why:  # the schema needs both
                rx["bonding"] = {"type": fact(e, "/bonding/type", bt[0]["claim"]["value"], bt[0]),
                                 "typeSentence": bt[0]["claim"]["text"],
                                 "why": [fact(e, f"/bonding/why/{n}", r["claim"]["text"], r) for n, r in enumerate(why)]}
            if tr := passing(t["id"], "trigger"):
                rx["trigger"] = fact(e, "/energy/trigger", tr[0]["claim"]["text"], tr[0])
            if hz := passing(t["id"], "hazard"):
                rx["hazard"] = {"why": [fact(e, f"/hazard/why/{n}", r["claim"]["text"], r) for n, r in enumerate(hz)]}
        facts["reactions"][e] = rx
    for s in tasks["substances"]:
        e, out = s["id"], {}
        if st := passing(s["key"], "standardState"):
            out["standardState"] = fact(e, "/standardState", st[0]["claim"]["value"], st[0])
        if ap := passing(s["key"], "appearance"):
            out["appearance"] = fact(e, "/appearance", ap[0]["claim"]["text"], ap[0])
        out["uses"] = [fact(e, f"/uses/{n}", r["claim"]["text"], r) for n, r in enumerate(passing(s["key"], "uses"))]
        facts["substances"][e] = out
    facts["records"] = records
    write_json(run / "facts.json", facts)
    write_report(run, tasks, results, checked_at)


def write_report(run: Path, tasks: dict, results: dict, checked_at: str) -> None:
    rejected = load_json(run / "rejected-before-verification.json")
    rejected_by_id = {x["id"]: x["reason"] for x in rejected}
    passed = sum(r["pass"] for r in results.values())
    lines = [f"# Reaction text: {run.name}", "",
             f"Checked {checked_at}. Drafted and verified through the Claude API (prompts in `pipeline/prompts/`). "
             f"{RUNS} independent verifiers; a statement passes only with {RUNS} of {RUNS}, each with a word-for-word excerpt.", "",
             f"- Statements verified: **{len(results)}**, passed: **{passed}**, failed: **{len(results) - passed}**",
             f"- Rejected by code before verification: **{len(rejected)}**", "",
             "Legend: ✅ passed, ❌ failed verification, ⛔ rejected by code before verification.", ""]

    def rows(prefix: str, fields) -> list[str]:
        out = []
        for field in fields:
            i = 0
            while True:
                cid = f"{prefix}.{field}.{i}"
                if cid in results:
                    r = results[cid]
                    label = f"{field} ({r['claim']['value']})" if "value" in r["claim"] else field
                    mark = "✅" if r["pass"] else "❌"
                    why = "" if r["pass"] else " — " + "; ".join(r["reasons"])
                    out.append(f"- {mark} **{label}:** {r['claim']['text']} *({r['passage']['contributor']})*{why}")
                elif cid in rejected_by_id:
                    out.append(f"- ⛔ **{field}:** {rejected_by_id[cid]}")
                elif i >= 3:
                    break
                i += 1
        return out or ["- (nothing drafted)"]

    for t in tasks["reactions"]:
        lines += [f"## {t['title']}", ""]
        if t["equation"]:
            lines += [f"`{t['equation']}` · energy: {t['energy']}", ""]
        lines += [f"- 🔧 **summary (written by code):** {t['summary']}"]
        lines += rows(t["id"], REACTION_FIELDS) + [""]
    lines += ["## Substances", ""]
    for s in tasks["substances"]:
        lines += [f"### {s['name']} ({s['formula']})", ""] + rows(s["key"], SUBSTANCE_FIELDS) + [""]
    (run / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"{passed} of {len(results)} statements passed; report: {(run / 'report.md').relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "sources":
        build_sources(sys.argv[2:])
    elif cmd in ("draft", "claims", "evaluate") and len(sys.argv) == 3:
        {"draft": draft, "claims": build_claims, "evaluate": evaluate}[cmd](Path(sys.argv[2]).resolve())
    else:
        sys.exit(__doc__)
