/**
 * Standalone math answer keyboard, using MathLive 0.110.0.
 *
 * import { initMathKeyboard } from './math-keyboard.js';
 * const cleanup = initMathKeyboard({ selector: '.quiz-answer', eager: false });
 * if (cleanup) await cleanup.ready; // true on success, false after failure/cleanup
 *
 * Ordinary inputs remain usable while the library loads or if loading fails.
 * Eager mode upgrades all matching fields after loading; lazy mode upgrades the
 * focused answer only when the calculator button is pressed. Both allow typing
 * with a physical keyboard. Textarea answers that need paragraphs should use
 * lazy mode: a math-field is a formula editor, not a multiline text editor.
 *
 * Upgraded fields expose LaTeX through .value. Labels, data-* and aria-*
 * attributes are retained. Replacing a DOM node cannot transfer listeners added
 * directly with addEventListener(), framework bindings, or all native input
 * validation behavior. Use delegated events or the onUpgrade(field, original)
 * option to reconnect application logic. Input-only selectors must be updated
 * to include math-field. This module does not change an application's grading.
 *
 * cleanup() removes the keyboard and restores replaced inputs with their current
 * LaTeX values. Existing math-fields are retained. One controller owns the page's
 * floating button; reinitializing first cleans up the previous controller.
 *
 * The default CDN requires internet access. For offline use, provide mathliveUrl
 * and fontsDirectory pointing to a self-hosted copy of the same MathLive version.
 * Alternatively pass mathlive: window.MathLive after a local classic script;
 * this also works when the textbook is opened directly from disk.
 */

const VERSION = '0.110.0';
const CDN_ROOT = `https://cdn.jsdelivr.net/npm/mathlive@${VERSION}`;
const FAB_ID = 'math-keyboard-fab';
const HINT_ID = 'math-keyboard-hint';
const PANEL_ID = 'math-keyboard-fallback-panel';
const STYLE_ID = 'math-keyboard-styles';
const DEFAULT_SELECTOR = 'input[type="text"], input:not([type]), textarea';
const loads = new Map();
let currentCleanup = null;

// #@ operates on the selection/preceding atom, rather than inserting a literal x.
const CALCULATOR_ROWS = [
  [
    { latex: '#@^2', label: 'x²', name: 'Square' },
    { latex: '#@^{#?}', label: 'xʸ', name: 'Power' },
    { latex: '\\sqrt{#0}', label: '√x', name: 'Square root' },
    { latex: '\\frac{#@}{#?}', label: 'a/b', name: 'Fraction' },
    { latex: '\\frac{1}{#@}', label: '1/x', name: 'Reciprocal' },
  ],
  [
    { latex: '#@!', label: 'x!', name: 'Factorial' },
    { latex: '\\pm', label: '±', name: 'Plus or minus' },
    { latex: '\\pi', label: 'π', name: 'Pi' },
    { latex: '(#0)', label: '()', name: 'Parentheses' },
    { latex: '\\left|#0\\right|', label: '|x|', name: 'Absolute value' },
  ],
  [
    { latex: '\\sin(#0)', label: 'sin', name: 'Sine' },
    { latex: '\\cos(#0)', label: 'cos', name: 'Cosine' },
    { latex: '\\tan(#0)', label: 'tan', name: 'Tangent' },
    { latex: '\\log(#0)', label: 'log', name: 'Logarithm' },
    { latex: '\\ln(#0)', label: 'ln', name: 'Natural logarithm' },
  ],
];

function loadMathlive(url) {
  if (!loads.has(url)) {
    const promise = import(url).catch((error) => {
      loads.delete(url);
      throw error;
    });
    loads.set(url, promise);
  }
  return loads.get(url);
}

function inIframe() {
  try { return window.self !== window.top; } catch { return true; }
}

function eligible(element) {
  return element?.matches('math-field, textarea, input[type="text"], input:not([type])');
}

function editable(element) {
  return element?.isConnected && !element.disabled && !element.readOnly
    && !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true';
}

