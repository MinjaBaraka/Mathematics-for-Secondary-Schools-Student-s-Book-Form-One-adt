#!/usr/bin/env python3
"""Prevent image-only tasks and interactive worked examples from returning in exports."""

from collections import Counter
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
from build_reader_design import Page, ancestors

ROOT = Path(__file__).resolve().parents[1]


def audit_learning_content(destination=ROOT):
    manifest = json.loads((ROOT / 'scripts/learning-content-audit.json').read_text())
    texts = json.loads((destination / 'content/i18n/en-US/texts.json').read_text())
    audios = json.loads((destination / 'content/i18n/en-US/audios.json').read_text())
    speech = json.loads((destination / 'content/i18n/en-US/speech_texts.json').read_text())
    errors, counts, found_text = [], Counter(), set()
    retired = set(manifest['retired_image_sources'])
    current_kind = None
    spine = json.loads((destination / 'content/pages.json').read_text())
    if {p['href'] for p in spine} != set(manifest['pages']):
        errors.append('The reading order differs from the audited 212-page book.')
    for filename, expected in manifest['pages'].items():
        path = destination / filename
        if not path.is_file():
            errors.append(f'{filename}: missing page')
            continue
        source = path.read_text()
        nodes = Page(source).nodes
        root = next(n for n in nodes if n.attrs.get('id') == 'content')
        nodes = [n for n in nodes if root in ancestors(n)]
        fields = [n for n in nodes if 'data-activity-item' in n.attrs]
        actual = {n.attrs['data-activity-item']: n.attrs.get('data-response-kind') for n in fields}
        if actual != expected['responses'] or len(actual) != len(fields):
            errors.append(f'{filename}: response fields differ from the audited activities/exercises')
        counts['responses'] += len(fields)
        counts['pages'] += 1
        if fields and 'assets/activity-responses.js' not in source:
            errors.append(f'{filename}: response saving is not loaded')
        if re.search(r'<script[^>]+(?:math-keyboard|mathlive)', source, re.I):
            errors.append(f'{filename}: the retired math toolbar was reintroduced')
        headings = []
        for node in nodes:
            identity = node.attrs.get('data-id')
            if identity:
                found_text.add(identity)
            if node.tag == 'img' and node.attrs.get('src', '').removeprefix('./') in retired:
                errors.append(f'{filename}: rasterized text panel returned: {identity}')
            kind = node.attrs.get('data-learning-heading')
            if kind:
                current_kind = kind
                headings.append({'kind': kind, 'text': ' '.join(''.join(node.text).split())})
                if any('sr-only' in n.classes or 'hidden' in n.attrs for n in [node, *ancestors(node)]):
                    errors.append(f'{filename}: hidden learning heading: {identity}')
            if node in fields:
                if current_kind != node.attrs.get('data-response-kind'):
                    errors.append(f'{filename}: a response field moved outside its learning section')
                if node.attrs.get('data-response-kind') not in ('activity', 'exercise', 'project'):
                    errors.append(f'{filename}: a response field is outside learner practice')
                label = node.attrs.get('aria-label') or node.attrs.get('aria-labelledby') or any(
                    n.tag == 'label' and n.attrs.get('for') == node.attrs.get('id') for n in nodes
                )
                if not label:
                    errors.append(f'{filename}: unlabelled answer field: {node.attrs.get("id")}')
        if headings != expected['headings']:
            errors.append(f'{filename}: learning headings differ from the audit')
    for identity in manifest['restored_text_ids']:
        if identity not in found_text or identity not in texts:
            errors.append(f'{identity}: restored text is missing')
        filename = audios.get(identity)
        if identity not in speech or not filename or not (destination / 'content/i18n/en-US/audio' / filename).is_file():
            errors.append(f'{identity}: restored text has no read-aloud recording')
    if errors:
        raise ValueError('\n'.join(errors))
    return counts


if __name__ == '__main__':
    target = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT
    result = audit_learning_content(target)
    print(f'Learning-content audit passed: {result["pages"]} pages, {result["responses"]} saved response fields.')
