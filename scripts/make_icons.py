"""Generate the app icons from one geometry, so the vector and rasters can't diverge.

Writes app/public/icon.svg (the master, also the header mark),
app/public/favicon-32.png and app/public/apple-touch-icon.png (180x180,
because iOS ignores SVG icons for Add to Home Screen).

The mark is a Bohr-model carbon atom: nucleus, two shells, and 2 + 4
electrons, on the header's ink tile. The colors are Okabe-Ito orange
(nucleus) and sky blue (electrons), which stay distinct under the common
color-vision deficiencies.

Usage: python scripts/make_icons.py   (needs Pillow)
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "app" / "public"

TILE = "#14171b"      # --header
RING = "#8b939c"
NUCLEUS = "#e69f00"   # Okabe-Ito orange
ELECTRON = "#56b4e9"  # Okabe-Ito sky blue

# Geometry in a 100x100 viewBox.
C = 50.0
NUCLEUS_R = 10.0
SHELLS = [  # (radius, electron angles in degrees, 0 = right, clockwise)
    (23.0, [-60, 120]),
    (38.0, [-15, 75, 165, 255]),
]
RING_W = 3.5
ELECTRON_R = 5.5


def electrons():
    for r, angles in SHELLS:
        for a in angles:
            t = math.radians(a)
            yield C + r * math.cos(t), C + r * math.sin(t)


def svg() -> str:
    f = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")
    parts = [f'<rect width="100" height="100" fill="{TILE}"/>']
    parts += [
        f'<circle cx="50" cy="50" r="{f(r)}" fill="none" stroke="{RING}" stroke-width="{f(RING_W)}"/>'
        for r, _ in SHELLS
    ]
    parts.append(f'<circle cx="50" cy="50" r="{f(NUCLEUS_R)}" fill="{NUCLEUS}"/>')
    parts += [
        f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(ELECTRON_R)}" fill="{ELECTRON}"/>'
        for x, y in electrons()
    ]
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + "".join(parts) + "</svg>\n"


def png(size: int, path: Path) -> None:
    ss = 8  # supersample, then downscale for clean anti-aliasing
    s = size * ss / 100
    img = Image.new("RGB", (size * ss, size * ss), TILE)
    d = ImageDraw.Draw(img)

    def circle(cx, cy, r, fill=None, outline=None, width=0):
        d.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s],
                  fill=fill, outline=outline, width=round(width * s))

    for r, _ in SHELLS:  # PIL draws the outline inward, so offset by half the stroke
        circle(C, C, r + RING_W / 2, outline=RING, width=RING_W)
    circle(C, C, NUCLEUS_R, fill=NUCLEUS)
    for x, y in electrons():
        circle(x, y, ELECTRON_R, fill=ELECTRON)
    img.resize((size, size), Image.LANCZOS).save(path, optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "icon.svg").write_text(svg(), encoding="utf-8", newline="\n")
    png(32, OUT / "favicon-32.png")
    png(180, OUT / "apple-touch-icon.png")
    print("wrote", ", ".join(p.name for p in sorted(OUT.iterdir())))
