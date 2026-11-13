"""The agent steps (drafting and verification) through the Claude API.

This is the reproducible path the spec requires before publishing (10.1):
anyone with an API key can re-run it from the public repo. It uses the same
prompts as the Claude Code subagent prototype (pipeline/prompts/), and the
same code checks around them (pipeline/text_facts.py).

    python -m pipeline.agents_api draft    RUN_DIR SYMBOL...  # -> drafts.json
    python -m pipeline.agents_api verify   RUN_DIR            # claims.json -> verdicts-1..3.json
    python -m pipeline.agents_api reverify RUN_DIR FROM_RUN   # re-check FROM_RUN's statements

Needs ANTHROPIC_API_KEY. Each run writes run.json with the model, prompt
version, every request id, token use and an estimated cost.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from .text_sources import OUT as SOURCES_DIR

ROOT = Path(__file__).resolve().parent.parent
PROMPTS = ROOT / "pipeline" / "prompts"
MODEL = "claude-opus-5-5"
EFFORT = "high"  # correctness matters more than cost here
RUNS = 3
WORKERS = 4
# Claude API list prices per million tokens: input, output, cache read.
PRICES = {"claude-opus-5-5": (4.00, 20.00, 0.20)}

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "verdict": {"type": "string", "enum": ["supported", "not_supported"]},
                    "excerpt": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["id", "verdict", "excerpt", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["claims"],
    "additionalProperties": False,
}

_STATEMENT = {
    "type": "object",
    "properties": {"text": {"type": "string"}, "passage": {"type": "string"}, "excerpt": {"type": "string"}},
    "required": ["text", "passage", "excerpt"],
    "additionalProperties": False,
}
DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "elements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "discoveryYear": {
                        "type": "object",
                        "properties": {
                            "kind": {"type": "string", "enum": ["year", "ancient", "none"]},
                            "year": {"type": "integer"},
                            "passage": {"type": "string"},
                            "excerpt": {"type": "string"},
                        },
                        "required": ["kind", "year", "passage", "excerpt"],
                        "additionalProperties": False,
                    },
                    "story": {"type": "array", "items": _STATEMENT},
                    "uses": {"type": "array", "items": _STATEMENT},
                },
                "required": ["symbol", "discoveryYear", "story", "uses"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["elements"],
    "additionalProperties": False,
}

DELIVERY = (
    "API delivery: you are called through the Claude API, not as an agent with files. "
    "Wherever the instructions say to write a file, return that content as your response instead, "
    "in the JSON response format given. Don't write or read any files."
)


# ---- Pure helpers (unit-tested) ------------------------------------------------


def render(template: str, **values: str) -> str:
    for k, v in values.items():
        template = template.replace("{" + k + "}", v)
    return template


def verdicts_from_response(data: dict) -> dict:
    """Array-shaped API answer -> the verdicts-N.json shape text_facts reads."""
    out = {}
    for c in data["claims"]:
        entry = {"verdict": c["verdict"]}
        if c["verdict"] == "supported":
            entry["excerpt"] = c["excerpt"]
        else:
            entry["reason"] = c["reason"] or "not supported"
        out[c["id"]] = entry
    return out


def drafts_from_response(data: dict) -> dict:
    """Array-shaped API draft -> the drafts.json shape text_facts reads."""
    out = {}
    for e in data["elements"]:
        y = e["discoveryYear"]
        year = None
        if y["kind"] == "year":
            year = {"value": y["year"], "passage": y["passage"], "excerpt": y["excerpt"]}
        elif y["kind"] == "ancient":
            year = {"value": "Ancient", "passage": y["passage"], "excerpt": y["excerpt"]}
        out[e["symbol"]] = {"discoveryYear": year, "story": e["story"], "uses": e["uses"]}
    return out


def group_claims(claims: list[dict]) -> dict[str, list[dict]]:
    """One verifier call per element (and one for the explanations)."""
    groups: dict[str, list[dict]] = {}
    for c in claims:
        key = "concept" if c["id"].startswith("concept.") else c["id"].split(".", 1)[0]
        groups.setdefault(key, []).append(c)
    return groups


def cost(usage: dict, model: str = MODEL) -> float:
    pin, pout, pcache = PRICES[model]
    return (usage["input"] * pin + usage["output"] * pout + usage["cache_read"] * pcache) / 1e6


# ---- API calls ------------------------------------------------------------------


class Caller:
    def __init__(self) -> None:
        import anthropic  # imported here so the pure helpers need no install

        self.anthropic = anthropic
        self.client = anthropic.Anthropic(max_retries=4)
        self.calls: list[dict] = []

    def json_call(self, system: str, user: str, schema: dict, label: str) -> dict | None:
        """One request. Returns the parsed JSON, or None on a refusal or a
        truncated answer (recorded, and treated as no verdict)."""
        resp = self.client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": schema}},
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        u = resp.usage
        record = {
            "label": label,
            "requestId": getattr(resp, "_request_id", None),
            "servedBy": resp.model,
            "stopReason": resp.stop_reason,
            "usage": {"input": u.input_tokens or 0, "output": u.output_tokens or 0,
                      "cache_read": getattr(u, "cache_read_input_tokens", 0) or 0},
        }
        self.calls.append(record)
        if resp.stop_reason in ("refusal", "max_tokens"):
            return None
        text = next((b.text for b in resp.content if b.type == "text"), None)
        return json.loads(text) if text else None


def sources_by_id() -> dict[str, dict]:
    return {p["id"]: p for p in json.loads((SOURCES_DIR / "sources.json").read_text("utf-8"))}


def git_sha() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except Exception:  # noqa: BLE001
        return "unknown"


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def write_run_meta(run: Path, caller: Caller, started: str, step: str) -> None:
    usage = {"input": 0, "output": 0, "cache_read": 0}
    for c in caller.calls:
        for k in usage:
            usage[k] += c["usage"][k]
    meta_path = run / "run.json"
    meta = json.loads(meta_path.read_text("utf-8")) if meta_path.exists() else {"steps": []}
    meta["verifier"] = (f"Claude API: {MODEL} (effort {EFFORT}), {RUNS} independent verifier calls per claim group; "
                        f"prompts pipeline/prompts/ at {git_sha()}")
    meta["steps"].append({
        "step": step, "startedAt": started,
        "finishedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "calls": caller.calls, "usage": usage, "estimatedCostUSD": round(cost(usage), 4),
        "servedBy": sorted({c["servedBy"] for c in caller.calls}),
        "noAnswer": [c["label"] for c in caller.calls if c["stopReason"] in ("refusal", "max_tokens")],
    })
    write_json(meta_path, meta)
    print(f"{step}: {len(caller.calls)} calls, {usage['input']} in / {usage['output']} out tokens, "
          f"about ${cost(usage):.2f}; served by {meta['steps'][-1]['servedBy']}")


# ---- Steps ------------------------------------------------------------------------


def verify(run: Path) -> None:
    started = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    claims = json.loads((run / "claims.json").read_text("utf-8"))
    src = sources_by_id()
    template = (PROMPTS / "verify_claims.md").read_text("utf-8")
    system = render(template, claims="the CLAIMS JSON in the user message",
                    sources="the SOURCES JSON in the user message", output="your response") + "\n\n" + DELIVERY
    caller = Caller()
    jobs = []
    for n in range(1, RUNS + 1):
        for key, group in group_claims(claims).items():
            passages = sorted({c["passage"] for c in group})
            user = ("CLAIMS:\n" + json.dumps(group, ensure_ascii=False) + "\n\nSOURCES:\n"
                    + json.dumps([{"id": p, "text": src[p]["text"]} for p in passages], ensure_ascii=False))
            jobs.append((n, key, user))
    results: dict[int, dict] = {n: {} for n in range(1, RUNS + 1)}

    def work(job):
        n, key, user = job
        return n, caller.json_call(system, user, VERDICT_SCHEMA, f"verify-{n}-{key}")

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for n, data in pool.map(work, jobs):
            if data:
                results[n].update(verdicts_from_response(data))
    for n in range(1, RUNS + 1):
        write_json(run / f"verdicts-{n}.json", {"claims": results[n]})
    write_run_meta(run, caller, started, "verify")


def draft(run: Path, symbols: list[str]) -> None:
    started = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    src = sources_by_id()
    template = (PROMPTS / "draft_element_text.md").read_text("utf-8")
    caller = Caller()

    def work(sym):
        passages = [p for p in src.values() if p.get("element") == sym]
        system = render(template, sources="the SOURCES JSON in the user message", elements=sym,
                        output="your response") + "\n\n" + DELIVERY
        user = "SOURCES:\n" + json.dumps([{k: p[k] for k in ("id", "element", "elementName", "heading", "contributor", "text")}
                                           for p in passages], ensure_ascii=False)
        return caller.json_call(system, user, DRAFT_SCHEMA, f"draft-{sym}")

    drafts = {}
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for data in pool.map(work, symbols):
            if data:
                drafts.update(drafts_from_response(data))
    run.mkdir(parents=True, exist_ok=True)
    write_json(run / "drafts.json", {"elements": drafts})
    write_run_meta(run, caller, started, "draft")


def reverify(run: Path, from_run: Path) -> None:
    """Re-check exactly the statements an earlier run checked: the same
    drafts and element claims, plus the explanations as they stand now."""
    run.mkdir(parents=True, exist_ok=True)
    shutil.copy(from_run / "drafts.json", run / "drafts.json")
    old = json.loads((from_run / "claims.json").read_text("utf-8"))
    concepts = json.loads((SOURCES_DIR / "claims-concepts.json").read_text("utf-8"))
    claims = [c for c in old if not c["id"].startswith("concept.")] + concepts
    write_json(run / "claims.json", claims)
    write_json(run / "rejected-before-verification.json", [])
    meta = {"steps": [], "reverifyOf": from_run.relative_to(ROOT).as_posix()}
    write_json(run / "run.json", meta)
    verify(run)


if __name__ == "__main__":
    cmd, run_dir = sys.argv[1], Path(sys.argv[2]).resolve()
    if cmd == "verify":
        verify(run_dir)
    elif cmd == "draft":
        draft(run_dir, sys.argv[3:])
    elif cmd == "reverify":
        reverify(run_dir, Path(sys.argv[3]).resolve())
    else:
        sys.exit(f"unknown command {cmd!r}")
