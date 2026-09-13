// Keep these open-ended responses on the learner's device, including math notation.
(() => {
  'use strict';
  const root = document.querySelector('#content');
  if (!root?.querySelector('[data-activity-item]')) return;
  const pageId = document.querySelector('meta[name="title-id"]')?.content;
  if (!pageId) return;
  const storageKey = id => `adt:mathematics-form-one:${id}:responses:v1`;
  const key = storageKey(pageId);
  const selector = '[data-activity-item]';

  const read = id => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey(id)) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      // Keep the fields editable if stored responses cannot be read.
      return {};
    }
  };

  const save = () => {
    const responses = Object.fromEntries(
      Array.from(root.querySelectorAll(selector), field => [field.dataset.activityItem, field.value]),
    );
    try {
      // Retain historical keys, including notes moved to a following page.
      localStorage.setItem(key, JSON.stringify({ ...read(pageId), ...responses }));
    } catch {
      // Leave current answers in the fields if device storage is unavailable.
    }
  };

  const saved = read(pageId);
  let migrated = false;
  for (const field of root.querySelectorAll(selector)) {
    if (field.value) continue;
    const value = saved[field.dataset.activityItem];
    // An empty saved string is intentional: do not revive an answer the reader cleared.
    if (typeof value === 'string') {
      field.value = value;
      continue;
    }
    try {
      const sources = JSON.parse(field.dataset.responseSources || '[]');
      if (!Array.isArray(sources)) continue;
      const parts = sources.flatMap(source => {
        const previous = source.page ? read(source.page) : saved;
        const answer = previous[source.key];
        if (typeof answer !== 'string' || !answer.trim()) return [];
        return [source.label ? `${source.label}:\n${answer}` : answer];
      });
      if (parts.length) {
        field.value = parts.join('\n\n');
        migrated = true;
      }
    } catch {
      // One malformed migration must not prevent other answers from loading.
    }
  }
  if (migrated) save();

  for (const event of ['input', 'change']) {
    root.addEventListener(event, e => {
      if (e.target.matches(selector)) save();
    });
  }
  window.addEventListener('pagehide', save);
})();
