"""Polite, cached HTTP fetching for the pipeline.

Downloads are kept in pipeline/.cache/ (git-ignored) beside a small metadata
file recording when each was retrieved. That date becomes each fact's
`source.retrieved`. Pass refresh=True to fetch again.
"""

from __future__ import annotations

import json
import time
import urllib.request
from datetime import date
from pathlib import Path

CACHE = Path(__file__).resolve().parent / ".cache"
USER_AGENT = "AtomiTron-pipeline (+https://github.com/jarretmorton/AtomiTron)"
_last_request = 0.0


def fetch(url: str, key: str, refresh: bool = False, min_interval: float = 0.3) -> tuple[bytes, str]:
    """Returns (body, retrieved date as YYYY-MM-DD)."""
    global _last_request
    body_path = CACHE / key
    meta_path = body_path.with_name(body_path.name + ".meta.json")
    if not refresh and body_path.exists() and meta_path.exists():
        return body_path.read_bytes(), json.loads(meta_path.read_text("utf-8"))["retrieved"]

    wait = min_interval - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)  # stay well under PubChem's 5 requests/second
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
    _last_request = time.monotonic()

    body_path.parent.mkdir(parents=True, exist_ok=True)
    body_path.write_bytes(body)
    retrieved = date.today().isoformat()
    meta_path.write_text(json.dumps({"url": url, "retrieved": retrieved}), "utf-8")
    return body, retrieved
