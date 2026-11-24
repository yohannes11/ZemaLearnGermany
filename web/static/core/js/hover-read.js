/* Point to hear, on every page: rest the mouse on German text to hear it and see what it means. A short
   German text (a word card, an example, a chip, a phrase on the landing page) is read whole; in a longer one,
   the single word under the pointer. Meanings come from the course vocabulary and reading glossaries
   (static/core/hover-words.json, built by tools/course_content.py), in the page's language.

   base.html loads this in <head> on every page. A page can steer it through window.ZemaHoverRead:
   `allowed()` to stay quiet at times (the course does during exercises, where it would give answers away)
   and `speak(text)` to use its own player. Learners switch it off in the course's settings ("hover-read").

   Nouns show their gender: pointing at one (on its own or inside a sentence) marks it, with the article in
   front of it, in the gender's colour (der blue, die rose, das green, plural plum; zema.css), and the tooltip
   names the gender in words. */
(function () {
  'use strict';

  const script = document.currentScript;
  const WORDS_URL = script.dataset.words;
  const AUDIO_BASE = script.dataset.audio;
  const DWELL = 350; // ms on one word before it is read, so sweeping across a page stays quiet
  const WHOLE = 6;   // German texts up to this many words are read whole, longer ones word by word
  const GERMAN = '[lang|="de"], .de, .ex-de, .reading-de, .vc-word, .wv-word, .sp-word, .glossary dt, td.form';
  const WORD_CHAR = /[\p{L}ß-]/u;
  // Words that may stand before a noun and are marked with it ("den Kaffee", "meine Mutter").
  const DETERMINER = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|kein|keine|keinen|keinem|keiner|keines|mein|meine|meinen|meinem|meiner|dein|deine|deinen|deinem|deiner|sein|seine|seinen|seinem|seiner|ihr|ihre|ihren|ihrem|ihrer|unser|unsere|unseren|unserem|unserer|euer|eure|euren|eurem|eurer|Ihr|Ihre|Ihren|Ihrem|Ihrer)$/i;
  // The gender names, in the page's language (base.html passes them translated).
  const GENDER_NAMES = { der: script.dataset.der, die: script.dataset.die, das: script.dataset.das, plural: script.dataset.plural };

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
  // German noun (with or without its article, any case of letters) -> { gender, german: "der Kaffee" }.
  const genders = new Map();
  let words = null;

  function loadWords() {
    if (!words) {
      words = fetch(WORDS_URL).then(r => r.json()).then(entries => {
        const amharic = document.documentElement.lang === 'am';
        entries.forEach(([german, english, am, gender]) => {
          const text = (amharic && am) || english;
          const plain = bare(german);
          const noun = english.startsWith('the ') && plain.replace(/^(der|die|das) /, '');
          // "danke / danke schön": each form on its own too.
          const forms = german.includes(' / ') ? german.split(' / ').map(bare) : [];
          [clean(german), plain, noun, ...forms].forEach(key => { if (key && !meanings.has(key)) meanings.set(key, text); });
          if (gender) {
            const found = { gender, german: clean(german) };
            [plain, plain.replace(/^(der|die|das) /, '')].forEach(key => { if (!genders.has(key)) genders.set(key, found); });
          }
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

  // The gender of a noun ("Kaffee", "der Kaffee", "den Kaffee"), or null.
  function genderOf(text) {
    const plain = bare(text);
    return genders.get(plain) || genders.get(plain.replace(/^\S+ /, '')) || null;
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
    return { key: node, sub: `${start}:${end}`, node, start, end, text: text.slice(start, end), box };
  }

  // The noun under the pointer, if it is one the course knows, as a range taking in the word before it when
  // that is an article or possessive ("den Kaffee"): { gender, german, range, sub }.
  function nounAt(x, y, within) {
    const word = wordAt(x, y);
    if (!word || (within && !within.contains(word.node)) || !/^\p{Lu}/u.test(word.text)) return null;
    const found = genderOf(word.text);
    if (!found) return null;
    const text = word.node.nodeValue;
    let start = word.start;
    const before = /(\S+)\s+$/u.exec(text.slice(0, start));
    if (before && DETERMINER.test(before[1])) start = before.index;
    const range = document.createRange();
    range.setStart(word.node, start);
    range.setEnd(word.node, word.end);
    return { ...found, range, sub: `${start}:${word.end}` };
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
      if (text.split(' ').length <= WHOLE) {
        // A noun on its own (a word card) is the noun; in a short sentence, the noun under the pointer.
        const own = genderOf(text);
        return { key: german, el: german, text, box: german.getBoundingClientRect(),
          noun: own ? { ...own, sub: 'all' } : nounAt(event.clientX, event.clientY, german) };
      }
      const word = wordAt(event.clientX, event.clientY);
      if (!word || !german.contains(word.node)) return null;
      return { ...word, noun: nounAt(event.clientX, event.clientY, german) };
    }
    if (target.childElementCount === 0 && meanings.has(clean(target.textContent))) {
      const text = clean(target.textContent), own = genderOf(text);
      return { key: target, el: target, text, box: target.getBoundingClientRect(), noun: own && { ...own, sub: 'all' } };
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

  // A noun inside a text is marked with the CSS Custom Highlight API (no change to the page's markup);
  // browsers without it still show the gender in the tooltip.
  const highlights = window.CSS?.highlights && window.Highlight ? CSS.highlights : null;
  function unmark() {
    if (current?.el) { current.el.classList.remove('hover-reading'); delete current.el.dataset.hoverGender; }
    if (highlights) Object.keys(GENDER_NAMES).forEach(g => highlights.delete(`gender-${g}`));
  }
  function mark(unit) {
    if (unit.el && unit.noun?.sub === 'all') unit.el.dataset.hoverGender = unit.noun.gender;
    if (unit.el) unit.el.classList.add('hover-reading');
    if (unit.noun?.range && highlights) highlights.set(`gender-${unit.noun.gender}`, new Highlight(unit.noun.range));
  }

  let current = null, timer = 0;
  function hide() {
    clearTimeout(timer);
    unmark();
    current = null;
    if (tip) tip.hidden = true;
  }

  function span(className, text) {
    const node = document.createElement('span');
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // The noun with its article, in its colour, and its gender in words: "der Kaffee · masculine".
  function genderLine(noun, withWord) {
    const line = span('hover-tip-gender');
    line.dataset.gender = noun.gender;
    if (withWord) {
      const word = span('hover-tip-noun', noun.german);
      word.lang = 'de';
      line.append(word, ' · ');
    }
    line.append(GENDER_NAMES[noun.gender] || noun.gender);
    return line;
  }

  function fill(unit) {
    const box = tooltip();
    const german = span('hover-tip-de', unit.text);
    german.lang = 'de';
    // The text itself is the noun ("der Kaffee"): it takes the colour; otherwise the noun gets its own line.
    const whole = unit.noun && (unit.noun.sub === 'all' || bare(unit.text) === bare(unit.noun.german));
    if (whole) german.dataset.gender = unit.noun.gender;
    box.replaceChildren(german);
    if (unit.noun) box.appendChild(genderLine(unit.noun, !whole));
    const translation = lookup(unit.text);
    if (translation) box.appendChild(span('hover-tip-meaning', translation));
  }

  function show(unit) {
    fill(unit);
    mark(unit);
    tip.hidden = false;
    place(unit.box);
    speakAloud(unit.text);
  }

  // Moving to another noun inside the same sentence: mark it and name its gender, without reading again.
  function moveNoun(unit) {
    unmark();
    current.noun = unit.noun;
    if (tip?.hidden !== false) return; // not shown yet: show() will use the new noun
    fill(current);
    mark(current);
    place(current.box);
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
    if (unit && current && unit.key === current.key && unit.sub === current.sub) {
      if (unit.noun?.sub !== current.noun?.sub) moveNoun(unit);
      return;
    }
    hide();
    if (!unit) return;
    current = unit;
    timer = setTimeout(() => loadWords().then(() => {
      if (current !== unit) return;
      // The first time, the words may have arrived only now.
      if (!unit.noun && unit.el && genderOf(unit.text)) unit.noun = { ...genderOf(unit.text), sub: 'all' };
      show(unit);
    }), DWELL);
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
