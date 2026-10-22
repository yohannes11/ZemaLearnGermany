/* Point to hear, on every page: rest the mouse on German text to hear it and see what it means. A short
   German text (a word card, an example, a chip, a phrase on the landing page) is read whole; in a longer one,
   the single word under the pointer. Meanings come from the course vocabulary and reading glossaries
   (static/core/hover-words.json, built by tools/course_content.py), in the page's language.

   base.html loads this in <head> on every page. A page can steer it through window.ZemaHoverRead:
   `allowed()` to stay quiet at times (the course does during exercises, where it would give answers away)
   and `speak(text)` to use its own player. Learners switch it off in the course's settings ("hover-read"). */
(function () {
  'use strict';

  const script = document.currentScript;
  const WORDS_URL = script.dataset.words;
  const AUDIO_BASE = script.dataset.audio;
  const DWELL = 350; // ms on one word before it is read, so sweeping across a page stays quiet
  const WHOLE = 6;   // German texts up to this many words are read whole, longer ones word by word
  const GERMAN = '[lang|="de"], .de, .ex-de, .reading-de, .vc-word, .wv-word, .sp-word, .glossary dt, td.form';
  const WORD_CHAR = /[\p{L}ß-]/u;

  const clean = text => text.replace(/\s+/g, ' ').trim();
  const bare = text => clean(text).replace(/[.,!?;:…"“”„()]/g, '').trim().toLowerCase();
  const saved = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  };
  const hooks = () => window.ZemaHoverRead || {};

  /* ---------------------------------------------------------------- meanings */

  // German -> meaning. Also found without capitals or punctuation ("hallo"), nouns without their article
  // ("Name"; the English starts with "the"), and verbs by their stem ("kommt", "heißt" -> kommen, heißen).
  const meanings = new Map();
  const stems = new Map();
  let words = null;

  function loadWords() {
    if (!words) {
      words = fetch(WORDS_URL).then(r => r.json()).then(entries => {
        const amharic = document.documentElement.lang === 'am';
        entries.forEach(([german, english, am]) => {
          const text = (amharic && am) || english;
          const plain = bare(german);
          const noun = english.startsWith('the ') && plain.replace(/^(der|die|das) /, '');
          // "danke / danke schön": each form on its own too.
          const forms = german.includes(' / ') ? german.split(' / ').map(bare) : [];
          [clean(german), plain, noun, ...forms].forEach(key => { if (key && !meanings.has(key)) meanings.set(key, text); });
          if (english.startsWith('to ') && /^[a-zäöüß]+n$/.test(german)) stems.set(german.replace(/e?n$/, ''), text);
        });
      }).catch(() => {});
    }
    return words;
  }

  function lookup(text) {
    const plain = bare(text);
    return meanings.get(clean(text)) || meanings.get(plain) || stems.get(plain.replace(/(est|st|et|en|t|e)$/, '')) || '';
  }

  /* ---------------------------------------------------------------- the voice */

  // Only the human recordings (the voice and speed chosen in the course's settings), never the browser's
  // computer voice: tools/gen_course_audio.py records every text pointing can read (tools/hover_texts.py).
  let clips = null, audio = null;
  function speakAloud(text) {
    clips = clips || fetch(`${AUDIO_BASE}manifest.json`, { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}));
    clips.then(ids => {
      const id = ids[text];
      if (!id || current?.text !== text) return;
      if (hooks().speak) return hooks().speak(text);
      if (audio) audio.pause();
      audio = new Audio(`${AUDIO_BASE}${saved('book-voice', 'katja')}/${saved('book-pace', 'normal')}/${id}.mp3`);
      audio.play().catch(() => {});
    });
  }

  /* ---------------------------------------------------------------- what the pointer is on */

  // The German word at a point inside a longer text: its text and where it is on screen.
  function wordAt(x, y) {
    const caret = document.caretPositionFromPoint?.(x, y);
    const range = caret ? document.createRange() : document.caretRangeFromPoint?.(x, y);
    if (caret) range.setStart(caret.offsetNode, caret.offset);
    const node = range?.startContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.nodeValue;
    let start = range.startOffset, end = range.startOffset;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (end < text.length && WORD_CHAR.test(text[end])) end++;
    if (end - start < 2) return null;
    const word = document.createRange();
    word.setStart(node, start);
    word.setEnd(node, end);
    const box = word.getBoundingClientRect();
    if (x < box.left - 2 || x > box.right + 2 || y < box.top - 2 || y > box.bottom + 2) return null;
    return { key: node, sub: `${start}:${end}`, node, text: text.slice(start, end), box };
  }

  // A German element read whole, a word inside a longer German text, or any short text that is a German
  // phrase from the course (match tiles, answer options).
  function unitAt(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('input, textarea, select, [contenteditable], .ze-ui, .hover-tip')) return null;
    const german = target.closest(GERMAN);
    if (german && german !== document.documentElement) {
      const text = clean(german.textContent);
      if (!text) return null;
      if (text.split(' ').length <= WHOLE) return { key: german, el: german, text, box: german.getBoundingClientRect() };
      const word = wordAt(event.clientX, event.clientY);
      return word && german.contains(word.node) ? word : null;
    }
    if (target.childElementCount === 0 && meanings.has(clean(target.textContent))) {
      return { key: target, el: target, text: clean(target.textContent), box: target.getBoundingClientRect() };
    }
    return null;
  }

  /* ---------------------------------------------------------------- the tooltip */

  let tip = null;
  function tooltip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'hover-tip';
      tip.setAttribute('role', 'tooltip');
      tip.dataset.noedit = '';
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }

  function place(box) {
    const width = tip.offsetWidth, height = tip.offsetHeight;
    tip.style.left = `${Math.max(8, Math.min(box.left + box.width / 2 - width / 2, window.innerWidth - width - 8))}px`;
    tip.style.top = `${box.top - height - 8 >= 8 ? box.top - height - 8 : box.bottom + 8}px`;
  }

  let current = null, timer = 0;
  function hide() {
    clearTimeout(timer);
    if (current?.el) current.el.classList.remove('hover-reading');
    current = null;
    if (tip) tip.hidden = true;
  }

  function show(unit) {
    const box = tooltip();
    const german = document.createElement('span');
    german.className = 'hover-tip-de';
    german.lang = 'de';
    german.textContent = unit.text;
    box.replaceChildren(german);
    const translation = lookup(unit.text);
    if (translation) {
      const meaning = document.createElement('span');
      meaning.className = 'hover-tip-meaning';
      meaning.textContent = translation;
      box.appendChild(meaning);
    }
    if (unit.el) unit.el.classList.add('hover-reading');
    box.hidden = false;
    place(unit.box);
    speakAloud(unit.text);
  }

  /* ---------------------------------------------------------------- wiring */

  let enabled = saved('hover-read', true);
  // Mouse and trackpad only, checked per movement so touch-screen laptops work too; on touch screens the
  // speaker buttons do the same.
  const active = event => enabled && event.pointerType === 'mouse'
    && !document.documentElement.classList.contains('ze-editing') && (hooks().allowed?.() ?? true);

  document.addEventListener('pointermove', event => {
    if (!active(event)) { if (current) hide(); return; }
    loadWords();
    const unit = unitAt(event);
    if (unit && current && unit.key === current.key && unit.sub === current.sub) return;
    hide();
    if (!unit) return;
    current = unit;
    timer = setTimeout(() => loadWords().then(() => { if (current === unit) show(unit); }), DWELL);
  }, { passive: true });
  ['pointerdown', 'scroll', 'blur'].forEach(type => window.addEventListener(type, () => { if (current) hide(); }, true));

  window.hoverRead = {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      try { localStorage.setItem('hover-read', JSON.stringify(on)); } catch (e) { /* not kept */ }
      if (!on) hide();
    },
    lookup,
  };
})();
