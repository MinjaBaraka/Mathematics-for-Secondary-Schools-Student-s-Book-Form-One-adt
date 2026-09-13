#!/usr/bin/env python3
"""Apply the PDF-derived design roles without rewriting textbook text or IDs."""

from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
STYLE_LINK = '    <link href="./assets/reader-design.css" rel="stylesheet">\n'
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())


class Element:
    def __init__(self, tag, attrs, parent, start, raw):
        self.tag, self.attrs, self.parent = tag, dict(attrs), parent
        self.start, self.raw = start, raw
        self.end = start + len(raw)
        self.children, self.text, self.design = [], [], {}

    @property
    def classes(self):
        return self.attrs.get('class', '').split()


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.offsets, offset = [], 0
        # HTMLParser counts only newlines, not form feeds found in some labels.
        for line in source.split('\n'):
            self.offsets.append(offset)
            offset += len(line) + 1
        self.nodes, self.stack = [], []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        parent = self.stack[-1] if self.stack else None
        row, column = self.getpos()
        node = Element(tag, attrs, parent, self.offsets[row - 1] + column, self.get_starttag_text())
        self.nodes.append(node)
        if parent:
            parent.children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index].tag == tag:
                row, column = self.getpos()
                self.stack[index].end = self.offsets[row - 1] + column + len(tag) + 3
                del self.stack[index:]
                break

    def handle_data(self, data):
        for node in self.stack:
            node.text.append(data)


def ancestors(node):
    while node.parent:
        node = node.parent
        yield node


def chapter_header(source, title):
    """Replace duplicated banner/title compositions with one accessible header."""
    page = Page(source)
    if any('book-chapter' in n.classes for n in page.nodes):
        return source
    heading = next(n for n in page.nodes if n.tag == 'h1' and ''.join(n.text).strip() == title)
    block = next(n for n in ancestors(heading) if n.parent and n.parent.tag == 'section')
    entries = [n for n in page.nodes if n.attrs.get('data-id') and block in ancestors(n)]
    badge, hidden = [], []
    for node in entries:
        if node is heading:
            continue
        snippet = source[node.start:node.end]
        if node.tag == 'h1':
            snippet = re.sub(r'^<h1\b', '<span', snippet).replace('</h1>', '</span>')
            snippet = re.sub(r'\sclass="[^"]*"', '', snippet)
            badge.append(snippet)
        else:
            hidden.append(snippet)
    title_html = source[heading.start:heading.end]
    title_html = re.sub(r'\sclass="[^"]*"', ' class="adt-h1"', title_html)
    header = '<header class="book-chapter">\n'
    header += '<div class="book-chapter-badge">' + ' '.join(badge) + '</div>\n'
    header += title_html + '\n'
    if hidden:
        header += '<div hidden aria-hidden="true">' + ''.join(hidden) + '</div>\n'
    header += '</header>'
    return source[:block.start] + header + source[block.end:]


