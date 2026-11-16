"""Molecule models and drawings from PubChem, for the bond visuals.

    python -m pipeline.models

For every compound in the published reaction set (data/verified/
compounds.json) that isn't a pure element:
- PubChem's computed 3D conformer (atoms, coordinates and bond orders)
  goes to data/models/cid-<CID>.json, with the source URL and retrieval
  date. PubChem only has these for molecules: salts and metal oxides have
  none, and get none here. They are computed models, not measurements, and
  the app labels them so.
- PubChem's 2D structure drawing goes to app/public/media/pubchem-cid-<CID>.png,
  cropped to the drawing (PubChem draws small molecules small, in a lot of
  white space). Needs Pillow.
"""

from __future__ import annotations

import io
import json
from pathlib import Path

from .fetch import fetch

ROOT = Path(__file__).resolve().parent.parent
COMPOUNDS = ROOT / "data" / "verified" / "compounds.json"
OUT = ROOT / "data" / "models"
MEDIA = ROOT / "app" / "public" / "media"
RECORD = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/record/JSON?record_type=3d"
PNG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/PNG?image_size=600x600"
PAGE = "https://pubchem.ncbi.nlm.nih.gov/compound/{cid}"

SYMBOLS = {1: "H", 6: "C", 7: "N", 8: "O", 16: "S", 17: "Cl", 35: "Br"}


def compound_cids() -> list[int]:
    items = json.loads(COMPOUNDS.read_text("utf-8"))["items"]
    return [int(c["id"].split("-")[-1]) for c in items if "element" not in c]


def model(cid: int) -> dict | None:
    """PubChem's 3D conformer, or None if it has none."""
    try:
        body, retrieved = fetch(RECORD.format(cid=cid), f"pubchem/record-3d-{cid}.json")
    except Exception:  # noqa: BLE001  404: no conformer for this compound
        return None
    rec = json.loads(body)["PC_Compounds"][0]
    conf = rec["coords"][0]["conformers"][0]
    b = rec.get("bonds", {"aid1": [], "aid2": [], "order": []})
    return {
        "cid": cid,
        "source": {"url": PAGE.format(cid=cid) + "#section=3D-Conformer", "via": "PubChem", "retrieved": retrieved},
        "note": "Computed by PubChem: a model, not a measurement.",
        "3d": {
            "atoms": [{"symbol": SYMBOLS[z], "x": x, "y": y, "z": zz}
                      for z, x, y, zz in zip(rec["atoms"]["element"], conf["x"], conf["y"], conf["z"])],
            "bonds": [{"a": a - 1, "b": c - 1, "order": o} for a, c, o in zip(b["aid1"], b["aid2"], b["order"])],
        },
    }


def cropped(png: bytes, margin: int = 12) -> bytes:
    """The drawing without its empty border. Nothing in it changes."""
    from PIL import Image, ImageChops

    im = Image.open(io.BytesIO(png)).convert("RGB")
    # The corner is background (PubChem's is a light grey, not white).
    box = ImageChops.difference(im, Image.new("RGB", im.size, im.getpixel((0, 0)))).getbbox()
    if box:
        l, t, r, b = box
        im = im.crop((max(0, l - margin), max(0, t - margin), min(im.width, r + margin), min(im.height, b + margin)))
    out = io.BytesIO()
    im.save(out, "PNG", optimize=True)
    return out.getvalue()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    MEDIA.mkdir(parents=True, exist_ok=True)
    cids = compound_cids()
    made = 0
    for cid in cids:
        m = model(cid)
        if m:
            (OUT / f"cid-{cid}.json").write_text(json.dumps(m, indent=1) + "\n", encoding="utf-8", newline="\n")
            made += 1
        body, _ = fetch(PNG.format(cid=cid), f"pubchem/png600-{cid}.png")
        (MEDIA / f"pubchem-cid-{cid}.png").write_bytes(cropped(body))
    print(f"{made} 3D models -> {OUT.relative_to(ROOT).as_posix()}, {len(cids)} drawings -> {MEDIA.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
