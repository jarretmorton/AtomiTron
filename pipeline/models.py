"""Molecule models and pictures from PubChem, for the bond visuals.

    python -m pipeline.models

For each listed compound, PubChem's computed 3D conformer and its 2D
layout (atoms, coordinates and bond orders) go to data/models/cid-<CID>.json,
with the source URL and retrieval date. These are computed models, not
measurements, and the app labels them so. PubChem's 2D structure picture
goes to app/public/media/pubchem-cid-<CID>.png.
"""

from __future__ import annotations

import json
from pathlib import Path

from .fetch import fetch

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "models"
MEDIA = ROOT / "app" / "public" / "media"
RECORD = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/record/JSON?record_type={kind}"
PNG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/PNG"
PAGE = "https://pubchem.ncbi.nlm.nih.gov/compound/{cid}"

# Preview set: water, methane and ammonia (3D), carbon dioxide (2D bonds),
# glucose (PubChem's drawing).
MODELS = {962: ("3d", "2d"), 297: ("3d", "2d"), 222: ("3d", "2d"), 280: ("3d", "2d")}
PICTURES = [5793]

SYMBOLS = {1: "H", 6: "C", 7: "N", 8: "O", 16: "S", 17: "Cl", 35: "Br"}


def read(cid: int, kind: str) -> tuple[dict, str]:
    body, retrieved = fetch(RECORD.format(cid=cid, kind=kind), f"pubchem/record-{kind}-{cid}.json")
    rec = json.loads(body)["PC_Compounds"][0]
    atoms = [SYMBOLS[z] for z in rec["atoms"]["element"]]
    conf = rec["coords"][0]["conformers"][0]
    coords = list(zip(conf["x"], conf["y"], conf.get("z", [0.0] * len(atoms))))
    b = rec.get("bonds", {"aid1": [], "aid2": [], "order": []})
    bonds = [{"a": a - 1, "b": c - 1, "order": o} for a, c, o in zip(b["aid1"], b["aid2"], b["order"])]
    return {"atoms": [{"symbol": s, "x": x, "y": y, "z": z} for s, (x, y, z) in zip(atoms, coords)], "bonds": bonds}, retrieved


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    MEDIA.mkdir(parents=True, exist_ok=True)
    for cid, kinds in MODELS.items():
        out = {"cid": cid, "source": {"url": PAGE.format(cid=cid) + "#section=3D-Conformer", "via": "PubChem"},
               "note": "Computed by PubChem: a model, not a measurement."}
        for kind in kinds:
            model, retrieved = read(cid, kind)
            out[kind] = model
            out["source"]["retrieved"] = retrieved
        (OUT / f"cid-{cid}.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8", newline="\n")
    for cid in PICTURES:
        body, _ = fetch(PNG.format(cid=cid), f"pubchem/png-{cid}.png")
        (MEDIA / f"pubchem-cid-{cid}.png").write_bytes(body)
    print(f"{len(MODELS)} models -> {OUT.relative_to(ROOT)}, {len(PICTURES)} picture(s) -> {MEDIA.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
