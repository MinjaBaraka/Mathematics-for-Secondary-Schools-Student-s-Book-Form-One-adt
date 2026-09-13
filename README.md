# Mathematics for Secondary Schools Student’s Book Form One

Accessible Digital Textbook published by the Tanzania Institute of Education.
This repository contains the ready-to-read English bundle, including 212 pages,
illustrations, a glossary, easy-read text, and read-aloud audio.

[Read the textbook online](https://minjabaraka.github.io/Mathematics-for-Secondary-Schools-Student-s-Book-Form-One-adt/)

## Local reading

The reader files are at the repository root. Open `index.html`, or serve this
directory with `python3 -m http.server 8000` and visit `http://localhost:8000`.

Activities, exercises and projects use live text and editable answer boxes.
All 1,322 response fields save on the current device. Each question or
subquestion has one response field; table cells remain individually editable.
Former split answers and notes are carried into the combined field, including
questions that continue on the next page. Repeated publisher/book-name labels
and their read-aloud recordings have been removed throughout the book.

The 137 worked examples and the answer key are read-only text and mathematical notation. Required
graphs and diagrams remain illustrations; screenshots of instructions,
questions and solutions have been replaced with live content. The global math
toolbar has been removed from the textbook.
Answer saving runs silently, without save-status messages or spoken updates.
Response fields use their task instructions as accessible names; the extra
“Your findings” label has been removed.

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
It also prevents removed running credits and redundant response fields from
returning. Retired image descriptions and recordings are also excluded.
`scripts/pdf-page-review.json` records the completed, sequential comparison of
all 212 pages with the source PDF and the final verification results.
Run `node --test scripts/test_activity_responses.cjs` to check saved
answer migration, clearing, cross-page notes, and unavailable device storage.
Edit `assets/learning-content.css` for the live learning panels, and
`assets/activity-responses.js` for local response saving.

## Reader design

The shared design follows `Mathematics form 1 (09 APRIL 2026).pdf`: Times-style
serif text, blue and green headings, pale blue activities/examples, and pale
green exercises. Screen body text and answer fields use 18 px at the default
browser size; section headings use 20 px, chapter titles 30 px, and captions
16 px. These sizes use rem units so browser text scaling remains available.

Edit `assets/reader-design.css` for shared visual changes. The PDF-derived heading
roles are recorded in `scripts/reader-design-map.json`.
`python3 scripts/build_reader_design.py` can infer design roles for a fresh
export. It applies the stylesheet to all 212 pages, normalizes the six chapter
headers, and refreshes the offline preloader. Review its output before using it
on manually corrected pages: inference can replace deliberate design attributes.
Publishing copies the reviewed HTML without recalculating its layout.

All 212 pages share the reading frame in `assets/reader-layout.css`, based on
pg011: a 52 rem maximum page width, 3 rem side gutters, and 1 rem gutters on
small screens. This keeps prose, activities, exercises, and examples aligned
when moving between pages. The page shrinks with the viewport on phones.
`scripts/normalize_reader_layout.py` removes extra spacing from nested reading
containers and stacks page-level columns while preserving the internal layout
of diagrams, equations, tables, and question panels. The design script runs it
automatically; publishing preserves the existing annotations. To update layout annotations and offline
resources, run `python3 -B scripts/normalize_reader_layout.py`.

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
