# Mathematics for Secondary Schools Student’s Book Form One

Accessible Digital Textbook published by the Tanzania Institute of Education.
This repository contains the ready-to-read English bundle, including 212 pages,
illustrations, a glossary, easy-read text, and read-aloud audio.

[Read the textbook online](https://minjabaraka.github.io/Mathematics-for-Secondary-Schools-Student-s-Book-Form-One-adt/)

## Local reading

The reader files are at the repository root. Open `index.html`, or serve this
directory with `python3 -m http.server 8000` and visit `http://localhost:8000`.

Activities, exercises and projects use live text and editable answer boxes.
All 1,431 response fields save on the current device. The 137 worked examples
and the answer key are read-only text and mathematical notation. Required
graphs and diagrams remain illustrations; screenshots of instructions,
questions and solutions have been replaced with live content. The global math
toolbar has been removed from the textbook.

After editing page content or localization, run
`python3 scripts/refresh_embedded_resources.py` to update the offline preloader.
The publishing build performs the same step and strips retired keyboard script
tags from older page copies. The reviewed standalone `math-keyboard.js` remains
separate from the exported reader.

Run `python3 -B scripts/audit_learning_content.py` to validate all 212 pages.
The source-checked inventory in `scripts/learning-content-audit.json` records
learning headings, response keys, retired panel images and source diagram
crops. The publishing build runs this check before and after export, including
checks for accessible field labels and read-aloud recordings for restored text.
Edit `assets/learning-content.css` for the live learning panels, and
`assets/activity-responses.js` for local response saving.

## Reader design

The shared design follows `Mathematics form 1 (09 APRIL 2026).pdf`: Times-style
serif text, blue and green headings, pale blue activities/examples, and pale
green exercises. Screen body text and answer fields use 18 px at the default
browser size; section headings use 20 px, chapter titles 30 px, and captions
16 px. These sizes use rem units so browser text scaling remains available.

Edit `assets/reader-design.css` for shared visual changes. The PDF-derived heading
roles are recorded in `scripts/reader-design-map.json`. Run
`python3 scripts/build_reader_design.py` after editing page layouts or roles;
it applies the stylesheet to all 212 pages, normalizes the six chapter headers,
and refreshes the offline preloader. The publishing build performs the same
step. Text IDs, localized text, mathematical markup, images, and answer controls
are preserved. Long tables and expressions scroll within the reading area on
narrow screens.

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
