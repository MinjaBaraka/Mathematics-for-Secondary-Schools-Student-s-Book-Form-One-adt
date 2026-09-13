# Responsive exported reader

The reader follows the mobile navigation and accessibility sheet in the
[Writing Standard 1 reference](https://adolfalfred.github.io/Writing-Pupil-s-Book-Standard-1-adt/index.html).

Below 768 CSS pixels, the dock shows the contents button, previous/next page
controls and page count, and one accessibility-menu button. The tool sheet
uses two columns and centres an odd last tool. Available tools follow each
book's feature flags and page media; a book without sign-language video does
not acquire a nonfunctional video button.

`assets/reader-mobile.css` styles semantic `data-reader-*` attributes in the
existing local runtime. `assets/mobile-sheet-drag.js` and its stylesheet add a
44-pixel drag handle, with Enter/Space and Escape dismissal. Bottom sheets
scroll within the viewport on short screens. Desktop controls and book
content retain their existing behavior.

Keep the 768-pixel runtime breakpoint and both mobile stylesheets aligned.
After changing page script or stylesheet links, refresh the corresponding HTML
inside `assets/offline-preloader.js`. Bump asset query versions when publishing.

Embedded debug source maps are removed from local runtime exports. Git ignore
rules prevent caches and temporary files from being committed. Export rules
exclude development metadata; Git commit history remains in the repository
and is never part of the published textbook.
