/* Site text, part 2: the on-page editor for admins (base.html loads it when the signed-in user is staff).

   "Edit text" turns on edit mode. Click any text to change it right where it is; Alt-click uses the page as
   usual. While typing, every place showing the same text previews the change; Save keeps it as a draft in
   this browser, Cancel drops it and Reset to default brings back the original wording. The "All text" panel
   lists every text on the page (button labels, tooltips and the page title too), and publishes the drafts to
   the server, so every visitor sees them, or exports and imports them as JSON.

   The store and binding live in zema-text.js; this file only builds the interface on window.ZemaText. */
(function () {
  'use strict';

  const ZT = window.ZemaText;
  if (!ZT || !ZT.config.canEdit) return;
  const { store, binder, normalize, placeholders, samePlaceholders } = ZT;

  const MODE = 'zema-text-editing';
  const MAX_ROWS = 300;

  // A small element builder: h('button', { class: 'x', onclick }, 'Label').
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([name, value]) => {
      if (value === false || value === null || value === undefined) return;
      if (name.startsWith('on')) el.addEventListener(name.slice(2), value);
      else if (name === 'value') el.value = value;
      else el.setAttribute(name, value === true ? '' : value);
    });
    el.append(...children.flat().filter(c => c !== null && c !== false && c !== undefined));
    return el;
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const csrfToken = () => {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  };
  const remember = (name, value) => { try { sessionStorage.setItem(name, value); } catch (e) { /* not kept */ } };
  const recall = name => { try { return sessionStorage.getItem(name); } catch (e) { return null; } };

  // contenteditable="plaintext-only" keeps pasted formatting out; older browsers get "true" plus a paste filter.
  const PLAINTEXT = (() => {
    try {
      const probe = document.createElement('span');
      probe.contentEditable = 'plaintext-only';
      return probe.contentEditable === 'plaintext-only';
    } catch (e) {
      return false;
    }
  })();

  // UI inside an open modal dialog: everything outside one is inert while it is open.
  const host = () => [...document.querySelectorAll('dialog[open]')].reverse().find(d => d.matches(':modal')) || document.body;

  function stateOf(key) {
    if (store.isDraft(key)) return store.isChanged(key) ? 'draft' : 'reset';
    return store.isPublished(key) ? 'published' : '';
  }
  const STATE_LABEL = { draft: 'Draft', reset: 'Reset (draft)', published: 'Published', '': 'Default' };

  /* ------------------------------------------------------------------ finding text under the pointer */

  function textNodeAt(x, y) {
    let node = null;
    if (document.caretPositionFromPoint) node = document.caretPositionFromPoint(x, y)?.offsetNode;
    else if (document.caretRangeFromPoint) node = document.caretRangeFromPoint(x, y)?.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const range = document.createRange();
    range.selectNodeContents(node);
    const hit = [...range.getClientRects()].some(r => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2);
    return hit ? node : null;
  }

  // What a click at this point would edit: a text node, or an input's placeholder or an image's alt text.
  function targetAt(event) {
    const el = event.target instanceof Element ? event.target : null;
    if (!el || el.closest('.ze-ui, .ze-field')) return null;
    const node = textNodeAt(event.clientX, event.clientY);
    const binding = node && binder.bindingFor(node);
    if (binding) return { kind: 'text', node, binding };
    for (const [selector, name] of [['input[placeholder], textarea[placeholder]', 'placeholder'], ['img[alt]', 'alt']]) {
      const field = el.closest(selector);
      const fieldBinding = field && binder.bindingForAttr(field, name);
      if (fieldBinding) return { kind: 'attr', el: field, name, binding: fieldBinding };
    }
    return null;
  }

  const rectsOf = target => {
    if (target.kind === 'attr') return [target.el.getBoundingClientRect()];
    const range = document.createRange();
    range.selectNodeContents(target.node);
    return [...range.getClientRects()];
  };

  // The containing block of position: fixed inside a transformed dialog is the dialog itself.
  function fixedOrigin(container) {
    if (container === document.body || getComputedStyle(container).transform === 'none') return { left: 0, top: 0 };
    const box = container.getBoundingClientRect();
    return { left: box.left, top: box.top };
  }

  /* ------------------------------------------------------------------ the editor */

  const ui = h('div', { class: 'ze-ui', 'data-noedit': true });
  const highlight = h('div', { class: 'ze-highlight', hidden: true });
  const toggle = h('button', { class: 'ze-toggle', type: 'button', 'aria-pressed': 'false', onclick: () => setEditing(!editing) },
    h('span', { class: 'ze-pen', 'aria-hidden': 'true' }, '✎'), h('span', { class: 'ze-toggle-label' }, 'Edit text'));
  const hint = h('span', { class: 'ze-hint', hidden: true }, 'Click any text to change it · Alt-click to use the page');
  const draftBadge = h('span', { class: 'ze-badge', hidden: true });
  const listButton = h('button', { class: 'ze-tool', type: 'button', onclick: () => panel.toggle() }, 'All text', draftBadge);
  const toolbar = h('div', { class: 'ze-toolbar', role: 'toolbar', 'aria-label': 'Text editor' }, toggle, hint, listButton);
  ui.append(highlight, toolbar);

  let editing = false;
  let session = null;

  function setEditing(on) {
    editing = on;
    if (!on && session) session.cancel();
    document.documentElement.classList.toggle('ze-editing', on);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.querySelector('.ze-toggle-label').textContent = on ? 'Editing' : 'Edit text';
    hint.hidden = !on;
    highlight.hidden = true;
    remember(MODE, on ? '1' : '0');
  }

  function updateBadge() {
    const n = store.draftCount();
    draftBadge.hidden = n === 0;
    draftBadge.textContent = String(n);
    draftBadge.title = `${plural(n, 'unpublished change', 'unpublished changes')}`;
  }

  /* One open edit: inline in the text itself, or in a field in the bar for attributes and form options. */
  function openSession(target, inField = false) {
    const { key } = target.binding;
    const original = store.get(key);
    const node = target.kind === 'text' ? target.node : null;
    // Part of a template split by markup ("<strong>3</strong> of 12 words"): the whole template is edited.
    const part = Boolean(target.binding.from || target.binding.to);
    const inline = node && !inField && !part && !node.parentElement.closest('option, title, select, svg');

    let field, lead = null, trail = null;
    if (inline) {
      field = h('span', {
        class: 'ze-field', contenteditable: PLAINTEXT ? 'plaintext-only' : 'true', role: 'textbox',
        'aria-label': 'Text', spellcheck: 'false', 'data-noedit': true,
      }, original);
      // Keep the whitespace around the text outside the field so the line doesn't shift.
      const raw = node.nodeValue;
      lead = document.createTextNode(raw.match(/^\s*/)[0]);
      trail = document.createTextNode(raw.match(/\s*$/)[0]);
      node.replaceWith(lead, field, trail);
    } else {
      field = h('textarea', { class: 'ze-input', rows: 2, 'aria-label': 'Text', spellcheck: 'false', value: original });
    }
    const read = () => (inline ? field.textContent : field.value);

    const count = binder.collect().filter(f => f.binding.key === key).length + (inline ? 1 : 0);
    const error = h('p', { class: 'ze-error', role: 'alert', hidden: true });
    const resetButton = h('button', { class: 'ze-btn', type: 'button', disabled: !store.isChanged(key), onclick: () => finish('reset') }, 'Reset to default');
    const names = placeholders(key);
    const bar = h('div', { class: 'ze-bar ze-ui', role: 'dialog', 'aria-label': 'Edit text', 'data-noedit': true },
      h('div', { class: 'ze-bar-meta' },
        h('span', {}, count > 1 ? `Used ${count}× on this page, all change together` : 'Used once on this page'),
        h('span', { class: `ze-tag ze-tag-${stateOf(key) || 'default'}` }, STATE_LABEL[stateOf(key)])),
      part ? h('p', { class: 'ze-note' }, 'This text is part of a longer one, so the whole text is edited here.') : null,
      store.isChanged(key) ? h('p', { class: 'ze-default' }, h('span', {}, 'Default: '), key) : null,
      inline ? null : field,
      names.length ? h('p', { class: 'ze-note' }, 'Keep ', names.flatMap((n, i) => [i ? ', ' : '', h('code', {}, `{${n}}`)]), ': the site fills ', names.length > 1 ? 'them' : 'it', ' in.') : null,
      error,
      h('div', { class: 'ze-actions' },
        resetButton,
        h('span', { class: 'ze-spacer' }),
        h('button', { class: 'ze-btn', type: 'button', onclick: () => finish('cancel') }, 'Cancel'),
        h('button', { class: 'ze-btn ze-primary', type: 'button', onclick: () => finish('save') }, 'Save')));
    const container = host();
    container.appendChild(bar);

    function place() {
      const anchor = (inline ? field : target.el || field).getBoundingClientRect();
      const origin = fixedOrigin(container);
      const width = Math.min(380, window.innerWidth - 24);
      const below = anchor.bottom + 8 + bar.offsetHeight < window.innerHeight;
      bar.style.width = `${width}px`;
      bar.style.left = `${Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)) - origin.left}px`;
      bar.style.top = `${(below ? anchor.bottom + 8 : Math.max(12, anchor.top - 8 - bar.offsetHeight)) - origin.top}px`;
    }

    function check(text) {
      if (!normalize(text)) return "Text can't be empty.";
      if (!samePlaceholders(key, text)) return `Keep ${names.map(n => `{${n}}`).join(' ') || 'the text without {placeholders}'} exactly: the site fills ${names.length > 1 ? 'them' : 'it'} in.`;
      return '';
    }

    let frame = 0;
    function onInput() {
      const text = read();
      error.hidden = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { store.preview(key, text); place(); });
    }

    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish('cancel'); }
      else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); finish('save'); }
    }

    function onPaste(event) {
      if (PLAINTEXT || !inline) return;
      event.preventDefault();
      document.execCommand('insertText', false, (event.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' '));
    }

    // Close the field and put the page's own text node back, then let the store update it.
    function close() {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      bar.remove();
      if (inline) {
        field.replaceWith(node);
        lead.remove();
        trail.remove();
      }
      session = null;
      if (inline && node.parentElement) node.parentElement.focus?.({ preventScroll: true });
    }

    function finish(action) {
      if (action === 'save') {
        const text = read();
        const problem = check(text);
        if (problem) {
          error.textContent = problem;
          error.hidden = false;
          place();
          field.focus();
          return;
        }
        close();
        store.set(key, text);
      } else if (action === 'reset') {
        close();
        store.reset(key);
      } else {
        close();
        store.endPreview();
      }
      panel.sync();
    }

    field.addEventListener('input', onInput);
    field.addEventListener('keydown', onKey);
    field.addEventListener('paste', onPaste);
    bar.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); finish('cancel'); } });
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    place();

    // Put the caret in the field with its text selected, ready to type over. Some browsers can't edit
    // text inside a button; there the text is edited in the bar instead.
    field.focus({ preventScroll: true });
    if (inline && document.activeElement !== field) {
      close();
      return openSession(target, true);
    }
    if (inline) {
      const range = document.createRange();
      range.selectNodeContents(field);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } else field.select();

    return {
      cancel: () => finish('cancel'),
      dirty: () => normalize(read()) !== normalize(original),
      contains: el => field.contains(el) || bar.contains(el),
      nudge() {
        bar.classList.remove('ze-nudge');
        void bar.offsetWidth;
        bar.classList.add('ze-nudge');
        field.focus();
      },
    };
  }

  function open(target) {
    if (session) {
      if (session.dirty()) { session.nudge(); return; }
      session.cancel();
    }
    highlight.hidden = true;
    session = openSession(target);
  }

  /* ------------------------------------------------------------------ pointer handling in edit mode */

  let hoverFrame = 0;
  function onPointerMove(event) {
    if (!editing || session) return;
    cancelAnimationFrame(hoverFrame);
    hoverFrame = requestAnimationFrame(() => {
      const target = event.altKey ? null : targetAt(event);
      if (!target) { highlight.hidden = true; return; }
      const rects = rectsOf(target);
      const box = rects.reduce((a, r) => ({
        left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom),
      }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
      Object.assign(highlight.style, {
        left: `${box.left - 3}px`, top: `${box.top - 2}px`, width: `${box.right - box.left + 6}px`, height: `${box.bottom - box.top + 4}px`,
      });
      highlight.dataset.state = stateOf(target.binding.key) || 'default';
      highlight.hidden = false;
    });
  }

  // Edit mode takes clicks on text before the page sees them, so a button label can be edited without
  // pressing the button. Clicks elsewhere, and Alt-clicks, reach the page as usual.
  function intercept(event) {
    if (!editing || event.altKey) return;
    const el = event.target instanceof Element ? event.target : null;
    if (session && el && session.contains(el)) {
      if (el.closest('.ze-field')) {
        // Typing in a field inside a button or link: keep the page from reacting, but let the caret move.
        event.stopImmediatePropagation();
        if (event.type === 'click') event.preventDefault();
      }
      return;
    }
    if (!el || el.closest('.ze-ui')) return;
    const target = targetAt(event);
    if (!target) return;
    event.stopImmediatePropagation();
    if (event.type !== 'pointerdown' || event.pointerType === 'mouse') event.preventDefault();
    if (event.type === 'click') open(target);
  }

  ['pointerdown', 'mousedown', 'click', 'dblclick', 'dragstart'].forEach(type => window.addEventListener(type, intercept, true));
  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('scroll', () => { highlight.hidden = true; }, true);

  /* ------------------------------------------------------------------ the "All text" panel */

  const panel = (() => {
    const search = h('input', { class: 'ze-search', type: 'search', placeholder: 'Search text', 'aria-label': 'Search text', oninput: () => render() });
    const scopeButtons = [['page', 'On this page'], ['changed', 'Changed']].map(([value, label]) =>
      h('button', { type: 'button', 'data-scope': value, 'aria-pressed': String(value === 'page'), onclick: () => { scope = value; render(); } }, label));
    const rows = h('ol', { class: 'ze-rows' });
    const empty = h('p', { class: 'ze-empty', hidden: true });
    const status = h('p', { class: 'ze-status', role: 'status' });
    const message = h('p', { class: 'ze-message', role: 'alert', hidden: true });
    const publishButton = h('button', { class: 'ze-btn ze-primary', type: 'button', onclick: () => publish() }, 'Publish');
    const discardButton = h('button', { class: 'ze-btn', type: 'button', onclick: () => discard() }, 'Discard drafts');
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: () => importFile() });
    const closeButton = h('button', { class: 'ze-btn ze-icon', type: 'button', 'aria-label': 'Close', onclick: () => hide() }, '×');
    const el = h('aside', { class: 'ze-panel ze-ui', 'aria-label': 'All text', 'data-noedit': true, hidden: true },
      h('header', { class: 'ze-panel-head' },
        h('div', {}, h('h2', {}, 'All text'), h('p', {}, 'Every text on this page, by its default wording. The same text anywhere shares one entry.')),
        closeButton),
      h('div', { class: 'ze-filters' }, search, h('div', { class: 'ze-scope', role: 'group', 'aria-label': 'Show' }, scopeButtons)),
      rows, empty,
      h('footer', { class: 'ze-panel-foot' },
        status, message,
        h('div', { class: 'ze-actions' }, discardButton, h('span', { class: 'ze-spacer' }), publishButton),
        h('div', { class: 'ze-actions ze-secondary' },
          h('button', { class: 'ze-btn ze-link', type: 'button', onclick: () => exportFile() }, 'Export JSON'),
          h('button', { class: 'ze-btn ze-link', type: 'button', onclick: () => fileInput.click() }, 'Import JSON'),
          fileInput)));
    ui.appendChild(el);

    let scope = 'page';
    let onPage = new Map(); // key -> number of places on this page

    function entries() {
      const keys = scope === 'page' ? [...onPage.keys()] : store.keys();
      const query = normalize(search.value).toLowerCase();
      return keys.filter(key => !query || key.toLowerCase().includes(query) || store.get(key).toLowerCase().includes(query));
    }

    function row(key) {
      const input = h('textarea', { class: 'ze-input', rows: 1, spellcheck: 'false', 'aria-label': key, value: store.get(key) });
      const error = h('p', { class: 'ze-error', role: 'alert', hidden: true });
      const state = stateOf(key);
      const commit = () => {
        const text = input.value;
        if (normalize(text) === normalize(store.saved(key))) { store.endPreview(); return; }
        const problem = !normalize(text) ? "Text can't be empty." : samePlaceholders(key, text) ? '' : 'Keep the {placeholders} of the default text.';
        if (problem) { error.textContent = problem; error.hidden = false; return; }
        error.hidden = true;
        store.set(key, text);
      };
      input.addEventListener('input', () => store.preview(key, input.value));
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); input.blur(); }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); input.value = store.saved(key); store.endPreview(); input.blur(); }
      });
      input.addEventListener('change', commit);
      input.addEventListener('blur', commit);
      input.addEventListener('focus', () => locate(key, false));
      const count = onPage.get(key);
      return h('li', { class: 'ze-row', 'data-key': key, 'data-state': state || 'default' },
        h('div', { class: 'ze-row-head' },
          h('span', { class: 'ze-key', title: key }, key),
          count ? h('button', { class: 'ze-count', type: 'button', title: 'Show on the page', onclick: () => locate(key, true) }, `${count}×`) : null,
          h('span', { class: `ze-tag ze-tag-${state || 'default'}` }, STATE_LABEL[state])),
        input, error,
        state ? h('div', { class: 'ze-row-actions' },
          store.isDraft(key) ? h('button', { class: 'ze-btn ze-link', type: 'button', onclick: () => store.discard([key]) }, 'Undo draft') : null,
          store.isChanged(key) ? h('button', { class: 'ze-btn ze-link', type: 'button', onclick: () => store.reset(key) }, 'Reset to default') : null) : null);
    }

    function render() {
      scopeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scope === scope)));
      const list = entries();
      rows.replaceChildren(...list.slice(0, MAX_ROWS).map(row));
      empty.hidden = list.length > 0 && list.length <= MAX_ROWS;
      empty.textContent = list.length ? `Showing ${MAX_ROWS} of ${list.length}. Search to find the rest.` : scope === 'page' ? 'No text matches.' : 'No changes yet.';
      sync();
    }

    // Keep rows and buttons in step with the store, without disturbing a row being typed in.
    function sync() {
      updateBadge();
      const n = store.draftCount();
      status.textContent = n ? `${plural(n, 'unpublished change', 'unpublished changes')}, kept in this browser.` : 'Everything is published.';
      publishButton.disabled = discardButton.disabled = n === 0;
      if (el.hidden) return;
      rows.querySelectorAll('.ze-row').forEach(li => {
        if (li.contains(document.activeElement)) return;
        const key = li.dataset.key;
        if (li.dataset.state !== (stateOf(key) || 'default') || li.querySelector('textarea').value !== store.get(key)) li.replaceWith(row(key));
      });
    }

    // Scroll to the first place showing a key and flash every place on screen.
    function locate(key, scroll) {
      const places = binder.collect().filter(f => f.binding.key === key && f.kind === 'text');
      if (!places.length) return;
      const first = places[0].target.parentElement;
      if (scroll) first.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      places.forEach(p => {
        const target = p.target.parentElement;
        target.classList.remove('ze-flash');
        void target.offsetWidth;
        target.classList.add('ze-flash');
        setTimeout(() => target.classList.remove('ze-flash'), 1400);
      });
    }

    function say(text) {
      message.textContent = text;
      message.hidden = !text;
    }

    async function publish() {
      say('');
      publishButton.disabled = true;
      try {
        const response = await fetch(ZT.config.api, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
          body: JSON.stringify(store.pending()),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `The server answered ${response.status}.`);
        store.published(data.texts || {});
        say('Published: every visitor now sees these texts.');
      } catch (error) {
        say(`Not published. ${error.message}`);
      } finally {
        sync();
      }
    }

    function discard() {
      const n = store.draftCount();
      if (n && window.confirm(`Discard ${plural(n, 'unpublished change', 'unpublished changes')}?`)) store.discard();
    }

    function exportFile() {
      const data = { format: 'zema-text', version: 1, exported: new Date().toISOString(), texts: store.effective() };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = h('a', { href: url, download: `zema-text-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function importFile() {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const texts = data && typeof data.texts === 'object' ? data.texts : data;
        if (!texts || typeof texts !== 'object' || Array.isArray(texts)) throw new Error('This is not a text export.');
        const { added, skipped } = store.import(texts);
        say(`Imported ${plural(added, 'text', 'texts')} as drafts${skipped ? `, skipped ${skipped} that lost a {placeholder} or were empty` : ''}. Publish to make them live.`);
        scope = 'changed';
        render();
      } catch (error) {
        say(`Not imported. ${error.message}`);
      }
    }

    function show() {
      onPage = new Map();
      binder.collect().forEach(({ binding }) => onPage.set(binding.key, (onPage.get(binding.key) || 0) + 1));
      el.hidden = false;
      listButton.setAttribute('aria-expanded', 'true');
      render();
      search.focus();
    }

    function hide() {
      el.hidden = true;
      listButton.setAttribute('aria-expanded', 'false');
      listButton.focus();
    }

    el.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.defaultPrevented) hide(); });
    return { toggle: () => (el.hidden ? show() : hide()), sync };
  })();

  store.subscribe(() => panel.sync());

  function start() {
    document.body.appendChild(ui);
    listButton.setAttribute('aria-expanded', 'false');
    setEditing(recall(MODE) === '1');
    panel.sync();
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