function configureField(field) {
  field.mathVirtualKeyboardPolicy = 'manual';
  field.mathModeSpace = '\\:';
}

/** MathLive must be loaded before calling this helper directly. */
export function upgradeToMathField(element) {
  if (!eligible(element)) throw new TypeError('Expected a text input, textarea or math-field');
  if (!element.ownerDocument.defaultView.customElements.get('math-field')) {
    throw new Error('Load MathLive before upgrading an answer field');
  }
  if (element.tagName === 'MATH-FIELD') {
    configureField(element);
    return element;
  }
  const field = element.ownerDocument.createElement('math-field');
  const skipped = new Set(['type', 'rows', 'cols', 'wrap', 'value', 'readonly']);
  for (const { name, value } of element.attributes) {
    if (!skipped.has(name)) field.setAttribute(name, value);
  }
  configureField(field);
  field.readOnly = element.readOnly;
  field.disabled = element.disabled || element.matches(':disabled');
  // Preserve spaces in pre-existing plain answers; do not rewrite LaTeX commands.
  const value = element.value || '';
  field.value = value.includes('\\') ? value : value.replace(/\s/g, '\\:');
  const hadFocus = element.ownerDocument.activeElement === element;
  element.replaceWith(field);
  if (hadFocus) field.focus();
  return field;
}

// Author styles can override the browser's [hidden] rule. Explicitly set display.
function show(element, visible, display = 'block') {
  element.hidden = !visible;
  element.style.setProperty('display', visible ? display : 'none', 'important');
}

function makeButton(label, name = label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.setAttribute('aria-label', name);
  button.style.cssText = 'min-height:44px;min-width:44px;flex:1;border:1px solid #9ca3af;'
    + 'border-radius:6px;background:#fff;color:#111827;font:1rem system-ui;cursor:pointer;';
  // Preserve the field's caret on mouse/touch. Click also supports Enter/Space.
  button.addEventListener('pointerdown', (event) => {
    if (event.button === 0) event.preventDefault();
  });
  return button;
}

/**
 * Options: selector, eager (default true), mathlive, mathliveUrl, fontsDirectory,
 * onUpgrade(field, original), onError(error).
 * Returns a cleanup function with a .ready Promise<boolean>, or null if no fields.
 */
