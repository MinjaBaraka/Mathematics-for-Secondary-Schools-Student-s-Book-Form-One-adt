#!/usr/bin/env python3
"""Give every exported page the same reading frame without changing its content."""
from collections import Counter
from html import escape
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
from build_reader_design import Page, ancestors

ROOT = Path(__file__).resolve().parents[1]
STYLE = '    <link href="./assets/reader-layout.css" rel="stylesheet">\n'
LABELS = ('Tanzania Institute of Education', 'Mathematics Form One')
PANEL_CLASSES = {'practice-panel', 'numbers-introduction', 'worked-example', 'book-learning-panel', 'book-restored-panel'}
ART_CLASSES = {'front-rail', 'front-footer', 'front-top-rule', 'front-header', 'chapter-opening', 'book-chapter', 'front-signature', 'preface-qr'}


def normalize_reader_layout(destination=ROOT, only_pages=None):
    counts = Counter()
    spine = json.loads((destination / 'content/pages.json').read_text())
    for entry in spine:
        if only_pages is not None and entry['href'] not in only_pages:
            continue
        path = destination / entry['href']
        original = source = path.read_text(encoding='utf-8')
        doc = Page(source)
        root = next(n for n in doc.nodes if n.attrs.get('id') == 'content')
        sections = [n for n in doc.nodes if n.tag == 'section' and root in ancestors(n)]
        marks = {root: {'data-reader-layout': 'standard'}}
        sidebars = set()

        def descendants(node):
            return [n for n in doc.nodes if node in ancestors(n)]

        def hidden(node):
            return any('hidden' in n.attrs or 'sr-only' in n.classes or n in sidebars for n in [node, *ancestors(node)])

        # Older exports hid the rotated credits but left their wide boxes in flow.
        for node in doc.nodes:
            if node.tag not in ('aside', 'div') or node is root or root not in ancestors(node):
                continue
            if any('front-rail' in n.classes for n in [node, *ancestors(node)]):
                continue
            text = ' '.join(''.join(node.text).split())
            remainder = text
            for label in LABELS:
                remainder = remainder.replace(label, '')
            nested = descendants(node)
            if text and not remainder.strip() and (node.tag == 'aside' or any('data-book-running' in n.attrs for n in [node, *nested])):
                sidebars.add(node)
        sidebars = {n for n in sidebars if not any(p in sidebars for p in ancestors(n))}
        for node in sidebars:
            marks[node] = {'data-reader-sidebar': ''}

        def mark(node, key):
            marks.setdefault(node, {})[key] = ''

        def visit(node, cover=False):
            if hidden(node):
                return
            classes = set(node.classes)
            text = ' '.join(''.join(node.text).split())
            if not text and not any(n.tag in ('img', 'input', 'textarea') for n in [node, *descendants(node)]):
                return
            if text in LABELS or classes & ART_CLASSES or node.tag in ('footer', 'figure', 'img', 'span', 'strong', 'em', 'a', 'label', 'math', 'input', 'textarea', 'svg'):
                return
            if classes & {'inline-block', 'inline-flex'} or ('absolute' in classes and text.isdigit()):
                return
            if node.tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
                return
            if node.tag in ('p', 'ul', 'ol', 'table') or 'adt-body' in classes or 'data-id' in node.attrs:
                if not classes & {'inline-block', 'inline-flex'}:
                    mark(node, 'data-reader-region')
                return
            if node.tag not in ('div', 'article', 'aside'):
                return
            if 'data-book-box' in node.attrs or classes & PANEL_CLASSES or node.attrs.get('data-book-surface') in ('blue', 'exercise', 'blue-bar', 'green-bar'):
                mark(node, 'data-reader-region')
                return
            mark(node, 'data-reader-column')
            mark(node, 'data-reader-region')
            if cover:
                return
            children = [n for n in node.children if not hidden(n) and ''.join(n.text).strip() not in LABELS]
            layout = ('grid' in classes or ('flex' in classes and 'flex-col' not in classes))
            answer_grid = 'grid' in classes and bool(children) and all(
                any('data-activity-item' in item.attrs for item in [child, *descendants(child)])
                for child in children
            )
            protected_grid = (answer_grid or 'front-credit' in classes or entry['href'] == 'pg212_sec001.html' or 'grid-cols-[1fr_auto]' in classes or any('data-toc-leader' in n.attrs for n in node.children))
            if layout and not protected_grid:
                substantial = [n for n in children if n.tag in ('div', 'article') and len(''.join(n.text).strip()) > 40]
                if substantial or 'grid' in classes:
                    mark(node, 'data-reader-flow')
            if protected_grid:
                return
            if layout and 'data-reader-flow' not in marks[node]:
                return
            for child in children:
                # Centered equations/illustrations retain their internal proportions.
                if layout and child.tag in ('img', 'math', 'span'):
                    continue
                visit(child)

        for section in sections:
            for child in section.children:
                visit(child, cover=section.attrs.get('data-section-type') == 'front_cover')
        for node in reversed(doc.nodes):
            attrs = marks.get(node, {})
            if node not in marks and not any(k.startswith('data-reader-') for k in node.attrs):
                continue
            tag = re.sub(r'\sdata-reader-[\w-]+(?:="[^"]*")?', '', node.raw)
            extra = ''.join(f' {k}="{escape(v, quote=True)}"' for k, v in attrs.items())
            end = len(tag) - (2 if tag.endswith('/>') else 1)
            tag = tag[:end] + extra + tag[end:]
            source = source[:node.start] + tag + source[node.start + len(node.raw):]
            counts.update(attrs.keys())
        source = re.sub(r'[ \t]*<link\b[^>]*href="\./assets/reader-layout\.css"[^>]*>\s*', '', source)
        source = source.replace('</head>', STYLE + '</head>')
        if source != original:
            path.write_text(source, encoding='utf-8')
        counts['pages'] += 1
    return counts


if __name__ == '__main__':
    from refresh_embedded_resources import refresh_embedded_resources
    result = normalize_reader_layout()
    refresh_embedded_resources(ROOT)
    print(json.dumps(dict(result), indent=2))
