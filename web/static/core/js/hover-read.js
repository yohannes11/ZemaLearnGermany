/* Point to hear, on every page: rest the mouse on German to see its dictionary entry and hear it.

   - On a word: that word only, read aloud, with its entry: the headword (a noun with its article, in its
     gender's colour), pronunciation, part of speech, gender, numbered meanings in English and Amharic and an
     example. A word form finds its headword ("ist" -> sein, "Minuten" -> die Minute) and says so. An article
     and its noun go together ("den Kaffee").
   - On the sentence but not on a word (beside it, between words, on its punctuation): the whole sentence,
     read aloud, with its translation. A text the course knows as one statement ("Wie spät ist es? – Es ist
     neun Uhr.") is read whole; a longer reading text, one sentence at a time.

   Selecting German (with the mouse, or press and hold on a phone) opens the same entry as a card with Listen
   and Close buttons; see "select to look up" below.

   The dictionary is static/core/hover-words.json and static/core/hover-sentences.json, built by
   tools/course_content.py with tools/dictionary.py. Recordings are the human ones (tools/gen_course_audio.py);
   a text without one is read by the browser's German voice.

   base.html loads this in <head> on every page (templates/core/hover_read.html, with the labels in the page's
   language). A page can steer it through window.ZemaHoverRead: `allowed()` to stay quiet at times (the course
   does during exercises, where it would give answers away) and `speak(text)` to use its own player. Learners
   switch pointing off in the course's settings ("hover-read"). */
