"""NIST Chemistry WebBook lookups, used only to break ties when PubChem's
contributors disagree about a melting or boiling point (methodology section 5).
"""

from __future__ import annotations

import html
import re
import urllib.parse
from dataclasses import dataclass

from .fetch import fetch


@dataclass(frozen=True)
class PhaseData:
    url: str  # stable WebBook page for the substance, phase-change section
    retrieved: str
    melting_k: list[float]  # Tfus, plus Ttriple (within a hair of the melting point)
    boiling_k: list[float]  # Tboil


def phase_data(name: str, refresh: bool = False) -> PhaseData | None:
    """Phase-change temperatures for an element by name, or None if the
    WebBook has no single matching substance page."""
    query = urllib.parse.urlencode({"Name": name, "Units": "SI", "cTP": "on"})
    body, retrieved = fetch(f"https://webbook.nist.gov/cgi/cbook.cgi?{query}", f"nist/{name.lower()}.html", refresh)
    page = body.decode("utf-8", errors="replace")
    ids = set(re.findall(r"ID=(C\d+)", page))
    title = re.search(r"<title>(.*?)</title>", page, re.S)
    if len(ids) != 1 or not title or html.unescape(title.group(1)).strip().lower() != name.lower():
        return None  # a search-result list or a different substance
    melting, boiling = [], []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
        if len(cells) < 3 or cells[2] != "K":
            continue
        m = re.fullmatch(r"(\d+(?:\.\d+)?)(?: ± [\d.]+)?", cells[1])
        if not m:
            continue
        if cells[0] in ("Tfus", "Ttriple"):
            melting.append(float(m.group(1)))
        elif cells[0] == "Tboil":
            boiling.append(float(m.group(1)))
    (cas,) = ids
    url = f"https://webbook.nist.gov/cgi/cbook.cgi?ID={cas}&Units=SI&Mask=4#Thermo-Phase"
    return PhaseData(url, retrieved, melting, boiling)
