"""Collect the source passages that text facts are drafted and verified from.

    python -m pipeline.text_sources H C N O Na Mg Cl Fe Cu Au

Writes pipeline/.cache/text/sources.json (git-ignored: these are the
contributors' own words, so only short excerpts are ever committed) and
pipeline/.cache/text/claims-concepts.json, the explanation sentences from
app/src/content/concepts.ts that need verifying.

Each passage has a stable id, its citation URL and contributor:
  "Na/History/Jefferson Lab" -> https://pubchem.ncbi.nlm.nih.gov/element/11#section=History
  "concept/protons"         -> the LibreTexts page an explanation cites
"""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

from .elements import PAGE, anchor, load, read_sections
from .fetch import CACHE, fetch

ROOT = Path(__file__).resolve().parent.parent
OUT = CACHE / "text"
HEADINGS = ("History", "Uses")


def normalize(text: str) -> str:
    """Whitespace and quote normalization used for every verbatim check."""
    text = text.replace("​", "").replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", text).strip()


def element_passages(symbols: list[str]) -> list[dict]:
    passages = []
    for z in range(1, 119):
        record, retrieved = load(z, refresh=False)
        sections = read_sections(record)
        symbol = next((i.text for i in sections.get("Element Symbol", []) if i.contributor == "PubChem"), None)
        if symbol not in symbols:
            continue
        name = next(i.text for i in sections["Element Name"] if i.contributor == "PubChem")
        for heading in HEADINGS:
            for info in sections.get(heading, []):
                if not info.text.strip():
                    continue
                passages.append({
                    "id": f"{symbol}/{heading}/{info.contributor}",
                    "element": symbol,
                    "elementName": name,
                    "z": z,
                    "heading": heading,
                    "contributor": info.contributor,
                    "url": PAGE.format(z=z) + anchor(heading),
                    "retrieved": retrieved,
                    "text": normalize(info.text),
                })
    return passages


def concept_claims() -> tuple[list[dict], list[dict]]:
    """Parse concepts.ts for (key, text, url), fetch each page as plain text."""
    src = (ROOT / "app" / "src" / "content" / "concepts.ts").read_text("utf-8")
    consts = dict(re.findall(r"const (\w+) = `\$\{LT\}(/[^`]+)`;", src))
    lt = re.search(r"const LT = '([^']+)'", src).group(1)
    claims, passages, seen = [], [], {}
    # text: '...' or text: "..." (double quotes when the sentence has an apostrophe)
    entries = re.findall(r"(\w+): \{\s*text: (?:'([^']+)'|\"([^\"]+)\"),\s*url: (\w+),", src)
    for key, text, ref in ((k, single or double, r) for k, single, double, r in entries):
        url = lt + consts[ref]
        if url not in seen:
            body, retrieved = fetch(url, f"libretexts/{ref.lower()}.html")
            page = body.decode("utf-8", errors="replace")
            page = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", page, flags=re.S)
            page = re.sub(r"<[^>]+>", " ", page)
            seen[url] = f"concept/{ref.lower()}"
            passages.append({"id": seen[url], "url": url, "contributor": "LibreTexts Chemistry",
                             "retrieved": retrieved, "text": normalize(html.unescape(page))})
        claims.append({"id": f"concept.{key}", "text": text.replace("\\'", "'"), "passage": seen[url]})
    return claims, passages


def resolve_symbols(argv: list[str]) -> list[str]:
    """Symbols as given, or "remaining": every verified element that has no
    history and uses text yet (no data/text/elements file)."""
    if argv != ["remaining"]:
        return argv or ["H", "C", "N", "O", "Na", "Mg", "Cl", "Fe", "Cu", "Au"]
    done = {p.stem.split("-", 1)[1] for p in (ROOT / "data" / "text" / "elements").glob("*.json")}
    every = [p.stem.split("-", 1)[1] for p in sorted((ROOT / "data" / "verified" / "elements").glob("*.json"))]
    return [s for s in every if s not in done]


def main(argv: list[str]) -> None:
    symbols = resolve_symbols(argv)
    passages = element_passages(symbols)
    claims, concept_passages = concept_claims()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "sources.json").write_text(json.dumps(passages + concept_passages, indent=1, ensure_ascii=False), "utf-8")
    (OUT / "claims-concepts.json").write_text(json.dumps(claims, indent=1, ensure_ascii=False), "utf-8")
    print(f"{len(passages)} element passages for {len({p['element'] for p in passages})} elements, "
          f"{len(claims)} concept claims over {len(concept_passages)} LibreTexts pages -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1:])