export function initMathKeyboard(options = {}) {
  if (typeof document === 'undefined') return null;
  // Validate the selector before disturbing an existing controller.
  const fields = Array.from(document.querySelectorAll(options.selector ?? DEFAULT_SELECTOR))
    .filter(eligible);
  currentCleanup?.();
  // Cleanup may have restored the nodes captured above, so query again.
  fields.splice(0, fields.length, ...Array.from(
    document.querySelectorAll(options.selector ?? DEFAULT_SELECTOR),
  ).filter(eligible));
  if (!fields.length) return null;
  for (const id of [FAB_ID, HINT_ID, PANEL_ID, STYLE_ID]) {
    if (document.getElementById(id)) throw new Error(`Element ID already in use: ${id}`);
  }

  let activeField = fields.includes(document.activeElement) ? document.activeElement : fields[0];
  let disposed = false;
  let ready = false;
  let keyboard = null;
  let previousLayouts = null;
  let panel = null;
  let resizeObserver = null;
  const replacements = new Map();
  const previousOptions = new Map();
  const managedFields = new Map();
  const fallback = inIframe();

  // MathLive's built-in per-field toggle still targets the parent in an iframe.
  // Supply this rule ourselves; it does not depend on a generated CSS pipeline.
  const styles = document.createElement('style');
  styles.id = STYLE_ID;
  styles.textContent = 'math-field[data-math-keyboard-managed]::part(virtual-keyboard-toggle)'
    + '{display:none}';
  document.head.appendChild(styles);

  const fab = makeButton('🧮', 'Loading math keyboard');
  fab.id = FAB_ID;
  fab.disabled = true;
  fab.setAttribute('aria-expanded', 'false');
  fab.style.cssText += 'position:fixed;top:1rem;right:1rem;z-index:2147483647;'
    + 'display:flex;align-items:center;justify-content:center;height:48px;width:48px;'
    + 'border-radius:50%;box-shadow:0 2px 8px #0003;font-size:1.5rem;';
  const hint = document.createElement('div');
  hint.id = HINT_ID;
  hint.setAttribute('role', 'status');
  hint.style.cssText = 'position:fixed;left:0;right:0;z-index:2147483647;'
    + 'padding:8px;text-align:center;box-sizing:border-box;background:#1f2937;'
    + 'color:#fff;font:0.875rem system-ui;';
  hint.textContent = 'Type words with your normal keyboard · use these keys for math';
  show(hint, false);
  document.body.append(fab, hint);

  function getActive() {
    // The focused DOM node is authoritative even when an iframe's focusin event
    // has not yet reached the document listener.
    if (fields.includes(document.activeElement) && editable(document.activeElement)) {
      activeField = document.activeElement;
    }
    if (!editable(activeField)) activeField = fields.find(editable);
    return activeField;
  }

  function manageField(field) {
    if (!managedFields.has(field)) {
      managedFields.set(field, field.getAttribute('data-math-keyboard-managed'));
      field.setAttribute('data-math-keyboard-managed', '');
    }
  }

  function upgrade(field) {
    if (field.tagName === 'MATH-FIELD') return field;
    const index = fields.indexOf(field);
    const upgraded = upgradeToMathField(field);
    manageField(upgraded);
    replacements.set(upgraded, field);
    fields[index] = upgraded; // Focus tracking must follow a lazy replacement.
    if (activeField === field) activeField = upgraded;
    options.onUpgrade?.(upgraded, field);
    return upgraded;
  }

  function syncHint() {
    if (disposed) return;
    const visible = panel ? !panel.hidden : Boolean(keyboard?.visible);
    const height = panel ? panel.getBoundingClientRect().height : keyboard?.boundingRect.height ?? 0;
    show(hint, visible);
    hint.style.bottom = `${height}px`;
    fab.setAttribute('aria-expanded', String(visible));
  }

  function closeKeyboard() {
    if (panel) show(panel, false);
    else keyboard?.hide();
    syncHint();
  }

  function keepFieldVisible() {
    if (disposed || !panel || panel.hidden || !getActive()) return;
    const overlap = activeField.getBoundingClientRect().bottom
      - panel.getBoundingClientRect().top + hint.getBoundingClientRect().height + 12;
    if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'instant' });
  }

  function applyKey(key) {
    if (!ready || disposed || !getActive()) return;
    const field = upgrade(activeField);
    field.focus();
    if (key.command) field.executeCommand(key.command);
    else field.insert(key.latex);
    requestAnimationFrame(keepFieldVisible);
  }

  function createFallback() {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Math keyboard');
    panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483646;'
      + 'background:#e5e7eb;padding:8px;box-sizing:border-box;max-height:55vh;'
      + 'overflow:auto;flex-direction:column;gap:6px;font-family:system-ui;';
    const digits = [
      ['7', '8', '9', '+', '-'],
      ['4', '5', '6', '\\times', '\\div'],
      ['1', '2', '3', '0', '.'],
    ].map((row) => row.map((latex) => ({
      latex, label: latex === '\\times' ? '×' : latex === '\\div' ? '÷' : latex,
    })));
    const utility = [
      { command: 'moveToPreviousChar', label: '←', name: 'Move left' },
      { command: 'moveToNextChar', label: '→', name: 'Move right' },
      { command: 'moveToNextPlaceholder', label: 'Next', name: 'Next placeholder' },
      { latex: '=', label: '=' },
      { command: 'deleteBackward', label: '⌫', name: 'Backspace' },
    ];
    for (const row of [...CALCULATOR_ROWS, ...digits, utility]) {
      const rowElement = document.createElement('div');
      rowElement.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';
      for (const key of row) {
        const button = makeButton(key.label, key.name);
        button.addEventListener('click', () => applyKey(key));
        rowElement.appendChild(button);
      }
      panel.appendChild(rowElement);
    }
    const close = makeButton('Close keyboard');
    close.addEventListener('click', () => { closeKeyboard(); getActive()?.focus(); });
    panel.appendChild(close);
    show(panel, false);
    document.body.appendChild(panel);
    fab.setAttribute('aria-controls', PANEL_ID);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncHint);
      resizeObserver.observe(panel);
    }
  }

  function onFocus(event) {
    if (fields.includes(event.target)) {
      activeField = event.target;
      // The native virtual keyboard still targets the last MathLive editor.
      // Hide it when returning to a plain answer so keys cannot edit that answer
      // by mistake. The calculator button can then upgrade the new answer.
      if (activeField.tagName !== 'MATH-FIELD') closeKeyboard();
      requestAnimationFrame(keepFieldVisible);
    }
    else if (eligible(event.target) && !panel?.contains(event.target)) closeKeyboard();
  }

  function onEscape(event) {
    if (event.key !== 'Escape' || fab.getAttribute('aria-expanded') !== 'true') return;
    event.preventDefault();
    event.stopPropagation();
    closeKeyboard();
    getActive()?.focus();
  }

  function onFabClick() {
    if (!ready || disposed || !getActive()) return;
    const field = upgrade(activeField);
    field.focus();
    if (panel) {
      show(panel, panel.hidden, 'flex');
      syncHint();
      keepFieldVisible();
    } else {
      if (keyboard.visible) keyboard.hide();
      else keyboard.show();
      syncHint();
    }
  }

  function restoreFields() {
    for (const [field, original] of replacements) {
      // Release MathLive's shared focused-field reference before disconnecting.
      // Otherwise a later editor can try to blur an already disposed instance.
      field.blur();
      if (field.hasFocus()) field.dispatchEvent(new FocusEvent('blur'));
      original.value = field.value;
      if (field.isConnected) field.replaceWith(original);
    }
    replacements.clear();
    for (const [field, settings] of previousOptions) Object.assign(field, settings);
    previousOptions.clear();
    for (const [field, previous] of managedFields) {
      if (previous === null) field.removeAttribute('data-math-keyboard-managed');
      else field.setAttribute('data-math-keyboard-managed', previous);
    }
    managedFields.clear();
  }

  function cleanup() {
    if (disposed) return;
    closeKeyboard();
    disposed = true;
    document.removeEventListener('focusin', onFocus);
    document.removeEventListener('keydown', onEscape, true);
    window.removeEventListener('resize', syncHint);
    fab.removeEventListener('click', onFabClick);
    keyboard?.removeEventListener('virtual-keyboard-toggle', syncHint);
    keyboard?.removeEventListener('geometrychange', syncHint);
    if (previousLayouts) keyboard.layouts = previousLayouts;
    resizeObserver?.disconnect();
    fab.remove();
    hint.remove();
    panel?.remove();
    styles.remove();
    restoreFields();
    if (currentCleanup === cleanup) currentCleanup = null;
  }
  currentCleanup = cleanup;
  document.addEventListener('focusin', onFocus);
  document.addEventListener('keydown', onEscape, true);
  window.addEventListener('resize', syncHint);
  fab.addEventListener('click', onFabClick);

  const libraryReady = options.mathlive !== undefined
    ? Promise.resolve(options.mathlive)
    : loadMathlive(options.mathliveUrl ?? `${CDN_ROOT}/mathlive.min.mjs`);
  cleanup.ready = libraryReady
    .then((library) => {
      if (disposed) return false;
      const MathfieldElement = library.MathfieldElement ?? customElements.get('math-field');
      if (!MathfieldElement || !customElements.get('math-field')) {
        throw new Error('MathLive did not register math-field');
      }
      // Fonts are needed in iframes too, regardless of the keyboard implementation.
      MathfieldElement.fontsDirectory = options.fontsDirectory ?? `${CDN_ROOT}/fonts`;
      for (const field of fields) {
        if (field.tagName === 'MATH-FIELD') {
          previousOptions.set(field, {
            mathVirtualKeyboardPolicy: field.mathVirtualKeyboardPolicy,
            mathModeSpace: field.mathModeSpace,
          });
          configureField(field);
          manageField(field);
        }
      }
      if (!fallback && window.mathVirtualKeyboard) {
        keyboard = window.mathVirtualKeyboard;
        previousLayouts = keyboard.layouts;
        keyboard.layouts = [
          { id: 'calculator', label: 'Calc', layers: [{ id: 'calculator', rows: CALCULATOR_ROWS }] },
          'numeric', 'symbols', 'greek', 'alphabetic',
        ];
        keyboard.addEventListener('virtual-keyboard-toggle', syncHint);
        keyboard.addEventListener('geometrychange', syncHint);
      } else createFallback();
      if (options.eager ?? true) {
        for (const field of [...fields]) if (editable(field)) upgrade(field);
      }
      ready = true;
      fab.disabled = false;
      fab.setAttribute('aria-label', 'Math keyboard');
      return true;
    })
    .catch((error) => {
      if (disposed) return false;
      cleanup(); // Roll back a partial initialization as well as a failed import.
      console.warn('Math keyboard unavailable; original answer fields are still usable.', error);
      try { options.onError?.(error); } catch (callbackError) { console.warn(callbackError); }
      return false;
    });
  return cleanup;
}