def apply_design(destination):
    config = json.loads((ROOT / 'scripts/reader-design-map.json').read_text())
    mapping = config['pages']
    count = 0
    for path in sorted(destination.glob('*.html')):
        source = path.read_text(encoding='utf-8').replace(STYLE_LINK, '')
        if path.name in config['chapters']:
            source = chapter_header(source, config['chapters'][path.name])
        page = Page(source)
        for node in page.nodes:
            inside = node.attrs.get('id') == 'content' or any(
                p.attrs.get('id') == 'content' for p in ancestors(node)
            )
            if not inside:
                continue
            classes = node.classes
            text = ' '.join(''.join(node.text).split())
            if node.parent and 'flex' in node.parent.classes and re.fullmatch(r'(?:\d+[.)]|\([a-zivx]+\))', text, re.I):
                node.design['data-book-number'] = ''
            if text in ('Tanzania Institute of Education', 'Mathematics Form One') and any(
                'writing-mode' in c or c in ('rotate-180', 'rotate-90', '-rotate-90') for c in classes
            ):
                node.design['data-book-running'] = ''
            if node.tag == 'section':
                node.design['data-book-page'] = node.attrs.get('data-section-type', 'text_only')
            if node.tag in ('div', 'section', 'article', 'aside'):
                if any(c.startswith(('rounded-', 'shadow', 'ring-')) for c in classes):
                    node.design['data-book-box'] = ''
                if any(c.startswith('space-y-') for c in classes):
                    node.design['data-book-stack'] = ''
                if any(re.match(r'p[xy]?-\d', c) for c in classes):
                    node.design['data-book-padding'] = ''
                surface = None
                for cls in classes:
                    match = re.match(r'bg-(green|lime|emerald|teal|sky|blue|cyan|yellow|amber|pink|fuchsia|orange|purple|rose|slate|gray)-(\d+)', cls)
                    if match:
                        family, shade = match.group(1), int(match.group(2))
                        green = family in ('green', 'lime', 'emerald', 'teal')
                        blue = family in ('sky', 'blue', 'cyan')
                        if shade >= 400 and (blue or green):
                            surface = 'green-bar' if green else 'blue-bar'
                        elif green:
                            surface = 'exercise'
                        elif blue:
                            surface = 'blue'
                        else:
                            surface = 'plain'
                if any(c.startswith('bg-gradient-') for c in classes):
                    surface = ('green-bar' if any(c.startswith(('from-green-', 'from-lime-', 'from-emerald-')) for c in classes) else 'blue-bar') if 'text-white' in classes or any(
                        'text-white' in c.classes for c in node.children
                    ) else surface or 'plain'
                if surface and node.tag != 'section':
                    node.design['data-book-surface'] = surface
            if re.fullmatch(r'h[1-6]', node.tag):
                text = ' '.join(''.join(node.text).split())
                role = mapping.get(path.name, {}).get(text)
                if role:
                    node.design['data-book-heading'] = role['role']
                    node.design['data-book-ink'] = role['ink']
            if node.tag == 'img' and 'decorative sidebar' in node.attrs.get('alt', '').lower():
                node.design['data-book-decoration'] = ''

        # Remove individual question-card decorations, keeping the enclosing
        # activity/exercise panel and each original label/control untouched.
        for node in page.nodes:
            if 'data-activity-item' not in node.attrs:
                continue
            for parent in ancestors(node):
                if parent.tag == 'section':
                    break
                if 'data-book-box' in parent.design:
                    descendants = [n for n in page.nodes if parent in ancestors(n)]
                    controls = [n for n in descendants if 'data-activity-item' in n.attrs]
                    headings = [n for n in descendants if re.fullmatch(r'h[1-6]', n.tag)]
                    if len(controls) == 1 and not headings:
                        parent.design['data-book-answer-card'] = ''
                    break

        for node in reversed(page.nodes):
            if not node.design:
                continue
            tag = re.sub(r'\sdata-book-[\w-]+(?:="[^"]*")?', '', node.raw)
            attrs = ''.join(f' {key}="{escape(value, quote=True)}"' for key, value in node.design.items())
            position = len(tag) - (2 if tag.endswith('/>') else 1)
            tag = tag[:position] + attrs + tag[position:]
            source = source[:node.start] + tag + source[node.start + len(node.raw):]
        if source.count('</head>') != 1:
            raise ValueError(f'Expected one head in {path.name}')
        source = source.replace('</head>', STYLE_LINK + '</head>')
        if path.read_text(encoding='utf-8') != source:
            path.write_text(source, encoding='utf-8')
        count += 1
    return count


if __name__ == '__main__':
    import sys
    sys.dont_write_bytecode = True
    from refresh_embedded_resources import refresh_embedded_resources
    from normalize_reader_layout import normalize_reader_layout
    print(f'Applied the shared reader design to {apply_design(ROOT)} pages.')
    normalize_reader_layout(ROOT)
    refresh_embedded_resources(ROOT)
