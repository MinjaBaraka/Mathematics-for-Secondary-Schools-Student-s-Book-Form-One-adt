// Keep these open-ended responses on the learner's device, including math notation.
(() => {
  'use strict';
  const root = document.querySelector('#content');
  if (!root?.querySelector('[data-activity-item]')) return;
  const pageId = document.querySelector('meta[name="title-id"]')?.content;
  if (!pageId) return;
  const key = `adt:mathematics-form-one:${pageId}:responses:v1`;
  const selector = '[data-activity-item]';
  const status = document.getElementById('practice-save-status');
  const announce = (text) => {
    if (status && status.textContent !== text) status.textContent = text;
  };

  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    let restored = false;
    for (const field of root.querySelectorAll(selector)) {
      const value = saved?.[field.dataset.activityItem];
      if (typeof value === 'string' && !field.value) {
        field.value = value;
        restored ||= value.length > 0;
      }
    }
    if (restored) announce('Your saved answers have been restored.');
  } catch {
    announce('Answers cannot be restored in this browser. You can still write below.');
  }

  const save = () => {
    const responses = Object.fromEntries(
      Array.from(root.querySelectorAll(selector), field => [field.dataset.activityItem, field.value]),
    );
    try {
      localStorage.setItem(key, JSON.stringify(responses));
      announce('Answers saved on this device.');
    } catch {
      announce('Answers could not be saved. Keep this page open to retain your work.');
    }
  };

  for (const event of ['input', 'change']) {
    root.addEventListener(event, e => {
      if (e.target.matches(selector)) save();
    });
  }
  window.addEventListener('pagehide', save);
})();
