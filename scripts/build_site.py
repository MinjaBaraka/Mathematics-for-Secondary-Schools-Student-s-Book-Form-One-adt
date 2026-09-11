#!/usr/bin/env python3
"""Prepare GitHub Pages with identical audio shared, without changing the source."""

import hashlib
import json
from pathlib import Path
import re
import shutil


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"
IGNORE = shutil.ignore_patterns(
    ".DS_Store", "._*", "__MACOSX", ".cache", "__pycache__",
    "*.tmp", "*.temp", "*.swp", "*.swo", "*~",
)


def main():
    # Only this generated directory is replaced; the original bundle stays intact.
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    for directory in ("assets", "content", "images"):
        shutil.copytree(ROOT / directory, OUTPUT / directory, ignore=IGNORE)
    for source in sorted(ROOT.glob("*.html")):
        shutil.copy2(source, OUTPUT / source.name)
    for name in ("cover.png", "imsmanifest.xml"):
        shutil.copy2(ROOT / name, OUTPUT / name)
    (OUTPUT / ".nojekyll").touch()

    preloader_path = OUTPUT / "assets/offline-preloader.js"
    preloader = preloader_path.read_text(encoding="utf-8")
    match = re.search(r"var INLINE\s*=\s*", preloader)
    if not match:
        raise ValueError("Offline preloader's embedded resources were not found")
    inline, end = json.JSONDecoder().raw_decode(preloader[match.end():])

    removed_count = saved_bytes = 0
    for mapping_path in sorted((OUTPUT / "content/i18n").glob("*/audios.json")):
        mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
        resource_key = "./" + mapping_path.relative_to(OUTPUT).as_posix()
        if inline.get(resource_key) != mapping:
            raise ValueError(f"Embedded and standalone audio mappings differ: {resource_key}")
        audio_dir = mapping_path.parent / "audio"
        canonical = {}
        replacements = {}
        for filename in sorted(set(mapping.values())):
            source = audio_dir / filename
            digest = hashlib.sha256(source.read_bytes()).digest()
            if digest in canonical:
                target = audio_dir / canonical[digest]
                # Confirm byte equality before removing a deployment copy.
                if source.read_bytes() != target.read_bytes():
                    raise ValueError(f"Audio digest collision: {filename}")
                replacements[filename] = target.name
                saved_bytes += source.stat().st_size
                removed_count += 1
                source.unlink()
            else:
                canonical[digest] = filename
        mapping = {key: replacements.get(value, value) for key, value in mapping.items()}
        for filename in mapping.values():
            if not (audio_dir / filename).is_file():
                raise ValueError(f"Missing published audio: {filename}")
        mapping_path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        inline[resource_key] = mapping

    # Regenerate only embedded data; preserve the preloader's executable code.
    preloader_path.write_text(
        preloader[:match.end()]
        + json.dumps(inline, ensure_ascii=False, separators=(",", ":"))
        + preloader[match.end() + end:],
        encoding="utf-8",
    )
    size = sum(p.stat().st_size for p in OUTPUT.rglob("*") if p.is_file())
    if size >= 1_000_000_000:
        raise ValueError(f"Published site exceeds the 1 GB budget: {size:,} bytes")
    print(f"Shared {removed_count:,} duplicate audio files; saved {saved_bytes:,} bytes.")
    print(f"GitHub Pages output: {size:,} bytes in {OUTPUT}")


if __name__ == "__main__":
    main()
