"""Printable worksheet for a spot review, from its drawn sample.

    python -m pipeline.spot_worksheet checkpoint-1

Writes verification/spot-reviews/<name>-worksheet.html, laid out for paper.
Print it from a browser, or render a PDF with any headless browser. Items
are numbered as in the sample, so answers can be typed into the review sheet
in the same order.

The reviewer checks each fact in the app itself: every value sits on an
element page beside a tappable source button, so the worksheet names the page
and section rather than printing long URLs. Verifier excerpts are left off
on purpose, so the check stays independent.
"""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "verification" / "spot-reviews"

KIND = {
    "agent": "Sentence",
    "derived": "Worked out",
    "tiebreak": "Measured (sources disagreed)",
    "uncertain": "Prediction",
    "single": "Measured (one source)",
    "other": "Measured",
}


def where(record_id: str, element: str) -> str:
    """Which part of the element page holds the fact."""
    field = record_id.split(".", 1)[1]
    if field.startswith("atom."):
        return "The atom"
    if field.startswith(("discovery.", "uses.")):
        return "Discovery and uses"
    if field.startswith("isotopes."):
        return "the isotope cards near the bottom"
    if field in ("meltingPoint", "boilingPoint", "density", "state"):
        return "Physical properties"
    if field == "classification":
        return "under the element's name, at the top"
    return "The numbers"


def check_text(it: dict) -> str:
    if it["method"] == "agent":
        return ("Tap the source button next to this sentence. Read the PubChem section it opens. "
                "Does the passage say everything this sentence says?")
    if it["method"] == "derive":
        parts = [f"{i['what'].lower()} {i['value']}" for i in it["inputs"]]
        rule = {
            "neutrons-from-mass-number": "Neutrons = mass number − atomic number.",
            "shells-from-configuration": "Add up the electrons in each shell from the configuration (the big number in each part is the shell).",
            "valence-main-group": "Count the s and p electrons in the outermost shell.",
        }.get(it["rule"], "")
        return (f"This is worked out from: {'; '.join(parts)}. Check those on their own sources "
                f"(in the app), then check the working. {rule}")
    return ("Tap the source button next to it and find the same value on the source page. "
            "The app may show fewer digits than the source, never more.")


def card(it: dict) -> str:
    e = html.escape
    flags = " · predicted" if it["uncertain"] else ""
    return f"""
<section class="item">
  <div class="top">
    <span class="n">{it['n']}</span>
    <span class="el"><b>{e(it['element'])}</b> ({e(it['symbol'])})</span>
    <span class="kind">{e(KIND.get(it['category'], it['category']))}{flags}</span>
  </div>
  <p class="where">Element page → <b>{e(where(it['recordId'], it['element']))}</b> → {e(it['field'])}</p>
  <p class="shown">{e(it['shown'])}</p>
  <p class="how">{e(check_text(it))}</p>
  <div class="answer">
    <span class="box"></span> Matches
    <span class="box"></span> Doesn't match
    <span class="box"></span> Can't tell
  </div>
  <div class="notes"><span>Notes</span></div>
</section>"""


def main(name: str) -> None:
    sample = json.loads((DIR / f"{name}-sample.json").read_text("utf-8"))
    items = "\n".join(card(it) for it in sample["items"])
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AtomiTron {html.escape(name)} worksheet</title>
<style>
  @page {{ size: letter; margin: 14mm 14mm 16mm; }}
  body {{ font: 11pt/1.4 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a1d21; margin: 0; }}
  h1 {{ font-size: 17pt; margin: 0 0 4px; }}
  .meta {{ display: flex; gap: 32px; margin: 8px 0 12px; }}
  .meta span {{ flex: 1; border-bottom: 1px solid #1a1d21; padding-bottom: 2px; }}
  .intro {{ border: 1px solid #b9bdb6; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; }}
  .intro p, .intro ol {{ margin: 4px 0; }}
  .intro ol {{ padding-left: 20px; }}
  .item {{ border: 1px solid #b9bdb6; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; break-inside: avoid; }}
  .top {{ display: flex; align-items: baseline; gap: 10px; }}
  .n {{ display: inline-grid; place-items: center; min-width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid #1a1d21; font-weight: 700; font-size: 10pt; }}
  .el {{ font-size: 12pt; }}
  .kind {{ margin-left: auto; font-size: 9pt; text-transform: uppercase; letter-spacing: .05em; color: #535a62; }}
  .where {{ margin: 4px 0 2px; color: #535a62; }}
  .shown {{ margin: 2px 0; font-size: 12.5pt; font-weight: 600; }}
  .how {{ margin: 2px 0 6px; font-size: 10pt; }}
  .answer {{ display: flex; align-items: center; gap: 6px; font-size: 10.5pt; }}
  .box {{ display: inline-block; width: 13px; height: 13px; border: 1.5px solid #1a1d21; margin-left: 14px; }}
  .box:first-child {{ margin-left: 0; }}
  .notes {{ margin-top: 6px; height: 34px; border-bottom: 1px solid #b9bdb6; font-size: 9pt; color: #535a62; }}
</style>
</head>
<body>
<h1>AtomiTron fact check: {html.escape(name.replace('-', ' '))}</h1>
<div class="meta"><span>Checked by</span><span>Date</span></div>
<div class="intro">
  <p>These {len(sample['items'])} facts were picked at random from AtomiTron. Your job is to check each one against its source, the way a scientist checks a reference.</p>
  <ol>
    <li>Open AtomiTron on the iPad and go to the element. Find the fact in the section named on the card. It should match what's printed here.</li>
    <li>Tap the source button next to it. If the page opens at the top, scroll to the section with the same name.</li>
    <li>Tick one box. <b>Matches</b> if the source says the same thing. <b>Doesn't match</b> if it says something different. <b>Can't tell</b> if you can't find it or aren't sure: that's a perfectly good answer.</li>
    <li>Write anything you noticed in the notes.</li>
  </ol>
</div>
{items}
</body>
</html>
"""
    out = DIR / f"{name}-worksheet.html"
    out.write_text(page, encoding="utf-8", newline="\n")
    print(f"{len(sample['items'])} items -> {out.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main(sys.argv[1])
