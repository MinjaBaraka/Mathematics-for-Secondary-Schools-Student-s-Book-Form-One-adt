#!/usr/bin/env python3
"""Refresh the offline reader and remove the retired global math toolbar."""

import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

# Support reformatted tags and cached URLs in older copies of the export.
LEGACY_KEYBOARD_SCRIPT = re.compile(
    r"[ \t]*<script\b(?=[^>]*\bsrc\s*=\s*(['\"])(?:\./)?assets/"
    r"(?:mathlive/mathlive\.min|math-keyboard)\.js(?:\?[^'\"]*)?\1)"
    r"[^>]*>\s*</script>[ \t]*(?:\r?\n)?",
    re.IGNORECASE,
)


def refresh_embedded_resources(destination):
    cleaned = 0
    for page in sorted(destination.glob("*.html")):
        original = page.read_text(encoding="utf-8")
        updated = LEGACY_KEYBOARD_SCRIPT.sub("", original)
        if updated != original:
            page.write_text(updated, encoding="utf-8")
            cleaned += 1

    path = destination / "assets/offline-preloader.js"
    preloader = path.read_text(encoding="utf-8")
    match = re.search(r"var INLINE\s*=\s*", preloader)
    if not match:
        raise ValueError("Offline preloader's embedded resources were not found")
    inline, end = json.JSONDecoder().raw_decode(preloader[match.end():])
    for resource in inline:
        if resource.endswith(".html"):
            inline[resource] = (destination / resource).read_text(encoding="utf-8")
        elif resource.endswith(".json") and (destination / resource).is_file():
            inline[resource] = json.loads((destination / resource).read_text(encoding="utf-8"))
    path.write_text(
        preloader[:match.end()]
        + json.dumps(inline, ensure_ascii=False, separators=(",", ":"))
        + preloader[match.end() + end:],
        encoding="utf-8",
    )
    return cleaned


if __name__ == "__main__":
    cleaned = refresh_embedded_resources(ROOT)
    print(f"Removed retired keyboard scripts from {cleaned} pages; refreshed embedded resources.")
