# Mathematics for Secondary Schools Student’s Book Form One

Accessible Digital Textbook published by the Tanzania Institute of Education.
This repository contains the ready-to-read English bundle, including 212 pages,
illustrations, a glossary, easy-read text, and read-aloud audio.

[Read the textbook online](https://minjabaraka.github.io/Mathematics-for-Secondary-Schools-Student-s-Book-Form-One-adt/)

## Local reading

The reader files are at the repository root. Open `index.html`, or serve this
directory with `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Publishing

Pushing to `main` runs `.github/workflows/pages.yml` and publishes the textbook
to GitHub Pages. The repository's Pages source must be set to **GitHub Actions**.

Run `python3 scripts/build_site.py` to prepare the same site locally in `_site/`.
The build shares byte-for-byte identical audio files and updates both audio
mappings and the offline preloader's embedded mappings. It preserves all text IDs,
recording quality, and the original source bundle while keeping the published
site below GitHub Pages' 1 GB limit. The generated `_site/` directory is ignored
by Git and can be removed after previewing.

macOS metadata, caches, and temporary files are excluded by `.gitignore`.
