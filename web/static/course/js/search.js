// Course search: words (German, meanings, example sentences, spelled any way: "schoen", "tschuess", or German
// written in Ethiopic letters, ዳንኬ), grammar lessons, chapters and the search topics (tools/search_topics.txt) that
// catch plain questions like "how to order food". Runs in the page, so it needs no server.
// The app has the same rules in mobile/lib/features/search/search_engine.dart; both are checked against
// web/apps/course/tests/search_cases.json, so change them together.
(function (root) {
  // Dropped from a question when something else is left: "how to order food at a restaurant" → order food restaurant.
  const STOP = new Set(('a an the to of for in on at by with and or is are am be been how what which who whom do does did ' +
    'i you your my me we us our words word phrase phrases sentence sentences used use using about some something ' +
    'that this these those it its there get say saying said into from ' +
    'እንዴት ምን ምንድን ነው ለ ስለ').split(' '));

  // Accented letters other than the umlauts, to their plain letter (no Unicode normalisation in Dart).
  const PLAIN = { 'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'å': 'a', 'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ý': 'y' };

  // Lower case, ß → ss, umlauts and their ae / oe / ue spellings to the plain vowel, other accents dropped.
  function fold(text) {
    let s = '';
    for (const ch of text.toLowerCase()) {
      if (ch === 'ß') s += 'ss';
      else if (ch === 'ä') s += 'a';
      else if (ch === 'ö') s += 'o';
      else if (ch === 'ü') s += 'u';
      else s += PLAIN[ch] || ch;
    }
    return s.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
  }

  // Ethiopic syllables to Latin as an Amharic speaker hears German: ጉተን ታግ → guten tag. Each row of eight letters
  // is one consonant; the place in the row is the vowel.
  const ROWS = { 0x1200: 'h', 0x1208: 'l', 0x1210: 'h', 0x1218: 'm', 0x1220: 's', 0x1228: 'r', 0x1230: 's', 0x1238: 'sch',
    0x1240: 'k', 0x1248: 'kw', 0x1250: 'k', 0x1260: 'b', 0x1268: 'w', 0x1270: 't', 0x1278: 'tsch', 0x1280: 'h', 0x1288: 'hw',
    0x1290: 'n', 0x1298: 'nj', 0x12A0: '', 0x12A8: 'k', 0x12B0: 'kw', 0x12B8: 'ch', 0x12C0: 'chw', 0x12C8: 'w', 0x12D0: '',
    0x12D8: 's', 0x12E0: 'sch', 0x12E8: 'j', 0x12F0: 'd', 0x12F8: 'd', 0x1300: 'dsch', 0x1308: 'g', 0x1310: 'gw', 0x1318: 'g',
    0x1320: 't', 0x1328: 'tsch', 0x1330: 'p', 0x1338: 'z', 0x1340: 'z', 0x1348: 'f', 0x1350: 'p' };
  const VOWELS = ['e', 'u', 'i', 'a', 'e', '', 'o', 'wa'];
  const CARRIER = ['a', 'u', 'i', 'a', 'e', 'i', 'o', 'wa']; // አ and ዐ carry a bare vowel

  function transliterate(text) {
    let out = '';
    for (const ch of text) {
      const code = ch.codePointAt(0);
      const base = code - (code % 8);
      if (code < 0x1200 || code > 0x135a || !(base in ROWS)) { out += ch; continue; }
      const order = code - base;
      out += ROWS[base] + (ROWS[base] === '' ? CARRIER[order] : VOWELS[order]);
    }
    return out;
  }

  const ETHIOPIC = /^[ሀ-ፚ]/;
  const TOKEN = /[a-z0-9]+|[ሀ-ፚ]+/g;

  function tokens(text) {
    return fold(String(text).replace(/<[^>]+>/g, ' ')).match(TOKEN) || [];
  }

  // English endings, so "ordering", "orders" and "ordered" all find "order".
  function stem(t) {
    if (/^[0-9]/.test(t)) return t;
    if (t.length > 4 && t.endsWith('ies')) t = t.slice(0, -3) + 'y';
    else if (t.length > 3 && t.endsWith('s') && !/(ss|us|is)$/.test(t)) t = t.slice(0, -1);
    if (t.length > 5 && t.endsWith('ing')) t = t.slice(0, -3);
    else if (t.length > 4 && t.endsWith('ed')) t = t.slice(0, -2);
    return t;
  }

  // How a German word sounds, so spellings by ear meet: gooten → guten, shoen → schön, vas → was, nain → nein.
  const DIPHTHONGS = { ei: '1', ai: '1', ay: '1', ey: '1', eu: '2', oi: '2', oy: '2', au: '3', ie: 'i', ee: 'e', oo: 'u', ou: 'u', aa: 'a' };
  const CONSONANTS = [['tsch', 'C'], ['sch', 'S'], ['sh', 'S'], ['ch', 'K'], ['kh', 'K'], ['ck', 'K'], ['ph', 'F'], ['th', 'T'],
    ['tz', 'Z'], ['ts', 'Z'], ['z', 'Z'], ['qu', 'KF'], ['q', 'K'], ['x', 'KS'], ['c', 'K'], ['k', 'K'], ['v', 'F'], ['w', 'F'],
    ['f', 'F'], ['j', 'Y'], ['y', 'Y']];
  const FINAL = { d: 't', b: 'p', g: 'K' };

  function phonetic(t) {
    let s = t.replace(/ei|ai|ay|ey|eu|oi|oy|au|ie|ee|oo|ou|aa/g, m => DIPHTHONGS[m]);
    s = s.replace(/^s(?=[aeiou123])/, 'Z'); // s before a vowel sounds like z: Sohn, zon
    for (const [from, to] of CONSONANTS) s = s.split(from).join(to);
    s = s.replace(/([aeiou123])h/g, '$1'); // the h in "geht", "Sohn" is not said
    if (s && FINAL[s[s.length - 1]]) s = s.slice(0, -1) + FINAL[s[s.length - 1]];
    return s.replace(/(.)\1+/g, '$1');
  }

  // Edit distance, giving up past `max`.
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (row[j] < best) best = row[j];
      }
      if (best > max) return max + 1;
      prev = row;
    }
    return prev[b.length];
  }

  // A query token: Latin (with its stem and sound) or Ethiopic (and how it sounds in Latin letters).
  function queryToken(t) {
    if (ETHIOPIC.test(t)) {
      const latin = fold(transliterate(t)).replace(/[^a-z]/g, '');
      return { t, ethiopic: true, latin, key: phonetic(latin) };
    }
    return { t, ethiopic: false, stem: stem(t), key: phonetic(t) };
  }

  // How well a query token matches a token of the index: 1 is the same word. `german` marks a match that only
  // counts in German text (Ethiopic letters read as German sounds).
  function quality(q, e) {
    if (q.ethiopic) {
      if (e.ethiopic) {
        if (e.t === q.t) return [1, false];
        if (q.t.length >= 2 && e.t.startsWith(q.t)) return [0.8, false];
        if (q.t.length >= 2 && e.t.includes(q.t)) return [0.6, false];
        return [0, false];
      }
      if (q.key.length < 2) return [0, false];
      if (e.key === q.key) return [0.7, true];
      if (q.key.length >= 3 && e.key.startsWith(q.key)) return [0.55, true];
      if (q.key.length >= 4 && e.key[0] === q.key[0] && distance(q.key, e.key, 1) <= 1) return [0.45, true];
      return [0, false];
    }
    if (e.ethiopic) return [0, false];
    if (e.t === q.t) return [1, false];
    if (e.stem === q.stem) return [0.95, false];
    if (q.t.length >= 2 && e.t.startsWith(q.t)) return [q.t.length >= 3 ? 0.7 : 0.6, false]; // a beginning: below a word that sounds the same
    if (/^[0-9]/.test(q.t)) return [0, false];
    if (q.key.length >= 2 && e.key === q.key) return [0.75, false];
    if (q.key.length >= 3 && e.key.startsWith(q.key)) return [0.6, false];
    if (q.t.length >= 4 && e.t.includes(q.t)) return [0.5, false]; // inside a compound: kuchen in Apfelkuchen
    if (q.t.length >= 4 && e.t[0] === q.t[0]) {
      // One slip in a word of four letters or more, two in a long one.
      const max = q.t.length >= 7 ? 2 : 1;
      const d = distance(q.t, e.t, max);
      if (d <= 1) return [0.55, false];
      if (d <= max) return [0.45, false];
    }
    return [0, false];
  }

  const LIMITS = { topic: 4, lesson: 6, chapter: 6, word: 40 };
  // Browsing (filters, no words typed): everything that fits, in course order.
  const BROWSE_LIMITS = { topic: 50, lesson: 50, chapter: 50, word: 300 };

  // Result types for the filters: a word, a grammar (or pronunciation) lesson, a reading text, a chapter's word
  // list, a topic. Word types (noun, verb, adjective, phrase, number, small) come with the course (word.pos).
  const TYPES = ['word', 'grammar', 'reading', 'chapter', 'topic'];

  /**
   * The search index of a course.
   * course: {units, topics} as in course-data.js. amharic: course-am.js data or null.
   * title: the interface's name for a unit, chapter, lesson or topic title (its Amharic), or null.
   */
  function createIndex(course, amharic, title) {
    const docs = [];
    const vocab = new Map();
    const tr = text => (title ? title(text) : text);

    function addDoc(doc, fields) {
      const index = docs.length;
      doc.fields = fields.map(([name, weight, german, text], f) => {
        const toks = tokens(text || '');
        toks.forEach(t => {
          let entry = vocab.get(t);
          if (!entry) {
            const ethiopic = ETHIOPIC.test(t);
            entry = { t, ethiopic, stem: ethiopic ? t : stem(t), key: ethiopic ? '' : phonetic(t), post: [] };
            vocab.set(t, entry);
          }
          entry.post.push(index, f); // pairs: document, field
        });
        return { name, weight, german, size: toks.length, joined: ' ' + toks.join(' ') + ' ' };
      });
      docs.push(doc);
      return index;
    }

    const wordDoc = new Map();
    const chapterDoc = new Map();
    const lessonDoc = new Map();
    const levelOf = new Map(course.units.map(u => [u.id, u.level || '']));
    // Where a document belongs, for the filters: every unit and chapter it appears in.
    const place = (units, sections) => ({ units: [...new Set(units)], sections: [...new Set(sections)], levels: [...new Set(units.map(u => levelOf.get(u)))] });
    course.units.forEach(unit => {
      unit.sections.forEach(section => {
        chapterDoc.set(section.key, addDoc({ kind: 'chapter', type: 'chapter', id: section.key, unit: unit.id, title: section.title, ...place([unit.id], [section.key]) },
          [['title', 8, false, section.title], ['title-am', 8, false, tr(section.title) === section.title ? '' : tr(section.title)]]));
        section.words.forEach(word => {
          if (wordDoc.has(word.german)) {
            const doc = docs[wordDoc.get(word.german)];
            Object.assign(doc, place([...doc.units, unit.id], [...doc.sections, section.key]));
            return;
          }
          const examples = word.examples || [];
          const fields = [['german', 10, true, word.german], ['meaning', 7, false, word.english],
            ['meaning-am', 7, false, amharic ? amharic.words[word.german] : '']];
          examples.forEach(([de, en], i) => {
            fields.push([`ex${i}`, 3, true, de], [`ex${i}-en`, 2, false, en], [`ex${i}-am`, 2, false, amharic && amharic.examples ? amharic.examples[de] : '']);
          });
          wordDoc.set(word.german, addDoc({ kind: 'word', type: 'word', pos: word.pos || '', id: word.german, unit: unit.id, section: section.key, word, ...place([unit.id], [section.key]) }, fields));
        });
      });
      unit.grammar.forEach(lesson => {
        if (lesson.key.startsWith('test-')) return;
        const text = [...(lesson.intro || []), ...(lesson.blocks || []).flatMap(b => [b.step, b.title, b.text])].filter(Boolean).join(' ');
        const type = (lesson.blocks || []).some(b => b.reading && b.reading.length) ? 'reading' : 'grammar';
        lessonDoc.set(lesson.key, addDoc({ kind: 'lesson', type, id: lesson.key, unit: unit.id, title: lesson.title, ...place([unit.id], lesson.chapters || []) },
          [['title', 8, false, lesson.title], ['title-am', 8, false, tr(lesson.title) === lesson.title ? '' : tr(lesson.title)], ['text', 2, false, text]]));
      });
    });
    (course.topics || []).forEach(topic => {
      const links = [...topic.chapters.map(k => chapterDoc.get(k)), ...topic.lessons.map(k => lessonDoc.get(k)),
        ...topic.words.map(g => wordDoc.get(g))].filter(i => i !== undefined);
      const linked = links.map(i => docs[i]);
      addDoc({ kind: 'topic', type: 'topic', id: topic.title, title: topic.title, topic, links, ...place(linked.flatMap(d => d.units), topic.chapters) },
        [['title', 9, false, topic.title], ['title-am', 9, false, tr(topic.title) === topic.title ? '' : tr(topic.title)],
          ['terms', 8, false, topic.en.join(' , ')], ['terms-am', 8, false, topic.am.join(' , ')]]);
    });

    return { docs, vocab, search: (query, options) => search({ docs, vocab }, query, options) };
  }

  // Whether a document fits the filters: {types, pos, unit, section, level}, each optional.
  function fits(doc, { types = [], pos = [], unit = null, section = null, level = null } = {}) {
    if (types.length && !types.includes(doc.type)) return false;
    if (pos.length && !(doc.kind === 'word' && pos.includes(doc.pos))) return false;
    if (unit !== null && unit !== undefined && !doc.units.includes(unit)) return false;
    if (section && !doc.sections.includes(section)) return false;
    if (level && !doc.levels.includes(level)) return false;
    return true;
  }
  const filtering = f => !!f && Object.values(f).some(v => (Array.isArray(v) ? v.length : v !== null && v !== undefined && v !== ''));

  function result(doc, total, extra = {}) {
    const r = { kind: doc.kind, type: doc.type, id: doc.id, unit: doc.unit, units: doc.units, sections: doc.sections, levels: doc.levels, score: Math.round(total * 100) / 100 };
    if (doc.kind === 'word') Object.assign(r, { section: doc.section, word: doc.word, pos: doc.pos });
    else r.title = doc.title;
    if (doc.kind === 'topic') r.topic = doc.topic;
    return Object.assign(r, extra);
  }

  function limited(results, limits) {
    const counts = {};
    return results.filter(r => (counts[r.kind] = (counts[r.kind] || 0) + 1) <= (limits[r.kind] ?? Infinity));
  }

  function search(index, query, { limits = LIMITS, filters = null } = {}) {
    let words = tokens(query);
    const kept = words.filter(t => !STOP.has(t));
    if (kept.length) words = kept;
    words = [...new Set(words)];
    if (!words.length) {
      if (!filtering(filters)) return [];
      // Browsing: no topics unless asked for, everything else in course order.
      const browse = index.docs.filter(d => fits(d, filters) && (d.kind !== 'topic' || (filters.types || []).includes('topic')));
      return limited(browse.map(d => result(d, 0)), BROWSE_LIMITS);
    }
    const qs = words.map(queryToken);
    const n = qs.length;
    const phrase = ' ' + words.join(' ') + ' ';

    // best[doc][token] = [score, field]
    const best = new Map();
    qs.forEach((q, qi) => {
      index.vocab.forEach(entry => {
        const [score, germanOnly] = quality(q, entry);
        if (!score) return;
        for (let p = 0; p < entry.post.length; p += 2) {
          const d = entry.post[p];
          const f = entry.post[p + 1];
          const field = index.docs[d].fields[f];
          if (germanOnly && !field.german) continue;
          const s = score * field.weight;
          let row = best.get(d);
          if (!row) best.set(d, (row = new Array(n).fill(null)));
          if (!row[qi] || s > row[qi][0]) row[qi] = [s, f];
        }
      });
    });

    const scores = new Map();
    best.forEach((row, d) => {
      const matched = row.filter(Boolean).length;
      if (n <= 2 ? matched < n : matched < Math.ceil(n / 2)) return;
      const doc = index.docs[d];
      let total = row.reduce((sum, hit) => sum + (hit ? hit[0] : 0), 0) * (matched / n) * (matched / n);
      doc.fields.forEach((field, f) => {
        if (n >= 2 && field.joined.includes(phrase)) total += field.weight * n * 0.5;
        if (field.joined === phrase) total += field.weight * 1.5;
        // Everything in the field was asked for, if spelled differently: schön before "Bitte schön!" for "shoen".
        const here = row.filter(hit => hit && hit[1] === f && hit[0] >= field.weight * 0.75).length; // whole words, not beginnings
        if (here && here === field.size) total += field.weight * 0.3;
      });
      scores.set(d, { total, row });
    });
    // A topic that matches lends its weight to what it links, and comes first among them: it is the answer card.
    [...scores.entries()].forEach(([d, { total }]) => {
      const doc = index.docs[d];
      if (doc.kind !== 'topic') return;
      doc.links.forEach(link => {
        const hit = scores.get(link);
        if (hit) hit.total += total * 0.5;
        else scores.set(link, { total: total * 0.5, row: [], via: doc.title });
      });
      scores.get(d).total = total * 1.5;
    });

    const results = [...scores.entries()].filter(([d]) => !filters || fits(index.docs[d], filters)).map(([d, { total, row, via }]) => {
      const doc = index.docs[d];
      const extra = {};
      if (doc.kind === 'word') {
        // The example sentence that matched best, to show under the word.
        const exampleHits = row.filter(hit => hit && /^ex\d/.test(doc.fields[hit[1]].name));
        if (exampleHits.length) {
          const top = exampleHits.reduce((a, b) => (b[0] > a[0] ? b : a));
          extra.example = Number(doc.fields[top[1]].name.match(/^ex(\d+)/)[1]);
        }
      }
      if (via) extra.via = via;
      return result(doc, total, extra);
    });
    // Ties: the shorter entry (a word before a sentence with it), then in Dart's compareTo order.
    results.sort((a, b) => b.score - a.score || a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return limited(results, limits);
  }

  const api = { createIndex, fold, tokens, stem, phonetic, transliterate, TYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CourseSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
