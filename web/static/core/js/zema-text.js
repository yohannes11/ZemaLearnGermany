/* Site text, part 1: one store for every piece of text the site shows, and the binding that keeps the page in
   step with it. base.html loads this in <head> wherever an admin has changed some text or an admin is signed
   in (see apps/content).

   A text's key is its default wording as shown, whitespace collapsed: the convention of locale/<lang>.json,
   where the English text is the key. The same words anywhere on the site share one key and one value, so a
   change shows everywhere at once. Interface strings with {placeholders} are keyed by their template:
   "12 words" and "3 words" both belong to "{count} words", and an edit changes the wording, not the numbers.

   Values come in layers: the published changes (from the server), an admin's unpublished drafts (kept in
   localStorage) and, while the admin types, a live preview. The binder keeps every text node and text
   attribute showing its key's value; a MutationObserver catches whatever the page's scripts render later,
   so the pages themselves need no changes. The editor (zema-text-editor.js) is built on window.ZemaText. */
(function () {
  'use strict';

  const configEl = document.getElementById('zema-text');
  if (!configEl) return;
  const CONFIG = JSON.parse(configEl.textContent);

  const PLACEHOLDERS = /\{(\w+)\}/g;
  const HAS_PLACEHOLDER = /\{\w+\}/;
  const LETTER = /\p{L}/u;
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  const placeholders = text => [...new Set(Array.from(text.matchAll(PLACEHOLDERS), m => m[1]))].sort();
  const samePlaceholders = (a, b) => placeholders(a).join() === placeholders(b).join();
  const fill = (text, values) => (values ? text.replace(PLACEHOLDERS, (m, k) => (k in values ? values[k] : m)) : text);

  /* ------------------------------------------------------------------ the store (single source of truth) */

  const DRAFTS = 'zema-text-drafts';

  function readDrafts() {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFTS) || '{}');
      return Object.fromEntries(Object.entries(saved || {}).filter(([, v]) => v === null || typeof v === 'string'));
    } catch (e) {
      return {};
    }
  }

  function writeDrafts(drafts) {
    try {
      if (Object.keys(drafts).length) localStorage.setItem(DRAFTS, JSON.stringify(drafts));
      else localStorage.removeItem(DRAFTS);
    } catch (e) { /* storage blocked: drafts last until the page closes */ }
  }

  function createStore(published, canEdit) {
    let live = { ...published };              // key -> published text
    let drafts = canEdit ? readDrafts() : {};   // key -> unpublished text, or null for "back to the default"
    let preview = null;                         // { key, text } while an admin types
    const listeners = new Set();
    // Listeners get the keys whose value changed, or null when any may have.
    const emit = keys => listeners.forEach(fn => fn(keys));
    const stored = key => (key in drafts ? drafts[key] : live[key]);
    const save = keys => { writeDrafts(drafts); emit(keys); };

    return {
      /* The text shown for a key. */
      get(key) {
        if (preview && preview.key === key) return preview.text;
        return stored(key) ?? key;
      },
      /* The saved text for a key, ignoring the preview. */
      saved: key => stored(key) ?? key,
      isChanged: key => (stored(key) ?? key) !== key,
      isDraft: key => key in drafts,
      isPublished: key => key in live,
      draftCount: () => Object.keys(drafts).length,
      previewKey: () => (preview ? preview.key : null),

      /* Every key that has a published change or a draft. */
      keys: () => [...new Set([...Object.keys(live), ...Object.keys(drafts)])],

      /* What is in effect, published and drafts together: the export, and what a publish leaves behind. */
      effective() {
        const out = {};
        this.keys().forEach(key => { if (this.isChanged(key)) out[key] = stored(key); });
        return out;
      },

      /* Save a text as a draft. Saving the default wording resets the key. */
      set(key, text) {
        text = normalize(text);
        if (text === (live[key] ?? key)) delete drafts[key];
        else drafts[key] = text === key ? null : text;
        preview = null;
        save(new Set([key]));
      },
      reset(key) { this.set(key, key); },

      /* Drop drafts (all, or the given keys) and show the published text again. */
      discard(keys = Object.keys(drafts)) {
        keys.forEach(key => delete drafts[key]);
        save(new Set(keys));
      },

      /* Show a text everywhere without saving it: the live preview while typing. */
      preview(key, text) {
        preview = { key, text: normalize(text) || key };
        emit(new Set([key]));
      },
      endPreview() {
        if (!preview) return;
        const key = preview.key;
        preview = null;
        emit(new Set([key]));
      },

      /* The drafts as a publish request: {set: {key: text}, reset: [key]}. */
      pending() {
        const set = {}, reset = [];
        Object.entries(drafts).forEach(([key, text]) => (text === null ? reset.push(key) : (set[key] = text)));
        return { set, reset };
      },

      /* The server's texts after a publish: they replace the published layer and the drafts. */
      published(texts) {
        live = { ...texts };
        drafts = {};
        save(null);
      },

      /* Take an exported {key: text} map as drafts. Texts that drop a {placeholder} are skipped. */
      import(texts) {
        let added = 0, skipped = 0;
        Object.entries(texts).forEach(([key, text]) => {
          key = typeof key === 'string' ? normalize(key) : '';
          if (!key || typeof text !== 'string' || !normalize(text) || !samePlaceholders(key, text)) { skipped++; return; }
          text = normalize(text);
          if (text === (live[key] ?? key)) delete drafts[key];
          else drafts[key] = text === key ? null : text;
          added++;
        });
        save(null);
        return { added, skipped };
      },

      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
  }

  /* ------------------------------------------------------------------ the binder (page <-> store) */

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'TEMPLATE']);
  const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];
  const EMAIL = /^\S+@\S+\.\S+$/;
  const leading = text => text.match(/^\s*/)[0];
  const trailing = text => text.match(/\s*$/)[0];

  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const letters = text => (text.match(/\p{L}/gu) || []).length;

  // "{count} words" as patterns that recognise it filled in: "12 words". A page may also wrap a value in
  // markup, as in "<strong>{known}</strong> of {total} words learned", which leaves the text " of 80 words
  // learned" in a node of its own; so the parts of a template that run from a placeholder to its end (or
  // from its start to a placeholder) are recognised too, as long as they hold a placeholder and real words.
  // A part records the placeholders around it (from, to), so it can be cut out of a reworded template.
  function compile(template, key) {
    const parts = normalize(template).split(/(\{\w+\})/); // literal, {name}, literal, …
    const last = parts.length - 1;
    const patterns = [];
    for (let start = 0; start <= last; start += 2) {
      for (let end = start; end <= last; end += 2) {
        const whole = start === 0 && end === last;
        const slice = parts.slice(start, end + 1);
        const names = slice.filter((part, i) => i % 2).map(part => part.slice(1, -1));
        const literal = slice.filter((part, i) => !(i % 2)).join('');
        if (whole ? !LETTER.test(literal) : !names.length || letters(literal) < 6) continue;
        const pieces = normalize(slice.join('')).split(/(\{\w+\})/);
        const anchor = pieces.filter((part, i) => !(i % 2)).reduce((a, b) => (b.length > a.length ? b : a), '');
        const source = pieces.map((part, i) => (i % 2 ? '(.+?)' : escape(part))).join('');
        patterns.push({
          key, names, anchor, size: literal.length + (whole ? 0.5 : 0), re: new RegExp(`^${source}$`, 'su'),
          from: start ? parts[start - 1] : null, to: end < last ? parts[end + 1] : null,
        });
      }
    }
    return patterns;
  }

  // The part of a (possibly reworded) template between two of its placeholders.
  function cut(text, from, to) {
    if (from && text.includes(from)) text = text.slice(text.indexOf(from) + from.length);
    if (to && text.includes(to)) text = text.slice(0, text.indexOf(to));
    return normalize(text);
  }

  // Texts to recognise, as [text, key] pairs: a lookup for plain text and patterns for templates.
  function buildIndex(pairs) {
    const literal = new Map(), patterns = [];
    pairs.forEach(([text, key]) => {
      if (HAS_PLACEHOLDER.test(text)) patterns.push(...compile(text, key));
      else literal.set(normalize(text), key);
    });
    patterns.sort((a, b) => b.size - a.size);
    return { literal, patterns };
  }

  function lookup(text, index) {
    const key = index.literal.get(text);
    if (key !== undefined) return { key, values: null };
    for (const p of index.patterns) {
      if (!text.includes(p.anchor)) continue;
      const m = p.re.exec(text);
      if (m) {
        const values = Object.fromEntries(p.names.map((name, i) => [name, m[i + 1]]));
        return p.from || p.to ? { key: p.key, values, from: p.from, to: p.to } : { key: p.key, values };
      }
    }
    return null;
  }

  function createBinder(store, templates) {
    // A text node's or attribute's binding: its key, the values its {placeholders} were filled with, the
    // text as the page rendered it (raw) and as the binder last set it (shown).
    const textBindings = new WeakMap();
    const attrBindings = new WeakMap(); // element -> { attribute name -> binding }
    const templateIndex = buildIndex(templates.map(t => [t, normalize(t)]));
    let active = buildIndex([]);

    // Only changed keys need applying; recognise them by their default and by their changed text, which
    // the server has already rendered into its own pages.
    function rebuild() {
      const pairs = [];
      store.keys().forEach(key => {
        if (!store.isChanged(key)) return;
        pairs.push([key, key], [store.saved(key), key]);
      });
      const previewing = store.previewKey();
      if (previewing) pairs.push([previewing, previewing]);
      active = buildIndex(pairs);
    }

    const skipped = el => !el || SKIP.has(el.tagName) || el.closest('[data-noedit], .ze-ui') !== null;

    function shownText(binding) {
      const template = store.get(binding.key);
      const value = fill(binding.from || binding.to ? cut(template, binding.from, binding.to) : template, binding.values);
      return normalize(binding.raw) === value ? binding.raw : leading(binding.raw) + value + trailing(binding.raw);
    }

    // Bind a text to a key: from the changed keys (forEdit false), or for the editor, where any text is
    // editable and plain text is its own key.
    function match(raw, forEdit) {
      if (!LETTER.test(raw)) return null;
      const text = normalize(raw);
      const found = lookup(text, active) || (forEdit ? lookup(text, templateIndex) || { key: text, values: null } : null);
      return found && !EMAIL.test(text) ? found : null;
    }

    function visitText(node, keys, forEdit) {
      const raw = node.nodeValue;
      let binding = textBindings.get(node);
      if (binding && binding.shown === raw) {
        if (!keys || keys.has(binding.key)) render(node, binding);
        return binding;
      }
      const found = match(raw, forEdit);
      if (!found || skipped(node.parentElement)) {
        textBindings.delete(node);
        return null;
      }
      binding = { ...found, raw, shown: raw };
      textBindings.set(node, binding);
      render(node, binding);
      return binding;
    }

    function render(node, binding) {
      const text = shownText(binding);
      if (node.nodeValue !== text) node.nodeValue = text;
      binding.shown = text;
    }

    function visitAttr(el, name, keys, forEdit) {
      const raw = el.getAttribute(name);
      if (raw === null) return null;
      const bindings = attrBindings.get(el) || {};
      let binding = bindings[name];
      if (binding && binding.shown === raw) {
        if (!keys || keys.has(binding.key)) renderAttr(el, name, binding);
        return binding;
      }
      const found = match(raw, forEdit);
      if (!found || skipped(el)) {
        delete bindings[name];
        return null;
      }
      binding = { ...found, raw, shown: raw };
      bindings[name] = binding;
      attrBindings.set(el, bindings);
      renderAttr(el, name, binding);
      return binding;
    }

    function renderAttr(el, name, binding) {
      const text = shownText(binding);
      if (el.getAttribute(name) !== text) el.setAttribute(name, text);
      binding.shown = text;
    }

    // Visit every text node and text attribute under root; visit(kind, target, name) gets each one.
    function walk(root, visit) {
      if (root.nodeType === Node.TEXT_NODE) { visit('text', root); return; }
      if (root.nodeType !== Node.ELEMENT_NODE || SKIP.has(root.tagName)) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: n => (n.nodeType === Node.ELEMENT_NODE && SKIP.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      for (let n = root; n; n = walker.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) visit('text', n);
        else ATTRIBUTES.forEach(name => { if (n.hasAttribute(name)) visit('attr', n, name); });
      }
    }

    const apply = (root, keys) => walk(root, (kind, target, name) => (
      kind === 'text' ? visitText(target, keys, false) : visitAttr(target, name, keys, false)));

    function refresh(keys) {
      rebuild();
      apply(document.documentElement, keys);
    }

    const observer = new MutationObserver(records => {
      records.forEach(r => {
        if (r.type === 'childList') r.addedNodes.forEach(n => apply(n, new Set()));
        else if (r.type === 'characterData') visitText(r.target, new Set(), false);
        else if (ATTRIBUTES.includes(r.attributeName)) visitAttr(r.target, r.attributeName, new Set(), false);
      });
    });

    store.subscribe(refresh);
    rebuild();
    apply(document.documentElement, null);
    observer.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES,
    });
    // The parser may still have been filling in text when it was first seen.
    document.addEventListener('DOMContentLoaded', () => refresh(null));

    return {
      refresh,
      /* The binding of a text node or attribute, for editing: any text with a letter has one. */
      bindingFor: node => visitText(node, new Set(), true),
      bindingForAttr: (el, name) => visitAttr(el, name, new Set(), true),

      /* Every text on the page: [{kind, target, name, binding}], text nodes and attributes. */
      collect(root = document.documentElement) {
        const found = [];
        walk(root, (kind, target, name) => {
          const binding = kind === 'text' ? visitText(target, new Set(), true) : visitAttr(target, name, new Set(), true);
          if (binding) found.push({ kind, target, name, binding });
        });
        return found;
      },
    };
  }

  const store = createStore(CONFIG.texts || {}, Boolean(CONFIG.canEdit));
  const binder = createBinder(store, CONFIG.templates || []);
  window.ZemaText = { config: CONFIG, store, binder, normalize, placeholders, samePlaceholders, fill, cut };
})();