/** Decode common math spacing; this does not convert arbitrary LaTeX to prose. */
export function latexSpacingToPlain(latex) {
  return String(latex ?? '').replace(/\\(?:[,;:]| |quad\b|qquad\b|enspace\b|enskip\b)/g, ' ');
}

/**
 * Conservative token comparison, not algebraic equivalence. Keep case, braces,
 * command boundaries and text-mode spaces; ignore ordinary math whitespace and
 * optional \left/\right delimiter sizing. The result is an opaque comparison key.
 */
export function normalizeLatex(latex) {
  const source = String(latex ?? '');
  const tokens = source.match(/\\[a-zA-Z]+|\\[\s\S]|[^\s]/g) ?? [];
  const result = [];
  // Preserve text command arguments verbatim, including spaces and nested braces.
  const pattern = /\\(?:text|textbf|textit|textrm|textsf|texttt|mbox|operatorname)\*?\s*\{/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(source))) {
    const before = source.slice(last, match.index).match(/\\[a-zA-Z]+|\\[\s\S]|[^\s]/g) ?? [];
    result.push(...before.filter((token) => token !== '\\left' && token !== '\\right'));
    let depth = 1;
    let end = pattern.lastIndex;
    for (; end < source.length && depth; end++) {
      if (source[end] === '\\') { end++; continue; }
      if (source[end] === '{') depth++;
      if (source[end] === '}') depth--;
    }
    result.push(source.slice(match.index, end));
    pattern.lastIndex = last = end;
  }
  if (last === 0) return JSON.stringify(tokens.filter((token) => token !== '\\left' && token !== '\\right'));
  const after = source.slice(last).match(/\\[a-zA-Z]+|\\[\s\S]|[^\s]/g) ?? [];
  result.push(...after.filter((token) => token !== '\\left' && token !== '\\right'));
  return JSON.stringify(result);
}

/**
 * Pass a string for one answer (including |x|), or an array for alternatives.
 * Legacy pipe lists require { separator: '|' }; they cannot represent literal bars.
 */
export function matchesLatexAnswer(value, correct, { separator } = {}) {
  if (value == null || correct == null) return false;
  const alternatives = Array.isArray(correct) ? correct
    : separator ? String(correct).split(separator) : [correct];
  const answer = normalizeLatex(value);
  if (answer === '[]') return false;
  return alternatives.some((alternative) => alternative != null
    && normalizeLatex(alternative) === answer);
}
