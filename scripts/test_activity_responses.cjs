// Behavioral checks for preserving saved answers when response fields change.
// Run with: node --test scripts/test_activity_responses.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const script = readFileSync(join(__dirname, '../assets/activity-responses.js'), 'utf8');
const key = page => `adt:mathematics-form-one:${page}:responses:v1`;

function open(storage, definitions, page = 'pg025_sec001', blocked = false) {
  const events = {};
  const fields = definitions.map(def => ({
    dataset: {
      activityItem: def.key,
      responseSources: typeof def.sources === 'string' ? def.sources : JSON.stringify(def.sources || []),
    },
    value: def.value || '',
    matches: selector => selector === '[data-activity-item]',
  }));
  const root = {
    querySelector: () => fields[0],
    querySelectorAll: () => fields,
    addEventListener: (name, handler) => { events[name] = handler; },
  };
  vm.runInNewContext(script, {
    document: { querySelector: selector => selector === '#content' ? root : { content: page } },
    window: { addEventListener: (name, handler) => { events[name] = handler; } },
    localStorage: {
      getItem: k => { if (blocked) throw new Error('Storage disabled'); return storage.get(k) ?? null; },
      setItem: (k, value) => { if (blocked) throw new Error('Storage disabled'); storage.set(k, value); },
    },
  });
  return { fields, events };
}

const combined = {
  key: 'item-14-combined',
  sources: [{ key: 'item-14', label: 'Fraction' }, { key: 'item-15', label: 'Decimal' }],
};

test('both former answers survive, migrate once, and stay cleared when deleted', () => {
  const storage = new Map([[key('pg025_sec001'), JSON.stringify({ 'item-14': '1/15', 'item-15': '0.0666…', notes: 'Keep me' })]]);
  let page = open(storage, [combined]);
  assert.equal(page.fields[0].value, 'Fraction:\n1/15\n\nDecimal:\n0.0666…');
  page = open(storage, [combined]);
  assert.equal(page.fields[0].value, 'Fraction:\n1/15\n\nDecimal:\n0.0666…');
  page.fields[0].value = '';
  page.events.input({ target: page.fields[0] });
  assert.equal(open(storage, [combined]).fields[0].value, '');
  const saved = JSON.parse(storage.get(key('pg025_sec001')));
  assert.equal(saved.notes, 'Keep me');
  assert.equal(saved['item-14'], '1/15');
  assert.equal(saved['item-15'], '0.0666…');
});

test('partial old answers, existing combined answers, and prefilled fields are retained', () => {
  let storage = new Map([[key('pg025_sec001'), JSON.stringify({ 'item-15': '2/3 ≈ 0.667\nworking' })]]);
  assert.equal(open(storage, [combined]).fields[0].value, 'Decimal:\n2/3 ≈ 0.667\nworking');
  storage = new Map([[key('pg025_sec001'), JSON.stringify({ 'item-14': 'old', 'item-14-combined': 'Latest answer' })]]);
  assert.equal(open(storage, [combined]).fields[0].value, 'Latest answer');
  assert.equal(open(storage, [{ ...combined, value: 'Already typing' }]).fields[0].value, 'Already typing');
});

test('notes move to the actual question on the next page without losing either answer', () => {
  const original = JSON.stringify({ 'item-18': 'Coordinates noted on the graph' });
  const storage = new Map([
    [key('pg135_sec001'), original],
    [key('pg136_sec001'), JSON.stringify({ 'item-1': 'P = (2, 3)' })],
  ]);
  const definition = {
    key: 'item-1-combined', sources: [
      { key: 'item-1', label: 'Answer' },
      { page: 'pg135_sec001', key: 'item-18', label: 'Earlier notes' },
    ],
  };
  const page = open(storage, [definition], 'pg136_sec001');
  assert.equal(page.fields[0].value, 'Answer:\nP = (2, 3)\n\nEarlier notes:\nCoordinates noted on the graph');
  assert.equal(storage.get(key('pg135_sec001')), original);
});

test('unchanged fields still save and restore through input, change, and page exit', () => {
  const storage = new Map();
  const page = open(storage, [{ key: 'item-1' }, { key: 'item-2' }]);
  for (const event of ['input', 'change', 'pagehide']) {
    page.fields[0].value = event;
    page.events[event]({ target: page.fields[0] });
    assert.equal(open(storage, [{ key: 'item-1' }]).fields[0].value, event);
  }
});

test('corrupt or unavailable storage does not prevent editing', () => {
  for (const value of ['{broken', 'null', '[]', '42', '"text"']) {
    const storage = new Map([[key('pg025_sec001'), value]]);
    const page = open(storage, [combined]);
    page.fields[0].value = 'New answer';
    page.events.input({ target: page.fields[0] });
    assert.equal(open(storage, [combined]).fields[0].value, 'New answer');
  }
  const page = open(new Map(), [combined], 'pg025_sec001', true);
  page.fields[0].value = 'Unsaved but editable';
  assert.doesNotThrow(() => page.events.input({ target: page.fields[0] }));
  assert.equal(page.fields[0].value, 'Unsaved but editable');
});

test('malformed migration metadata does not stop other fields from restoring', () => {
  const storage = new Map([[key('pg025_sec001'), JSON.stringify({ 'item-2': 'Retained' })]]);
  const page = open(storage, [{ key: 'item-1', sources: '{bad' }, { key: 'item-2' }]);
  assert.equal(page.fields[1].value, 'Retained');
});