(function () {
  'use strict';

  const script = document.currentScript;
  const WORDS_URL = script.dataset.words;
  const SENTENCES_URL = script.dataset.sentences;
  const AUDIO_BASE = script.dataset.audio;
  const LABELS = (() => {
    try {
      return JSON.parse(document.getElementById('hover-read-labels').textContent);
    } catch (e) {
      return {};
    }
  })();
  const label = key => LABELS[key] || key;
  const DWELL = 350; // ms on one word before it is read, so sweeping across a page stays quiet
  const GERMAN = '[lang|="de"], .de, .ex-de, .reading-de, .vc-word, .wv-word, .sp-word, .glossary dt, td.form';
  const WORD_CHAR = /[\p{L}ßé-]/u;
  // Words that may stand before a noun and are read with it ("den Kaffee", "meine Mutter").
  const DETERMINER = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|kein|keine|keinen|keinem|keiner|keines|mein|meine|meinen|meinem|meiner|dein|deine|deinen|deinem|deiner|sein|seine|seinen|seinem|seiner|ihr|ihre|ihren|ihrem|ihrer|unser|unsere|unseren|unserem|unserer|euer|eure|euren|eurem|eurer|Ihr|Ihre|Ihren|Ihrem|Ihrer)$/i;
  // One sentence of a longer text: up to its full stop, question or exclamation mark.
  const SENTENCE = /[^.!?…]+(?:[.!?…]+[")»“”]*|$)/g;

  const clean = text => text.replace(/\s+/g, ' ').trim();
  const bare = text => clean(text).replace(/[.,!?;:…"“”„()«»–]/g, '').trim().toLowerCase();
  const amharicPage = () => document.documentElement.lang === 'am';
  const saved = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  };
  const hooks = () => window.ZemaHoverRead || {};

  /* ---------------------------------------------------------------- the dictionary */

  let dict = null, sentences = null, wordsReady = null, sentencesReady = null;
  function loadWords() {
    wordsReady = wordsReady || fetch(WORDS_URL).then(r => r.json()).then(d => { dict = d; }).catch(() => {});
    return wordsReady;
  }
  function loadSentences() {
    sentencesReady = sentencesReady || fetch(SENTENCES_URL).then(r => r.json()).then(d => { sentences = d; }).catch(() => {});
    return sentencesReady;
  }
  const loadAll = () => Promise.all([loadWords(), loadSentences()]);

  const entry = row => ({ german: row[0], part: row[1], english: row[2], amharic: row[3], gender: row[4], ipa: row[5], example: row[6] });

  // A word's entry: { german, part, english, amharic, gender, ipa, example, form }, `form` when the text is
  // one of its forms ("ist" for sein), or null.
  function findWord(text) {
    if (!dict) return null;
    let index = dict.keys[clean(text)] ?? dict.keys[bare(text)];
    if (index !== undefined) return { ...entry(dict.words[index]), form: false };
    index = dict.forms[bare(text)];
    return index === undefined ? null : { ...entry(dict.words[index]), form: true };
  }

  // A noun's entry, from the noun alone or with the word before it ("Kaffee", "den Kaffee").
  function nounOf(text) {
    const found = findWord(text) || findWord(text.replace(/^\S+ /, ''));
    return found?.gender || found?.part === 'noun' ? found : null;
  }

  // A sentence's entry: a course sentence with its translation, or a phrase of the vocabulary.
  function findSentence(text) {
    const german = clean(text);
    const known = sentences?.[german];
    if (known) {
      return { german, part: german.endsWith('?') ? 'question' : 'sentence', english: known[0], amharic: known[1], ipa: known[2] };
    }
    const word = findWord(german);
    return word && !word.form ? word : null;
  }

  /* ---------------------------------------------------------------- the voice */

  // The human recording when there is one (the voice and speed chosen in the course's settings), else the
  // browser's German voice.
  let clips = null, men = null, audio = null;
  const recordings = () =>
    (clips = clips || Promise.all([
      fetch(`${AUDIO_BASE}manifest.json`, { cache: 'no-cache' }).then(r => r.json()).catch(() => ({})),
      // With both voices: the clips the man says, the same choice as the course (course.js voiceFor).
      fetch(`${AUDIO_BASE}mix.json`, { cache: 'no-cache' }).then(r => r.json()).then(m => { men = new Set(m.conrad); }).catch(() => {}),
    ]).then(([ids]) => ids));

  function stopSpeaking() {
    if (audio) audio.pause();
    window.speechSynthesis?.cancel();
  }

  function speakWithBrowser(text) {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = { slow: 0.6, normal: 0.85, natural: 1 }[saved('book-pace', 'normal')] || 0.85;
    speechSynthesis.speak(utterance);
  }

  function say(text) {
    if (hooks().speak) return hooks().speak(text); // the course's player does the same
    stopSpeaking();
    recordings().then(ids => {
      const id = ids[text];
      if (!id) return speakWithBrowser(text);
      let voice = saved('book-voice', 'mix');
      if (voice === 'mix') voice = (men ? men.has(id) : parseInt(id.slice(-1), 16) % 2 === 1) ? 'conrad' : 'katja';
      audio = new Audio(`${AUDIO_BASE}${voice}/${saved('book-pace', 'normal')}/${id}.mp3`);
      audio.play().catch(() => speakWithBrowser(text));
    });
  }

  /* ---------------------------------------------------------------- the entry */

  function span(className, text) {
    const node = document.createElement('span');
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // "the coffee (m.)" -> senses ["the coffee"]; "the clock / o'clock (f.)" -> ["the clock", "o'clock"].
  const senses = (english, gender) =>
    (gender ? english.replace(/\s*\((m|f|n)\.\)\s*$/, '') : english).split(' / ').map(s => s.trim()).filter(Boolean);

  // A dictionary entry, as in a printed dictionary: headword and pronunciation; part of speech and gender;
  // the form pointed at; numbered meanings in English and Amharic (the page's language first); an example.
  // `unit`: { kind: 'word' | 'sentence', text, word, info }.
  function entryNodes(unit) {
    const info = unit.info;
    const nodes = [];
    const head = span('dict-head');
    const german = span('dict-de', info?.german || unit.text);
    german.lang = 'de';
    if (info?.gender) german.dataset.gender = info.gender;
    head.appendChild(german);
    if (info?.ipa) head.appendChild(span('dict-ipa', info.ipa));
    nodes.push(head);

    const part = info?.part || (unit.kind === 'sentence' ? (unit.text.endsWith('?') ? 'question' : 'sentence') : '');
    if (part) {
      const line = span('dict-pos', label(part));
      if (info?.gender) {
        const gender = span('dict-gender', label(info.gender));
        gender.dataset.gender = info.gender;
        line.append(' ', gender);
      }
      nodes.push(line);
    }
    if (info?.form && unit.word) {
      nodes.push(span('dict-form', label('formOf').replace('{form}', unit.word).replace('{word}', info.german)));
    }
    if (!info) {
      if (unit.kind === 'word') nodes.push(span('dict-unknown', label('unknown')));
      return nodes;
    }

    const english = span('dict-meaning');
    english.lang = 'en';
    const list = senses(info.english, info.gender);
    if (list.length > 1 && unit.kind === 'word') {
      const ol = document.createElement('ol');
      ol.className = 'dict-senses';
      list.forEach(sense => { const li = document.createElement('li'); li.textContent = sense; ol.appendChild(li); });
      english.appendChild(ol);
    } else {
      english.textContent = list.join(' / ');
    }
    const meanings = [[label('english'), english]];
    if (info.amharic) {
      const amharic = span('dict-meaning', info.amharic);
      amharic.lang = 'am';
      meanings.push([label('amharic'), amharic]);
    }
    if (amharicPage()) meanings.reverse();
    meanings.forEach(([name, value]) => {
      const row = span('dict-row');
      row.append(span('dict-label', name), value);
      nodes.push(row);
    });

    if (unit.kind === 'word' && info.example) {
      const [de, en, am] = info.example;
      const row = span('dict-row dict-example');
      const sentence = span('dict-example-de', de);
      sentence.lang = 'de';
      row.append(span('dict-label', label('example')), sentence, span('dict-example-meaning', (amharicPage() && am) || en));
      nodes.push(row);
    }
    return nodes;
  }

  /* ---------------------------------------------------------------- what the pointer is on */

  function caretAt(x, y) {
    const caret = document.caretPositionFromPoint?.(x, y);
    if (caret) return { node: caret.offsetNode, offset: caret.offset };
    const range = document.caretRangeFromPoint?.(x, y);
    return range ? { node: range.startContainer, offset: range.startOffset } : null;
  }

  // The word right under the pointer (not merely the nearest one): its text node, place and text.
  function wordAt(x, y) {
    const caret = caretAt(x, y);
    const node = caret?.node;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.nodeValue;
    let start = caret.offset, end = caret.offset;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (end < text.length && WORD_CHAR.test(text[end])) end++;
    if (end - start < 1) return null;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const box = range.getBoundingClientRect();
    if (x < box.left - 1 || x > box.right + 1 || y < box.top - 1 || y > box.bottom + 1) return null;
    return { node, start, end, text: text.slice(start, end) };
  }

  // A word unit: the word, with the article before a noun or the noun after an article ("den Kaffee").
  function wordUnit(word) {
    const text = word.node.nodeValue;
    let { start, end } = word;
    let noun = null;
    if (/^\p{Lu}/u.test(word.text) && (noun = nounOf(word.text))) {
      const before = /(\S+)\s+$/u.exec(text.slice(0, start));
      if (before && DETERMINER.test(before[1])) start = before.index;
    } else if (DETERMINER.test(word.text)) {
      const after = /^\s+(\p{Lu}[\p{L}ß-]*)/u.exec(text.slice(end));
      if (after && (noun = nounOf(after[1]))) end += after[0].length;
    }
    const range = document.createRange();
    range.setStart(word.node, start);
    range.setEnd(word.node, end);
    const said = clean(text.slice(start, end));
    const headword = noun || findWord(word.text);
    return { kind: 'word', key: word.node, sub: `${start}:${end}`, text: said, word: noun ? said : word.text,
      info: headword && noun && !noun.form ? { ...headword, form: false } : headword, range };
  }

  // Text offsets inside an element, across its text nodes.
  function offsetIn(el, node, offset) {
    let total = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n === node) return total + offset;
      total += n.nodeValue.length;
    }
    return null;
  }
  function rangeIn(el, start, end) {
    const range = document.createRange();
    let total = 0, started = false;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const length = n.nodeValue.length;
      if (!started && start <= total + length) { range.setStart(n, start - total); started = true; }
      if (started && end <= total + length) { range.setEnd(n, end - total); return range; }
      total += length;
    }
    range.selectNodeContents(el);
    return range;
  }

  // A sentence unit: the whole element when the course knows it as one statement or it is one sentence,
  // else the sentence of it nearest the pointer.
  function sentenceUnit(el, x, y) {
    const full = el.textContent;
    const text = clean(full);
    if (!text) return null;
    const parts = [...full.matchAll(SENTENCE)].filter(m => m[0].trim());
    if (parts.length <= 1 || findSentence(text)) {
      return { kind: 'sentence', key: el, sub: 'all', el, text, info: findSentence(text) };
    }
    const caret = caretAt(x, y);
    const at = caret && el.contains(caret.node) ? offsetIn(el, caret.node, caret.offset) ?? 0 : 0;
    const part = parts.find(m => at < m.index + m[0].length) || parts[parts.length - 1];
    const sentence = clean(part[0]);
    return { kind: 'sentence', key: el, sub: `${part.index}`, el, text: sentence, info: findSentence(sentence),
      range: rangeIn(el, part.index, part.index + part[0].length) };
  }

  // The German element under the pointer: a marked one, or any short text that is German from the course
  // (match tiles, answer options).
  function germanAt(target) {
    if (!target || target.closest('input, textarea, select, [contenteditable], .ze-ui, .hover-tip, .dict-card')) return null;
    const german = target.closest(GERMAN);
    if (german && german !== document.documentElement) return german;
    if (target.childElementCount === 0 && dict) {
      const text = clean(target.textContent);
      if (text && (findWord(text) || sentences?.[text])) return target;
    }
    return null;
  }

  // A sentence's row: pointing at its speaker button, beside it or at its translation means the sentence.
  // The nearest container (up to three levels up) holding exactly one German text of two words or more.
  function sentenceRow(target) {
    if (!target || target.closest('input, textarea, select, [contenteditable], .ze-ui, .hover-tip, .dict-card')) return null;
    for (let node = target, depth = 0; node && node !== document.body && depth < 3; node = node.parentElement, depth++) {
      const german = node.querySelectorAll(GERMAN);
      if (german.length > 1) return null;
      if (german.length === 1 && clean(german[0].textContent).split(' ').length >= 2) return german[0];
    }
    return null;
  }

  function unitAt(event) {
    const target = event.target instanceof Element ? event.target : null;
    const el = germanAt(target);
    if (!el) {
      const row = sentenceRow(target);
      return row ? sentenceUnit(row, -1, -1) : null;
    }
    const word = wordAt(event.clientX, event.clientY);
    if (word && el.contains(word.node)) return { ...wordUnit(word), el };
    return sentenceUnit(el, event.clientX, event.clientY);
  }

  /* ---------------------------------------------------------------- the tooltip */

  let tip = null;
  function tooltip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'hover-tip dict-entry';
      tip.setAttribute('role', 'tooltip');
      tip.dataset.noedit = '';
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }

  function place(node, box, below) {
    const width = node.offsetWidth, height = node.offsetHeight;
    const above = box.top - height - 10, under = box.bottom + 10;
    const top = below
      ? (under + height <= window.innerHeight - 8 ? under : Math.max(8, above))
      : (above >= 8 ? above : under);
    node.style.left = `${Math.max(8, Math.min(box.left + box.width / 2 - width / 2, window.innerWidth - width - 8))}px`;
    node.style.top = `${top}px`;
  }

  // What is read is marked: a word or sentence inside a text with the CSS Custom Highlight API (no change to
  // the page's markup), a noun in its gender's colour; a whole element with a class.
  const highlights = window.CSS?.highlights && window.Highlight ? CSS.highlights : null;
  const MARKS = ['hover-word', 'hover-sentence', 'gender-der', 'gender-die', 'gender-das', 'gender-plural'];
  function unmark() {
    if (current?.el) { current.el.classList.remove('hover-reading'); delete current.el.dataset.hoverGender; }
    if (highlights) MARKS.forEach(name => highlights.delete(name));
  }
  function mark(unit) {
    if (unit.range) {
      const name = unit.kind === 'word' && unit.info?.gender ? `gender-${unit.info.gender}` : `hover-${unit.kind}`;
      if (highlights) highlights.set(name, new Highlight(unit.range));
    } else if (unit.el) {
      unit.el.classList.add('hover-reading');
      if (unit.info?.gender) unit.el.dataset.hoverGender = unit.info.gender;
    }
  }

  let current = null, timer = 0;
  function hide() {
    clearTimeout(timer);
    unmark();
    current = null;
    if (tip) tip.hidden = true;
  }

  function show(unit) {
    const nodes = entryNodes(unit);
    // A word inside a sentence: say how to hear the whole sentence.
    if (unit.kind === 'word' && unit.el && clean(unit.el.textContent).split(' ').length > 2) {
      nodes.push(span('dict-hint', label('hint')));
    }
    tooltip().replaceChildren(...nodes);
    mark(unit);
    tip.hidden = false;
    place(tip, (unit.range || unit.el).getBoundingClientRect(), false);
    say(unit.text);
  }

  /* ---------------------------------------------------------------- select to look up */

  // Selecting German (double-click, drag, or press and hold on a phone) opens the entry as a card, with
  // Listen and Close buttons. It works with touch too, and stays quiet where pointing does.
  const MAX_WORDS = 12;
  let card = null, cardFor = '', selectTimer = 0, lastPointer = 'mouse';

  function button(text, onClick) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'dict-card-button';
    node.textContent = text;
    node.addEventListener('click', onClick);
    return node;
  }

  function closeCard() {
    if (card) card.hidden = true;
    cardFor = '';
  }

  // The selected text, if it is something to look up: a few words, outside form fields and the card itself.
  function selected() {
    const selection = window.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const from = range.commonAncestorContainer;
    const el = from.nodeType === Node.ELEMENT_NODE ? from : from.parentElement;
    if (!el || el.closest('input, textarea, select, [contenteditable], .ze-ui, .dict-card')) return null;
    const text = clean(selection.toString()).replace(/^[\s.,;:…"“”„()«»–]+|[\s,;:…"“”„()«»–]+$/g, '');
    if (!text || text.length > 160 || text.split(' ').length > MAX_WORDS) return null;
    return { text, el, box: range.getBoundingClientRect() };
  }

  // A selection as a unit: one word (or an article and its noun), or a sentence.
  function selectionUnit(found) {
    const words = found.text.replace(/[.!?]+$/, '').split(' ');
    if (words.length === 1) return { kind: 'word', text: words[0], word: words[0], info: findWord(words[0]) };
    if (words.length === 2 && DETERMINER.test(words[0]) && nounOf(found.text)) {
      return { kind: 'word', text: found.text, word: found.text, info: nounOf(found.text) };
    }
    const info = findSentence(found.text) || findWord(found.text);
    return { kind: info?.part === 'sentence' || info?.part === 'question' || !info ? 'sentence' : 'word', text: found.text, info };
  }

  function showCard(found) {
    const unit = selectionUnit(found);
    // Nothing known: only say so for German text, so selecting English on the page stays quiet.
    if (!unit.info && !found.el.closest(GERMAN)) return closeCard();
    if (!card) {
      card = document.createElement('div');
      card.className = 'dict-card dict-entry';
      card.setAttribute('role', 'dialog');
      card.dataset.noedit = '';
      // Pressing a button in the card keeps the selection (and the card) in place.
      card.addEventListener('mousedown', event => { if (event.target.closest('button')) event.preventDefault(); });
      document.body.appendChild(card);
    }
    const actions = span('dict-card-actions');
    actions.append(
      button(label('listen'), () => say(unit.text)),
      button(label('close'), () => { closeCard(); window.getSelection()?.removeAllRanges(); }),
    );
    card.replaceChildren(...entryNodes(unit), actions);
    cardFor = found.text;
    hide();
    card.hidden = false;
    // Above the selection with a mouse; below it on touch screens, where the phone's own menu sits above.
    place(card, found.box, lastPointer !== 'mouse');
  }

  function checkSelection() {
    clearTimeout(selectTimer);
    selectTimer = setTimeout(() => {
      if (document.documentElement.classList.contains('ze-editing') || !(hooks().allowed?.() ?? true)) return closeCard();
      const found = selected();
      if (!found) return;
      if (found.text === cardFor && card && !card.hidden) return;
      loadAll().then(() => showCard(found));
    }, 350);
  }

  document.addEventListener('selectionchange', checkSelection);
  document.addEventListener('pointerdown', event => {
    lastPointer = event.pointerType || 'mouse';
    if (card && !card.hidden && !card.contains(event.target)) closeCard();
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && card && !card.hidden) closeCard(); });
  window.addEventListener('scroll', () => { if (card && !card.hidden) closeCard(); }, true);
  window.addEventListener('resize', () => { if (card && !card.hidden) closeCard(); });

  /* ---------------------------------------------------------------- wiring */

  let enabled = saved('hover-read', true);
  // Mouse and trackpad only, checked per movement so touch-screen laptops work too; on touch screens the
  // speaker buttons and selecting do the same. Quiet while the dictionary card is open.
  const active = event => enabled && event.pointerType === 'mouse' && !(card && !card.hidden)
    && !document.documentElement.classList.contains('ze-editing') && (hooks().allowed?.() ?? true);

  document.addEventListener('pointermove', event => {
    if (!active(event)) { if (current) hide(); return; }
    loadAll();
    const unit = unitAt(event);
    if (unit && current && unit.key === current.key && unit.sub === current.sub) return;
    hide();
    if (!unit) return;
    current = unit;
    const { clientX: x, clientY: y } = event;
    timer = setTimeout(() => loadAll().then(() => {
      if (current !== unit) return;
      // The first time, the dictionary may have arrived only now: look again.
      const word = unit.kind === 'word' && wordAt(x, y);
      const fresh = word ? wordUnit(word) : unit.kind === 'sentence' ? sentenceUnit(unit.el, x, y) : null;
      if (!fresh) return hide();
      current = { ...fresh, el: unit.el };
      show(current);
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
    // The meaning of a German word or phrase, in the page's language ('' when the dictionary has none).
    lookup(text) {
      const info = findWord(text) || findSentence(text);
      return (info && ((amharicPage() && info.amharic) || info.english)) || '';
    },
  };
})();
