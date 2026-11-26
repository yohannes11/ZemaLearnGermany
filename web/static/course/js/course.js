// Server-side settings and URLs, rendered by Django into the page (see apps/course/views.py).
const APP = JSON.parse(document.getElementById('app-config').textContent);

// The interface language (English or Amharic, see apps/core/i18n.py). English text is the key; a string
// without a translation stays English. {name} placeholders are filled after translating.
const LANG = APP.lang || 'en';
const MESSAGES = APP.messages || {};
function T(text, values) {
  const out = MESSAGES[text] || text;
  return values ? out.replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m)) : out;
}

// Amharic course content (course-am.js, loaded only for Amharic): word meanings by German word and lesson
// texts by their English. German itself is never translated: it is what the course teaches.
const AM = LANG === 'am' && window.COURSE_AM ? window.COURSE_AM : null;
const L = text => (AM && typeof text === 'string' && AM.text[text]) || text;
const meaning = item => (AM && AM.words[item.german]) || item.english;

// Django's CSRF token, read fresh for every request: signing in rotates it.
function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}
const jsonHeaders = () => ({ 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() });

const tts = window.speechSynthesis;
let currentSpeed = 'normal';

// Course content (the Start unit and Units 1–7) lives in course-data.js; the app shows one unit at a time.
const COURSE_UNITS = window.COURSE.units;
// The search keeps the English titles (they are translated in place just below) and adds the Amharic through T.
const SEARCH_SOURCE = {
  units: COURSE_UNITS.map(u => ({ id: u.id, sections: u.sections.map(s => ({ ...s })), grammar: u.grammar.map(g => ({ ...g })) })),
  topics: window.COURSE.topics || [],
};
// Unit, section and lesson titles follow the interface language; the German itself never changes.
COURSE_UNITS.forEach(u => {
  ['title', 'label', 'lessonsLabel'].forEach(k => { if (u[k]) u[k] = T(u[k]); });
  u.sections.forEach(s => { s.title = T(s.title); });
  u.grammar.forEach(g => { g.title = T(g.title); });
});
let unit = COURSE_UNITS[0];
let vocabulary = {};
let SECTION_TITLES = {};
let SCOPES = [];
let GRAMMAR = {};
let railReady = false; // the progress column waits for start(): the page's constants are only all in place then

function loadUnit(id) {
  unit = COURSE_UNITS.find(u => u.id === id) || COURSE_UNITS[0];
  vocabulary = {};
  SECTION_TITLES = {};
  unit.sections.forEach(s => { vocabulary[s.key] = s.words; SECTION_TITLES[s.key] = s.title; });
  SCOPES = [...Object.keys(vocabulary), 'all'];
  GRAMMAR = {};
  unit.grammar.forEach(g => { GRAMMAR[g.key] = g; });
}

// The Start unit (id 0) has its own name and calls its lessons "Pronunciation" rather than "Grammar".
const unitName = u => u.label || T('Unit {n}', { n: u.id });
const lessonsLabel = () => unit.lessonsLabel || T('Grammar');

const unitOf = scope => COURSE_UNITS.find(u => u.sections.some(s => s.key === scope) || u.grammar.some(g => g.key === scope));

const MODES = ['learn', 'speak', 'practice', 'flashcards', 'match'];

// Keys are unchanged from the earlier book design so existing progress carries over.
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    try { scheduleSync(key); } catch (e) {} // the account code loads later in this script
  },
};

const isGrammar = scope => scope in GRAMMAR;
let grammarScores = store.get('grammar-scores', {});

const savedScope = store.get('book-scope');
loadUnit(unitOf(savedScope)?.id ?? store.get('current-unit', COURSE_UNITS[0].id));
let currentScope = SCOPES.includes(savedScope) || isGrammar(savedScope) ? savedScope : SCOPES[0];
let currentMode = MODES.includes(store.get('book-mode')) ? store.get('book-mode') : 'learn';
let learned = new Set(store.get('book-learned', []));

function wordsIn(scope) {
  const pool = scope === 'all' ? Object.values(vocabulary).flat() : vocabulary[scope];
  const unique = new Map();
  pool.forEach(item => { if (!unique.has(item.german)) unique.set(item.german, item); });
  return [...unique.values()];
}

// Ethiopic numerals, shown as an ornament beside the ordinary chapter numbers.
function geez(n) {
  const ones = ['', '፩', '፪', '፫', '፬', '፭', '፮', '፯', '፰', '፱'];
  const tens = ['', '፲', '፳', '፴', '፵', '፶', '፷', '፸', '፹', '፺'];
  return n > 0 && n < 100 ? tens[Math.floor(n / 10)] + ones[n % 10] : String(n);
}

const scopeTitle = scope => scope === 'all' ? T('All chapters') : isGrammar(scope) ? GRAMMAR[scope].title : SECTION_TITLES[scope];
const icon = (name, extra = '') => `<svg class="icon" ${extra}><use href="#i-${name}"/></svg>`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A word's picture (tools/word_pictures.py): photos from Wikimedia Commons, a flat swatch for a colour, or a
// clock for a time. Compounds show their parts: der Apfelkuchen reads "apple + cake".
// Decorative for screen readers: the German and English text carry the meaning.
const photoCredit = name => (window.COURSE.photos || {})[name];
const creditText = c => T('Photo: {credit}', { credit: `${c.author}, ${c.license}` });

function picImage(name) {
  const img = el('img');
  img.src = `${APP.picBase}${name.includes('.') ? name : `${name}.svg`}`;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.draggable = false;
  const credit = photoCredit(name);
  if (credit) {
    img.className = 'photo';
    img.title = creditText(credit);
  }
  return img;
}

function wordPicture(item, className) {
  if (!item.pic) return null;
  const box = el('span', `word-pic ${className}`);
  box.setAttribute('aria-hidden', 'true');
  item.pic.forEach(name => {
    if (name === '+') return box.appendChild(el('span', 'word-pic-plus', '+'));
    if (name.startsWith('#')) {
      const swatch = el('span', `swatch${name === '#ffffff' ? ' light' : ''}`);
      swatch.style.background = name;
      return box.appendChild(swatch);
    }
    box.appendChild(picImage(name));
  });
  return box;
}

// Who took each photo of a word, and under which licence, linked to the photo's page on Wikimedia Commons.
function photoCredits(item) {
  const credits = (item.pic || []).map(photoCredit).filter(Boolean);
  if (!credits.length) return null;
  const line = el('p', 'photo-credit');
  credits.forEach((c, i) => {
    if (i) line.append(' · ');
    const link = el('a', '', creditText(c));
    link.href = c.page;
    link.target = '_blank';
    link.rel = 'noopener';
    line.appendChild(link);
  });
  return line;
}

// Clocks for the times a German text says (tools/clock_pictures.py builds COURSE.clocks): each time on an
// analog face at the exact hour said (vier Uhr is 4:00), with the time in digits under it. Decorative for
// screen readers: the text says the time.
const clockName = time => { const [h, m] = time.split(':'); return `clock-${h.padStart(2, '0')}${m}`; };
const clocksFor = text => (window.COURSE.clocks || {})[text];

function clockPics(times, size = '', caption = true) {
  if (!times || !times.length) return null;
  const box = el('span', `clock-pics ${size}`.trim());
  box.setAttribute('aria-hidden', 'true');
  times.forEach(time => {
    const figure = el('span', 'clock-pic');
    const img = el('img');
    img.src = `${APP.picBase}${clockName(time)}.svg`;
    img.alt = '';
    img.loading = 'lazy';
    img.draggable = false;
    figure.appendChild(img);
    if (caption) figure.appendChild(el('span', 'clock-time', time));
    box.appendChild(figure);
  });
  return box;
}

function listenButton(german) {
  const btn = el('button', 'icon-btn');
  btn.type = 'button';
  btn.innerHTML = icon('speaker');
  btn.setAttribute('aria-label', T('Listen: {text}', { text: german }));
  btn.title = T('Listen');
  btn.addEventListener('click', e => { e.stopPropagation(); speak(german); });
  return btn;
}

// A word's example sentences: the German (with a speaker) and its meaning in the learner's language
// (tools/examples/). Shown once the learner has seen the word's meaning.
function exampleList(item) {
  if (!item.examples || !item.examples.length) return null;
  const list = el('ul', 'examples');
  list.setAttribute('aria-label', T('Examples'));
  item.examples.forEach(([de, en]) => {
    const row = el('li', 'example');
    const german = el('span', 'example-de', de);
    german.lang = 'de';
    const text = el('span', 'example-text');
    text.append(german, el('span', 'example-meaning', (AM && AM.examples && AM.examples[de]) || en));
    row.append(listenButton(de), text);
    const clock = clockPics(clocksFor(de), 'small');
    if (clock) { row.appendChild(clock); row.classList.add('has-clock'); }
    list.appendChild(row);
  });
  return list;
}

// Shared end-of-exercise screen.
function resultPanel({ title, text, stats = [], buttons }) {
  const box = el('div', 'panel narrow result view-enter');
  box.innerHTML = `<div class="result-icon ethiopic" aria-hidden="true">፨</div><h2></h2><p></p>
    <div class="result-stats">${stats.map(([value, label, tone]) => `<div class="stat ${tone || ''}"><b>${value}</b><span>${label}</span></div>`).join('')}</div>
    <div class="actions center"></div>`;
  box.querySelector('h2').textContent = title;
  box.querySelector('p').textContent = text;
  buttons.forEach(([label, cls, onClick]) => {
    const b = el('button', 'btn ' + cls, label);
    b.type = 'button';
    b.onclick = onClick;
    box.querySelector('.actions').appendChild(b);
  });
  return box;
}

// "Start again" at the top of every exercise. When answers would be lost it asks first, in words, so a stray tap
// costs nothing; with nothing answered yet it starts again straight away.
function redoBar(restart, hasProgress = () => true) {
  const bar = el('div', 'redo-bar');
  const ask = () => {
    bar.classList.add('asking');
    bar.innerHTML = `<span class="redo-question">${T('Start this exercise again? Your answers so far will be lost.')}</span>`;
    const no = el('button', 'btn', T('No, continue'));
    const yes = el('button', 'btn btn-primary', T('Yes, start again'));
    no.type = yes.type = 'button';
    no.onclick = idle;
    yes.onclick = restart;
    bar.append(no, yes);
    yes.focus({ preventScroll: true });
  };
  const idle = () => {
    bar.classList.remove('asking');
    bar.innerHTML = '';
    const btn = el('button', 'btn redo-btn');
    btn.type = 'button';
    btn.innerHTML = `${icon('redo')}${T('Start again')}`;
    btn.onclick = () => (hasProgress() ? ask() : restart());
    bar.appendChild(btn);
  };
  idle();
  return bar;
}

/* ---------------- Audio ---------------- */

let currentVoice = 'katja';
let clipIds = {};
let currentAudio = null;
// Always fetch a fresh manifest: a cached copy from before new units were added would send them to the browser voice.
const clipsReady = fetch(`${APP.audioBase}manifest.json`, { cache: 'no-store' }).then(r => r.json()).then(m => { clipIds = m; }).catch(() => {});

// Neural recordings live in <audioBase><voice>/<speed>/<id>.mp3; the browser voice is only a fallback.
async function speak(text) {
  if (currentAudio) currentAudio.pause();
  tts.cancel();
  await clipsReady;
  const id = clipIds[text];
  if (!id) return speakWithBrowser(text);
  currentAudio = new Audio(`${APP.audioBase}${currentVoice}/${currentSpeed}/${id}.mp3`);
  currentAudio.play().catch(() => speakWithBrowser(text));
}

function speakWithBrowser(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = { slow: 0.6, normal: 0.85, natural: 1 }[currentSpeed];
  tts.speak(utterance);
}

function setSpeed(speed) {
  currentSpeed = speed;
  store.set('book-pace', speed);
  document.querySelectorAll('.pace-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.speed === speed));
}

function setVoice(voice) {
  currentVoice = voice;
  store.set('book-voice', voice);
  applyCoachLook();
}

function setTheme(theme) {
  store.set('app-theme', theme);
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
}

/* ---------------- Usage statistics ---------------- */

// Anonymous: a random browser id plus what was opened. Sent to server.py; silently ignored by any other server.
const usage = (() => {
  const IDLE = 30 * 60 * 1000;
  const newId = () => (window.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12));
  let enabled = store.get('usage-enabled', true);
  let uid = store.get('usage-uid');
  if (!uid) { uid = newId(); store.set('usage-uid', uid); }
  let lastView = '';
  let lastInput = Date.now();

  function session() {
    const now = Date.now();
    let sid = store.get('usage-sid');
    const fresh = !sid || now - store.get('usage-seen', 0) > IDLE;
    if (fresh) { sid = newId(); store.set('usage-sid', sid); }
    store.set('usage-seen', now);
    return { sid, fresh };
  }

  function send(type, extra = {}) {
    if (!enabled) return;
    const { sid, fresh } = session();
    const post = body => fetch(APP.api.events, { method: 'POST', keepalive: true, credentials: 'same-origin', headers: jsonHeaders(), body: JSON.stringify(body) }).catch(() => {});
    if (fresh && type !== 'session') post({ uid, sid, type: 'session', unit: unit.id });
    post({ uid, sid, type, unit: unit.id, ...extra });
  }

  ['pointerdown', 'keydown', 'scroll'].forEach(ev => addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true }));
  // One "active" event per minute of study: the tab is visible and the learner did something in the last two minutes.
  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastInput < 2 * 60 * 1000) send('active');
  }, 60 * 1000);

  return {
    view(mode, scope) {
      const key = `${unit.id}|${mode}|${scope}`;
      if (key === lastView) return;
      lastView = key;
      send('view', { mode, scope });
    },
    grammar(scope, score) { send('grammar', { mode: 'grammar', scope, value: score }); },
    get enabled() { return enabled; },
    setEnabled(on) { enabled = on; store.set('usage-enabled', on); },
  };
})();

/* ---------------- Ads (Google AdSense) ---------------- */

// Slots are filled from the ADSENSE_* settings: placeholders until an AdSense publisher id is set.
function renderAds() {
  const cfg = APP.ads || {};
  const slots = document.querySelectorAll('.ad-slot');
  if (!cfg.enabled) { slots.forEach(s => s.remove()); return; }
  if (!cfg.client) {
    const sizes = { top: 'Responsive banner', sidebar: '300 × 250', bottom: 'Responsive banner' };
    slots.forEach(s => {
      s.innerHTML = `<div class="ad-placeholder" aria-hidden="true"><div><b>${T('Advertisement')}</b><br>Google AdSense · “${s.dataset.ad}” slot · ${sizes[s.dataset.ad]}</div></div>`;
    });
    return;
  }
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cfg.client)}`;
  document.head.appendChild(script);
  slots.forEach(s => {
    const id = cfg.slots?.[s.dataset.ad];
    if (!id) { s.remove(); return; }
    s.innerHTML = `<span class="ad-label">${T('Advertisement')}</span>`;
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient = cfg.client;
    ins.dataset.adSlot = id;
    ins.dataset.adFormat = s.dataset.ad === 'sidebar' ? 'rectangle' : 'auto';
    ins.dataset.fullWidthResponsive = 'true';
    s.appendChild(ins);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  });
}

/* ---------------- Accounts ---------------- */

// Optional: guests keep using the course; signed-in learners have their words and grammar results saved on the server.
// Cleared on sign-out, so the next person on this browser starts fresh (their progress is safe in the account).
const SYNCED_KEYS = ['book-learned', 'grammar-scores', 'sync-outbox', 'sync-seen-learned', 'sync-seen-grammar', 'sync-account', 'sync-facts'];
let account = null;
let syncTimer = null;
let lastSynced = null;

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: jsonHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  // Server messages are English; the course shows them in the interface language.
  if (!res.ok) {
    const error = new Error(T(data.error || 'Something went wrong. Please try again.'));
    error.status = res.status;
    throw error;
  }
  return data;
}

function renderAccountButton() {
  const btn = document.getElementById('account-btn');
  btn.classList.toggle('signed-in', !!account);
  if (account) {
    btn.innerHTML = `<span class="avatar"></span><span id="account-label"></span>`;
    btn.querySelector('.avatar').textContent = account.name.trim()[0].toUpperCase();
    btn.querySelector('#account-label').textContent = account.name.split(' ')[0];
    btn.setAttribute('aria-label', T('Account: {name}', { name: account.name }));
  } else {
    btn.innerHTML = '<svg class="icon"><use href="#i-user"/></svg><span id="account-label"></span>';
    btn.querySelector('#account-label').textContent = T('Sign in');
    btn.setAttribute('aria-label', T('Sign in'));
  }
}

function showAccountView(view) {
  document.querySelectorAll('#account .auth-form').forEach(f => { f.hidden = f.dataset.view !== view; });
  document.getElementById('account-title').textContent = { signin: T('Sign in'), register: T('Create account'), profile: T('Your account') }[view];
  accountMessage('');
  if (view === 'profile') {
    document.getElementById('profile-avatar').textContent = account.name.trim()[0].toUpperCase();
    document.getElementById('profile-name').textContent = account.name;
    document.getElementById('profile-email').textContent = `@${account.username} · ${account.email}`;
    document.getElementById('admin-link').hidden = account.role !== 'admin';
    document.getElementById('sync-note').textContent = lastSynced
      ? T('Your progress is saved to your account · last saved {time}.', { time: lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
      : T('Your progress is saved to your account.');
  }
  const first = document.querySelector(`#account .auth-form[data-view="${view}"] input`);
  if (first && document.getElementById('account').open) first.focus();
}

function accountMessage(text, ok = false) {
  const box = document.getElementById('account-error');
  box.hidden = !text;
  box.textContent = text;
  box.classList.toggle('ok', ok);
}

function openAccount() {
  document.getElementById('account').showModal();
  showAccountView(account ? 'profile' : 'signin');
}

async function submitAuth(event, kind) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('[type=submit]');
  const body = Object.fromEntries(new FormData(form));
  button.disabled = true;
  try {
    const { user } = await api(APP.api[kind], 'POST', body);
    account = user;
    form.reset();
    renderAccountButton();
    await startSync();
    showAccountView('profile');
    accountMessage(kind === 'register' ? T('Welcome, {name}! Your progress will now be saved.', { name: user.name }) : T('Welcome back, {name}.', { name: user.name }), true);
  } catch (err) {
    accountMessage(err.message);
  } finally {
    button.disabled = false;
  }
  return false;
}

async function changePassword(event) {
  event.preventDefault();
  const form = event.target;
  try {
    await api(APP.api.password, 'POST', Object.fromEntries(new FormData(form)));
    form.reset();
    form.closest('details').open = false;
    accountMessage(T('Your password has been changed.'), true);
  } catch (err) {
    accountMessage(err.message);
  }
  return false;
}

async function signOut() {
  await syncNow();
  try { await api(APP.api.logout, 'POST', {}); } catch (e) {}
  // The progress is safe in the account; clear it here so the next person on this device starts fresh.
  SYNCED_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  account = null;
  location.reload();
}

/* ---------------- Progress sync ----------------
   Every change is recorded as an operation (a word marked, a score, XP, the open exercise) and sent to the
   account (apps/course/sync.py), which applies each once and answers with the whole state, including what other
   devices did. A live connection (/ws/v1/) says when another device changed something. Operations wait in
   localStorage while offline or signed out, and are sent once there is an account to send them to. */

const XP = { newWord: 10, answerRight: 10, lessonPassed: 25, perfect: 15 }; // as in the app (mobile/src/features/gamification/xp.ts)
const syncId = () => window.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
const deviceId = store.get('sync-device') || `web-${syncId()}`;
store.set('sync-device', deviceId);
let outbox = store.get('sync-outbox', []);
// What this page last recorded, so a change becomes an operation once.
let seenLearned = new Set(store.get('sync-seen-learned', [...learned]));
let seenGrammar = store.get('sync-seen-grammar', { ...grammarScores });
let revision = null;
let syncing = false;
let syncAgain = false;
let pendingResume = null;

const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const operation = (kind, fields) => ({ id: syncId(), kind, at: Date.now(), day: dayKey(), ...fields });

function queue(...ops) {
  if (!ops.length) return;
  outbox = [...outbox, ...ops].slice(-2000);
  store.set('sync-outbox', outbox);
  if (account) { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 800); }
  renderStreak();
}

function remember() {
  store.set('sync-seen-learned', [...seenLearned]);
  store.set('sync-seen-grammar', seenGrammar);
}

// Called by store.set for the progress keys: what changed since last time, as operations.
function scheduleSync(key) {
  if (key === 'book-learned') {
    const ops = [];
    learned.forEach(german => { if (!seenLearned.has(german)) ops.push(operation('word', { german, learned: true })); });
    seenLearned.forEach(german => { if (!learned.has(german)) ops.push(operation('word', { german, learned: false })); });
    const added = ops.filter(op => op.learned).length;
    if (added) ops.push(operation('xp', { amount: added * XP.newWord }));
    seenLearned = new Set(learned);
    remember();
    queue(...ops);
  } else if (key === 'grammar-scores') {
    const ops = Object.entries(grammarScores)
      .filter(([lesson, score]) => Number.isInteger(score) && score > (seenGrammar[lesson] ?? -1))
      .map(([lesson, score]) => operation('score', { lesson, score }));
    seenGrammar = { ...grammarScores };
    remember();
    queue(...ops);
  }
}

// The account's state, with operations still on their way replayed on top, so nothing jumps back on screen.
function applySnapshot(snapshot) {
  revision = snapshot.revision;
  streakFacts = { days: snapshot.days || [], xp: snapshot.xp || {}, goals: snapshot.goals || [] };
  store.set('sync-facts', streakFacts);
  renderStreak();
  const words = new Set(snapshot.learned);
  const scores = { ...snapshot.grammar };
  outbox.forEach(op => {
    if (op.kind === 'word') op.learned ? words.add(op.german) : words.delete(op.german);
    if (op.kind === 'score') scores[op.lesson] = Math.max(op.score, scores[op.lesson] ?? 0);
  });
  seenLearned = new Set(words);
  seenGrammar = { ...scores };
  remember();
  const same = words.size === learned.size && [...words].every(w => learned.has(w)) && JSON.stringify(scores) === JSON.stringify(grammarScores);
  if (same) return;
  learned = words;
  grammarScores = scores;
  store.set('book-learned', [...learned]);
  store.set('grammar-scores', grammarScores);
  mqBuiltFor = fcBuiltFor = prBuiltFor = learnBuiltFor = speakBuiltFor = null;
  renderUnits();
  updateProgress();
  renderPage();
}

async function syncNow() {
  if (!account) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  clearTimeout(syncTimer);
  const sending = outbox.slice(0, 500);
  let ok = false;
  try {
    const snapshot = sending.length
      ? await api(APP.api.sync, 'POST', { ops: sending, device: deviceId })
      : await api(APP.api.sync);
    const sent = new Set(sending.map(op => op.id));
    outbox = outbox.filter(op => !sent.has(op.id));
    store.set('sync-outbox', outbox);
    lastSynced = new Date();
    applySnapshot(snapshot);
    offerResume(snapshot.session);
    ok = true;
  } catch (error) {
    // Refused (malformed, e.g. from an older page): drop that batch so it can't block the rest. Offline: keep it.
    if (error.status === 400) {
      const sent = new Set(sending.map(op => op.id));
      outbox = outbox.filter(op => !sent.has(op.id));
      store.set('sync-outbox', outbox);
    } else {
      syncTimer = setTimeout(syncNow, 30000);
    }
  } finally {
    syncing = false;
  }
  // More to send, or another device changed something meanwhile: go again. After a failure the retry above waits.
  if (ok && (syncAgain || outbox.length)) {
    syncAgain = false;
    syncTimer = setTimeout(syncNow, outbox.length ? 800 : 0);
  }
}

// First sign-in in this browser: what was learned here before joins the account (nothing is un-marked).
async function joinAccount() {
  if (store.get('sync-account') === account.id) return;
  try {
    const snapshot = await api(APP.api.sync);
    const have = new Set(snapshot.learned);
    const ops = [...learned].filter(german => !have.has(german)).map(german => operation('word', { german, learned: true }));
    Object.entries(grammarScores).forEach(([lesson, score]) => {
      if (Number.isInteger(score) && score > (snapshot.grammar[lesson] ?? -1)) ops.push(operation('score', { lesson, score }));
    });
    queue(...ops);
    store.set('sync-account', account.id);
  } catch (e) {}
}

async function startSync() {
  await joinAccount();
  await syncNow();
  connectLive(true);
}

/* Live updates: progress from the learner's other devices, and text an admin published. */
let live = null;
let liveRetry = 1000;

function connectLive(restart = false) {
  if (!('WebSocket' in window)) return;
  if (live && restart) { live.onclose = null; live.close(); live = null; }
  if (live) return;
  const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${APP.api.live}`);
  live = socket;
  socket.onopen = () => { liveRetry = 1000; };
  socket.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch (e) { return; }
    if (message.type === 'progress' && message.origin !== deviceId && message.revision !== revision) syncNow();
    if (message.type === 'content') liveBanner(T('The course text was just updated.'), T('Refresh'), () => location.reload());
  };
  socket.onclose = () => {
    if (live !== socket) return;
    live = null;
    setTimeout(connectLive, liveRetry);
    liveRetry = Math.min(liveRetry * 2, 60000);
  };
}

// Coming back to the tab: catch up at once rather than waiting for the next message.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && account) syncNow(); });
addEventListener('online', () => { if (account) syncNow(); });

function liveBanner(text, action, onAction) {
  let banner = document.getElementById('live-banner');
  if (!banner) {
    banner = el('div', 'live-banner');
    banner.id = 'live-banner';
    banner.setAttribute('role', 'status');
    document.body.appendChild(banner);
  }
  banner.innerHTML = '<span></span><button class="btn btn-primary" type="button"></button><button class="btn" type="button"></button>';
  banner.querySelector('span').textContent = text;
  const [go, close] = banner.querySelectorAll('button');
  go.textContent = action;
  close.textContent = T('Not now');
  go.onclick = () => { banner.remove(); onAction(); };
  close.onclick = () => banner.remove();
}

/* Resume anywhere: the open exercise is saved with the account, so another device can continue at that question. */
function recordQuizSession(done) {
  if (!gQuiz || gQuiz.kind !== 'data') return;
  queue(operation('session', {
    session: done ? null : {
      kind: 'quiz', ref: currentScope, items: gQuiz.items, answers: gQuiz.answers,
      position: gQuiz.index, platform: 'web', device: deviceId,
    },
  }));
}

function offerResume(session) {
  if (!session || session.kind !== 'quiz' || session.device === deviceId) return;
  // The exercise may be in any unit, not only the one open on this page.
  // A family tree is matched on the tree here, not question by question as the app does it.
  const home = COURSE_UNITS.find(u => u.grammar.some(g => g.key === session.ref && g.quiz && !g.custom && !g.tree));
  if (!home || session.position >= session.items.length || store.get('resume-dismissed') === session.id) return;
  if (gQuiz && gQuiz.kind === 'data' && currentScope === session.ref) return; // already doing it here
  const lesson = home.grammar.find(g => g.key === session.ref);
  liveBanner(
    T('Continue where you stopped on another device: {title}, question {n} of {total}.', {
      title: L(lesson.title), n: session.position + 1, total: session.items.length,
    }),
    T('Continue'),
    () => { pendingResume = session; openStep(home.id, session.ref); setGrammarView('exercise'); },
  );
  document.querySelector('#live-banner .btn:not(.btn-primary)').addEventListener('click', () => store.set('resume-dismissed', session.id));
}

/* ---------------- Streak tally ----------------
   The stick-strikeout streak, drawn by static/core/js/tally-view.js from tally.js (the same rules, layout and
   timing as the app): one stick per day of the streak, struck out on days that reached the daily goal. */
let streakFacts = store.get('sync-facts', { days: [], xp: {}, goals: [] });
const PRACTICE_KINDS = ['word', 'review', 'score', 'xp'];

// The account's facts with this page's waiting operations on top: the tally moves the moment XP is earned.
function localFacts() {
  const days = new Set(streakFacts.days);
  const xp = { ...streakFacts.xp };
  const goals = [...streakFacts.goals];
  outbox.forEach(op => {
    if (PRACTICE_KINDS.includes(op.kind)) days.add(op.day);
    if (op.kind === 'xp') xp[op.day] = (xp[op.day] || 0) + op.amount;
    if (op.kind === 'goal') goals.push([op.day, op.at, op.xp, op.id]);
  });
  return { days: [...days], xp, goals };
}

const streakModel = () => ZemaTally.timeline({ ...localFacts(), today: ZemaTally.today() });

function streakLabel(model) {
  return [
    model.streak ? T('{n}-day streak', { n: model.streak }) : T('No streak yet'),
    model.todayMet ? T("Today's goal reached") : T('Today: {xp} of {goal} XP', { xp: model.todayXp, goal: model.goal }),
    freezeText(model.freezes),
  ].filter(Boolean).join(' · ');
}

function freezeText(n) {
  return !n ? '' : n === 1 ? T('1 streak freeze ready') : T('{n} streak freezes ready', { n });
}

// The legend's small examples, drawn with the same colours as the tally.
function legendIcon(state) {
  const colour = { met: 'var(--text)', kept: 'var(--text)', today: 'var(--gold-bright)', frozen: 'var(--freeze)', missed: 'var(--border-strong)' }[state];
  const glow = state === 'today' ? '<line x1="9" y1="3" x2="9" y2="19" stroke="var(--gold-bright)" stroke-width="9" opacity=".35" stroke-linecap="round"/>' : '';
  const dash = state === 'missed' ? ' stroke-dasharray="3 4"' : '';
  const strike = state === 'met' ? '<line x1="3" y1="16" x2="15" y2="6" stroke="var(--flame)" stroke-width="4" stroke-linecap="round"/>' : '';
  return `<svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">${glow}<line x1="9" y1="3" x2="9" y2="19" stroke="${colour}" stroke-width="3" stroke-linecap="round"${dash}/>${strike}</svg>`;
}

function renderStreakPanel(model) {
  const headline = document.getElementById('streak-headline');
  headline.textContent = model.streak ? T('{n}-day streak', { n: model.streak }) : T('No streak yet');
  if (model.freezes) {
    const freezes = el('span', 'streak-freezes');
    freezes.textContent = freezeText(model.freezes);
    headline.appendChild(freezes);
  }
  ZemaTallyView.render(document.getElementById('streak-full'), model, 'full', streakLabel(model));
  document.getElementById('streak-today').textContent = model.todayMet
    ? T("Today's goal reached")
    : T('Today: {xp} of {goal} XP', { xp: model.todayXp, goal: model.goal });
  const legend = document.getElementById('streak-legend');
  legend.innerHTML = '';
  [['met', T('Goal reached: struck off')], ['kept', T('Practised: streak kept')], ['today', T('Today: waiting for you')],
    ['frozen', T('Streak freeze: a missed day covered')], ['missed', T('Missed: the streak starts again')]].forEach(([state, text]) => {
    const item = el('span');
    item.innerHTML = legendIcon(state);
    item.appendChild(document.createTextNode(text));
    legend.appendChild(item);
  });
  document.querySelectorAll('#goal-buttons button').forEach(b => {
    const on = Number(b.dataset.goal) === model.goal;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
  document.getElementById('goal-note').textContent = T('{n} XP a day', { n: model.goal });
}

function renderStreak() {
  if (!window.ZemaTally) return;
  const model = streakModel();
  const label = streakLabel(model);
  const button = document.getElementById('streak-btn');
  if (button) {
    ZemaTallyView.render(document.getElementById('streak-tally'), model, 'compact', label);
    button.classList.toggle('met', model.todayMet);
    button.setAttribute('aria-label', `${T('Your streak')}: ${label}`);
  }
  if (document.getElementById('streak')?.open) renderStreakPanel(model);
  const profile = document.getElementById('profile-tally');
  if (profile && account) ZemaTallyView.render(profile, model, 'full', label);
  renderRail();
}

function openStreak() {
  renderStreakPanel(streakModel());
  document.getElementById('streak').showModal();
}

// The daily goal syncs like progress: every device judges each day by the goal in force that day.
document.querySelectorAll('#goal-buttons button').forEach(b => {
  b.onclick = () => queue(operation('goal', { xp: Number(b.dataset.goal) }));
});
// A new day starts a new stick at midnight, even with the page left open.
setInterval(() => { if (document.visibilityState === 'visible') renderStreak(); }, 60000);
renderStreak();

/* ---------------- Progress column ----------------
   Beside the lesson on wide screens, below it on smaller ones: today's XP against the daily goal and the
   streak, the next step with how long it takes, milestones, and the whole course's progress. Everything comes
   from the learner's own progress; nothing is invented to look busy. */
const RING = 2 * Math.PI * 40;
const SECONDS_PER_WORD = 20; // a word met, heard and checked in Learn
const MINUTES_PER_LESSON = 4;
const FLAME = '<svg class="rail-flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z"/></svg>';
const BADGES = [
  { id: 'first-words', icon: icon('learn'), name: () => T('First words'), goal: f => [f.words, 10] },
  { id: 'hundred-words', icon: icon('cards'), name: () => T('100 words'), goal: f => [f.words, 100] },
  { id: 'halfway', icon: icon('list'), name: () => T('Halfway there'), goal: f => [f.words, Math.ceil(f.total / 2)] },
  { id: 'first-test', icon: icon('trophy'), name: () => T('First unit test'), goal: f => [f.tests, 1] },
  { id: 'week-streak', icon: FLAME, name: () => T('7-day streak'), goal: f => [f.streak, 7] },
  { id: 'month-streak', icon: FLAME, name: () => T('30-day streak'), goal: f => [f.streak, 30] },
];
const lessonPassed = g => (grammarScores[g.key] ?? -1) >= (g.custom === 'review' ? Math.ceil(REVIEW_QUIZ_SIZE * GRAMMAR_PASS / GRAMMAR_QUIZ_SIZE) : GRAMMAR_PASS);

// The next thing to do: the first section with words left, starting from the open one; then the first lesson
// not yet passed; null when the course is done.
function nextStep() {
  const sections = COURSE_UNITS.flatMap(u => u.sections.map(s => ({ u, s })));
  const from = Math.max(0, sections.findIndex(x => x.s.key === currentScope));
  for (const { u, s } of [...sections.slice(from), ...sections.slice(0, from)]) {
    const left = new Set(s.words.filter(w => !learned.has(w.german)).map(w => w.german)).size;
    if (left) return { u, key: s.key, title: s.title, left, minutes: Math.max(1, Math.round(left * SECONDS_PER_WORD / 60)), lesson: false };
  }
  for (const u of COURSE_UNITS) {
    const g = u.grammar.find(x => !lessonPassed(x));
    if (g) return { u, key: g.key, title: g.title, minutes: MINUTES_PER_LESSON, lesson: true };
  }
  return null;
}

function goToStep(step) {
  if (step.u !== unit) switchUnit(step.u.id);
  goTo({ scope: step.key, mode: step.lesson ? currentMode : 'learn' });
  document.querySelector('main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderRail() {
  const rail = document.getElementById('rail');
  if (!rail || !railReady || !window.ZemaTally) return;
  const model = streakModel();
  const words = new Set(COURSE_UNITS.flatMap(u => u.sections.flatMap(s => s.words.map(w => w.german))));
  const known = [...words].filter(g => learned.has(g)).length;
  const lessons = COURSE_UNITS.flatMap(u => u.grammar);
  const passed = lessons.filter(lessonPassed).length;
  const tests = COURSE_UNITS.filter(u => u.grammar.some(g => g.custom === 'review' && lessonPassed(g))).length;
  const facts = { words: known, total: words.size, tests, streak: model.streak };
  const share = Math.min(1, model.todayXp / Math.max(1, model.goal));
  const step = nextStep();

  // Badges stay earned once earned, even if a streak later breaks.
  const earned = new Set(store.get('badges-earned', []));
  const fresh = BADGES.filter(b => { const [have, need] = b.goal(facts); return have >= need && !earned.has(b.id); }).map(b => b.id);
  fresh.forEach(id => earned.add(id));
  if (fresh.length) store.set('badges-earned', [...earned]);

  if (!rail.childElementCount) {
    rail.innerHTML = `
      <section class="rail-card rail-today">
        <button class="rail-today-btn" type="button" onclick="openStreak()">
          <span class="rail-ring" aria-hidden="true">
            <svg viewBox="0 0 96 96"><circle class="ring-track" cx="48" cy="48" r="40"/><circle class="ring-fill" cx="48" cy="48" r="40" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/></svg>
            <span class="ring-centre"><b class="ring-xp"></b><small class="ring-goal"></small></span>
          </span>
          <span class="rail-today-text">
            <span class="rail-kicker">${T('Today')}</span>
            <span class="rail-streak">${FLAME}<b class="streak-count"></b></span>
            <span class="rail-nudge"></span>
            <span class="rail-tally"></span>
          </span>
        </button>
      </section>
      <section class="rail-card rail-next" aria-live="polite"></section>
      <section class="rail-card rail-badges">
        <h2 class="rail-title">${T('Milestones')}</h2>
        <ul class="milestone-grid"></ul>
      </section>
      <section class="rail-card rail-course">
        <h2 class="rail-title">${T('Your course')}</h2>
        <div class="rail-meter"><span class="rail-meter-label"></span><span class="rail-bar"><i class="rail-words"></i></span></div>
        <div class="rail-meter"><span class="rail-meter-label"></span><span class="rail-bar gold"><i class="rail-lessons"></i></span></div>
      </section>`;
  }

  // Today: the ring fills with today's XP; it turns gold once the goal is reached.
  const today = rail.querySelector('.rail-today');
  today.classList.toggle('met', model.todayMet);
  requestAnimationFrame(() => { rail.querySelector('.ring-fill').style.strokeDashoffset = RING * (1 - share); });
  const xp = rail.querySelector('.ring-xp');
  xp.textContent = model.todayXp;
  xp.classList.toggle('long', String(model.todayXp).length > 3); // a big day still fits inside the ring
  rail.querySelector('.ring-goal').textContent = T('of {goal} XP', { goal: model.goal });
  rail.querySelector('.streak-count').textContent = model.streak ? T('{n}-day streak', { n: model.streak }) : T('No streak yet');
  rail.querySelector('.rail-nudge').textContent = model.todayMet
    ? T('Today is struck off. See you tomorrow!')
    : T('{n} XP more strikes off today', { n: model.goal - model.todayXp }) + (model.freezes ? ` · ${freezeText(model.freezes)}` : '');
  ZemaTallyView.render(rail.querySelector('.rail-tally'), model, 'compact', streakLabel(model));
  rail.querySelector('.rail-today-btn').setAttribute('aria-label', `${T('Your streak')}: ${streakLabel(model)}`);

  // Up next: the exact next step, with how much is left and roughly how long it takes.
  const next = rail.querySelector('.rail-next');
  next.innerHTML = '';
  if (step) {
    const here = step.key === currentScope;
    next.append(el('span', 'rail-kicker', here ? T('Keep going') : T('Up next')), el('h2', 'rail-next-title', step.title));
    next.append(el('p', 'rail-meta', `${unitName(step.u)} · ${step.lesson ? lessonsLabel() : T('{n} words to learn', { n: step.left })}`));
    const go = el('button', 'btn btn-primary rail-cta');
    go.type = 'button';
    go.innerHTML = `<span></span>${icon('arrow')}`;
    go.firstChild.textContent = `${step.lesson ? T('Start lesson') : here ? T('Continue') : T('Begin')} · ${T('about {n} min', { n: step.minutes })}`;
    go.onclick = () => goToStep(step);
    next.appendChild(go);
  } else {
    next.append(el('span', 'rail-kicker', T('Well done')), el('h2', 'rail-next-title', T('You have finished the course')));
  }

  // Milestones: earned ones in gold; the rest show how far there is to go.
  const grid = rail.querySelector('.milestone-grid');
  grid.innerHTML = '';
  BADGES.forEach(b => {
    const [have, need] = b.goal(facts);
    const on = earned.has(b.id);
    const item = el('li', `milestone${on ? ' earned' : ''}${fresh.includes(b.id) ? ' just' : ''}`);
    item.innerHTML = `<span class="milestone-medal" aria-hidden="true">${b.icon}</span>`;
    item.append(el('span', 'milestone-name', b.name()), el('span', 'milestone-progress', on ? T('Earned') : `${Math.min(have, need)}/${need}`));
    item.setAttribute('aria-label', `${b.name()}: ${on ? T('Earned') : `${Math.min(have, need)} / ${need}`}`);
    grid.appendChild(item);
  });

  // The whole course
  const [wordsLabel, lessonsLabelEl] = rail.querySelectorAll('.rail-meter-label');
  wordsLabel.textContent = T('{known} of {total} words', { known, total: words.size });
  lessonsLabelEl.textContent = T('{passed} of {total} lessons', { passed, total: lessons.length });
  requestAnimationFrame(() => {
    rail.querySelector('.rail-words').style.width = `${Math.round(known / words.size * 100)}%`;
    rail.querySelector('.rail-lessons').style.width = `${Math.round(passed / Math.max(1, lessons.length) * 100)}%`;
  });
}

async function loadAccount() {
  try {
    const { user } = await api(APP.api.me);
    account = user;
  } catch (e) {
    account = null;
  }
  renderAccountButton();
  if (account) startSync();
  else connectLive();
}

addEventListener('pagehide', () => {
  if (!account || !outbox.length) return;
  // keepalive lets the request finish after the page is gone.
  fetch(APP.api.sync, { method: 'POST', keepalive: true, credentials: 'same-origin', headers: jsonHeaders(), body: JSON.stringify({ ops: outbox.slice(0, 500), device: deviceId }) }).catch(() => {});
});

function openSettings() { document.getElementById('settings').showModal(); }

/* ---------------- Search ---------------- */

// The whole course, searched in the page (search.js). The index is built on the first search; the Amharic meanings
// (course-am.js) load then even in the English interface, so a learner can always type in Amharic.
let searchIndex = null;
let searchTimer = 0;
const SEARCH_TRIES = ['Danke', 'schoen', 'how to order food', 'accusative', 'past tense', 'ምግብ'];
// What the search is narrowed to (search.js `fits`): result type, word type, unit, chapter, level.
const NO_FILTERS = { types: [], pos: [], unit: null, section: null, level: null };
let searchFilters = { ...NO_FILTERS };
const SEARCH_TYPES = [['word', T('Words')], ['grammar', T('Grammar')], ['reading', T('Reading')], ['chapter', T('Word lists')], ['topic', T('Topics')]];
const WORD_TYPES = [['noun', T('Nouns'), T('Noun')], ['verb', T('Verbs'), T('Verb')], ['adjective', T('Adjectives & adverbs'), T('Adjective / adverb')],
  ['phrase', T('Phrases'), T('Phrase')], ['number', T('Numbers'), T('Number')], ['small', T('Small words'), T('Small word')]];
const COURSE_LEVELS = [...new Set(COURSE_UNITS.map(u => u.level).filter(Boolean))];
const filtersOn = () => searchFilters.types.length + searchFilters.pos.length + (searchFilters.unit !== null) + !!searchFilters.level;

function buildSearchIndex() {
  searchIndex = window.CourseSearch.createIndex(SEARCH_SOURCE, window.COURSE_AM || null, T);
}

// The search narrowed to where the learner is: this chapter (or this unit, from "All chapters").
function searchHere() {
  const scope = currentScope === 'all' || isGrammar(currentScope) ? { unit: unit.id } : { unit: unit.id, section: currentScope };
  openSearch('', scope);
}

// From the header: the whole course (filters the learner chose stay). With a scope: only there.
function openSearch(query, scope) {
  searchFilters = { ...searchFilters, unit: null, section: null, ...(scope || {}) };
  const dialog = document.getElementById('search');
  const input = document.getElementById('search-input');
  if (!searchIndex) buildSearchIndex();
  if (!window.COURSE_AM && !dialog.dataset.loading) {
    dialog.dataset.loading = 'yes';
    const script = document.createElement('script');
    script.src = dialog.dataset.amharic;
    script.onload = () => { buildSearchIndex(); runSearch(); };
    document.head.appendChild(script);
  }
  if (typeof query === 'string') input.value = query;
  if (!dialog.open) dialog.showModal();
  input.focus();
  input.select();
  runSearch();
}

function runSearch() {
  const input = document.getElementById('search-input');
  const box = document.getElementById('search-results');
  const query = input.value.trim();
  document.getElementById('search-clear').hidden = !input.value;
  renderSearchScope();
  renderSearchFilters();
  box.innerHTML = '';
  const narrowed = filtersOn() || searchFilters.section;
  const results = query || narrowed ? searchIndex.search(query, { filters: searchFilters }) : [];
  renderSuggestions(query, results);
  if (!query && !narrowed) return box.appendChild(searchTries(T('Try one of these:')));
  if (!results.length) {
    const empty = el('div', 'search-empty');
    empty.append(el('p', 'search-empty-title', query ? T('Nothing found for “{q}”.', { q: query }) : T('Nothing here fits these filters.')),
      el('p', '', narrowed ? T('Try fewer filters, or search the whole course.') : T('Try another spelling or a shorter word, or type it in English or Amharic.')));
    box.appendChild(empty);
    if (!narrowed) box.appendChild(searchTries(T('Or try one of these:')));
    return;
  }
  const groups = { topic: [], word: [], lesson: [], chapter: [] };
  results.forEach(r => groups[r.kind].push(r));
  const names = { topic: T('Topics'), word: T('Words'), lesson: T('Lessons'), chapter: T('Chapters') };
  Object.entries(groups).filter(([, list]) => list.length)
    .sort(([, a], [, b]) => b[0].score - a[0].score)
    .forEach(([kind, list]) => {
      const group = el('section', 'search-group');
      const head = el('h3', 'search-group-title', names[kind]);
      head.appendChild(el('span', 'search-count', String(list.length)));
      const items = el('ul', 'search-list');
      list.forEach(r => items.appendChild(searchItem(r)));
      group.append(head, items);
      box.appendChild(group);
    });
}

// Where a scoped search looks, with the way out to the whole course.
function renderSearchScope() {
  const box = document.getElementById('search-scope');
  const { unit: unitId, section } = searchFilters;
  box.hidden = unitId === null && !section;
  if (box.hidden) return;
  box.innerHTML = '';
  const where = section ? searchWhere(unitId, section) : unitName(unitById(unitId));
  const label = el('span', 'search-scope-label', T('Only in: {place}', { place: where }));
  const wide = el('button', 'btn btn-ghost', T('Search the whole course'));
  wide.type = 'button';
  wide.onclick = () => { searchFilters = { ...searchFilters, unit: null, section: null }; runSearch(); };
  box.append(label, wide);
}

// Autocomplete: the best matches' names, a tap away (also how a misspelling finds its word).
function renderSuggestions(query, results) {
  const box = document.getElementById('search-suggest');
  const folded = window.CourseSearch.fold(query);
  const names = [...new Set(results.slice(0, 12).map(r => (r.kind === 'word' ? r.id : T(r.title))))]
    .filter(name => window.CourseSearch.fold(name) !== folded).slice(0, 5);
  box.hidden = !query || !names.length;
  box.innerHTML = '';
  if (box.hidden) return;
  box.appendChild(el('span', 'search-suggest-label', T('Suggestions:')));
  names.forEach(name => {
    const chip = el('button', 'chip', name);
    chip.type = 'button';
    chip.onclick = () => openSearch(name, { unit: searchFilters.unit, section: searchFilters.section });
    box.appendChild(chip);
  });
}

// The filters: what to show, which kind of word, which unit (and level, once the course has more than one).
function renderSearchFilters() {
  const body = document.getElementById('search-filter-body');
  const count = filtersOn();
  const badge = document.getElementById('search-filter-count');
  badge.hidden = !count;
  badge.textContent = String(count);
  body.innerHTML = '';
  const row = (label, options, value, onPick) => {
    const group = el('div', 'search-filter-row');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    group.appendChild(el('span', 'search-filter-label', label));
    const chips = el('div', 'search-try-row');
    options.forEach(([key, name]) => {
      const chip = el('button', 'chip' + (key === value ? ' active' : ''), name);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(key === value));
      chip.onclick = () => { onPick(key); runSearch(); };
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    body.appendChild(group);
  };
  const shown = searchFilters.types[0] || '';
  row(T('Show'), [['', T('All')], ...SEARCH_TYPES], shown, key => {
    searchFilters.types = key ? [key] : [];
    if (key && key !== 'word') searchFilters.pos = [];
  });
  if (!shown || shown === 'word') {
    row(T('Word type'), [['', T('All')], ...WORD_TYPES.map(([k, n]) => [k, n])], searchFilters.pos[0] || '', key => { searchFilters.pos = key ? [key] : []; });
  }
  const select = (label, options, value, onPick) => {
    const group = el('label', 'search-filter-row');
    group.appendChild(el('span', 'search-filter-label', label));
    const pick = el('select', 'select');
    options.forEach(([key, name]) => {
      const option = el('option', '', name);
      option.value = key;
      option.selected = key === value;
      pick.appendChild(option);
    });
    pick.onchange = () => { onPick(pick.value); runSearch(); };
    group.appendChild(pick);
    body.appendChild(group);
  };
  select(T('Unit'), [['', T('All units')], ...COURSE_UNITS.map(u => [String(u.id), `${unitName(u)} · ${u.title}`])],
    searchFilters.unit === null ? '' : String(searchFilters.unit), key => {
      searchFilters.unit = key === '' ? null : Number(key);
      searchFilters.section = null;
    });
  if (COURSE_LEVELS.length > 1) {
    select(T('Level'), [['', T('All levels')], ...COURSE_LEVELS.map(l => [l, l])], searchFilters.level || '', key => { searchFilters.level = key || null; });
  }
  if (count || searchFilters.section) {
    const reset = el('button', 'btn btn-ghost search-filter-reset', T('Clear filters'));
    reset.type = 'button';
    reset.onclick = () => { searchFilters = { ...NO_FILTERS }; runSearch(); };
    body.appendChild(reset);
  }
}

function searchTries(label) {
  const box = el('div', 'search-tries');
  box.appendChild(el('p', '', label));
  const row = el('div', 'search-try-row');
  SEARCH_TRIES.forEach(text => {
    const chip = el('button', 'chip', text);
    chip.type = 'button';
    chip.onclick = () => openSearch(text);
    row.appendChild(chip);
  });
  box.appendChild(row);
  return box;
}

const unitById = id => COURSE_UNITS.find(u => u.id === id);
const searchWhere = (unitId, key) => {
  const u = unitById(unitId);
  const section = u.sections.find(s => s.key === key);
  return `${unitName(u)} · ${section ? section.title : u.grammar.find(g => g.key === key)?.title || ''}`;
};

function searchItem(r) {
  const item = el('li', `search-item search-item-${r.kind}`);
  const open = el('button', 'search-open');
  open.type = 'button';
  if (r.kind === 'word') {
    const de = el('span', 'search-de');
    de.lang = 'de';
    const gender = showGermanWord(de, r.word);
    const kind = WORD_TYPES.find(([k]) => k === r.pos);
    const place = searchFilters.section && r.sections.includes(searchFilters.section) ? searchFilters.section : r.section;
    const placeUnit = COURSE_UNITS.find(u => u.sections.some(s => s.key === place)).id;
    open.append(de, el('span', 'search-meaning', meaning(r.word)),
      el('span', 'search-where', searchWhere(placeUnit, place) + (kind ? ` · ${kind[2]}` : '') + (gender ? ` · ${GENDER_NAMES[gender]()}` : '')));
    if (r.example !== undefined) {
      const [exDe, exEn] = r.word.examples[r.example];
      const example = el('span', 'search-example');
      const exGerman = el('span', 'search-example-de', exDe);
      exGerman.lang = 'de';
      example.append(exGerman, el('span', 'search-example-meaning', (AM && AM.examples && AM.examples[exDe]) || exEn));
      open.appendChild(example);
    }
    open.onclick = () => openFromSearch(() => showChapter(placeUnit, place, r.id));
    item.append(listenButton(r.id), open);
    return item;
  }
  if (r.kind === 'topic') {
    const card = el('div', 'search-topic');
    card.append(el('span', 'search-kicker', r.topic.kind === 'grammar' ? T('Grammar') : T('Topic')),
      el('strong', 'search-title', T(r.title)));
    const links = el('div', 'search-links');
    const lessonUnit = key => COURSE_UNITS.find(u => u.grammar.some(g => g.key === key)).id;
    const chapterUnit = key => COURSE_UNITS.find(u => u.sections.some(s => s.key === key)).id;
    [...r.topic.lessons.map(key => [lessonUnit(key), key, true]), ...r.topic.chapters.map(key => [chapterUnit(key), key, false])]
      .slice(0, 8)
      .forEach(([unitId, key, lesson]) => {
        const chip = el('button', 'chip', searchWhere(unitId, key));
        chip.type = 'button';
        chip.onclick = () => openFromSearch(() => (lesson ? showLesson(unitId, key) : showChapter(unitId, key)));
        links.appendChild(chip);
      });
    card.appendChild(links);
    item.appendChild(card);
    return item;
  }
  const u = unitById(r.unit);
  if (r.kind === 'lesson') {
    open.append(el('span', 'search-title', T(r.title)), el('span', 'search-where', `${unitName(u)} · ${u.lessonsLabel || T('Grammar')}`));
    open.onclick = () => openFromSearch(() => showLesson(r.unit, r.id));
  } else {
    const count = u.sections.find(s => s.key === r.id).words.length;
    open.append(el('span', 'search-title', T(r.title)), el('span', 'search-where', `${unitName(u)} · ${T('{n} words', { n: count })}`));
    open.onclick = () => openFromSearch(() => showChapter(r.unit, r.id));
  }
  item.appendChild(open);
  return item;
}

function openFromSearch(go) {
  document.getElementById('search').close();
  go();
  const top = document.querySelector('main').getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top, behavior: scrollBehavior() });
}

// A chapter in Learn; with a word, at that word.
function showChapter(unitId, key, german) {
  if (unitId !== unit.id) openStep(unitId, key);
  goTo({ scope: key, mode: 'learn' });
  if (!german) return;
  learnView = 'single';
  store.set('learn-view', 'single');
  learnBuiltFor = key;
  learnIndex = Math.max(0, learnSequence().findIndex(x => x.item.german === german));
  renderLearn();
}

function showLesson(unitId, key) { openStep(unitId, key); }

document.getElementById('search-input').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 120);
});
document.getElementById('search-clear').addEventListener('click', () => openSearch(''));
document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  clearTimeout(searchTimer);
  runSearch();
  document.querySelector('#search-results .search-open, #search-results .search-links .chip')?.click();
});
// "/" or Ctrl/⌘ + K opens the search from anywhere outside a text field.
document.addEventListener('keydown', e => {
  const typing = e.target.matches('input, select, textarea, [contenteditable]');
  if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    openSearch();
  }
});

/* ---------------- Navigation ---------------- */

// Each part reopens where the learner left it.
function goToPart(part) {
  if (part === 'grammar') {
    const last = store.get(`last-grammar-${unit.id}`);
    goTo({ scope: isGrammar(last) ? last : Object.keys(GRAMMAR)[0] });
  } else {
    const last = store.get(`last-vocab-${unit.id}`);
    goTo({ scope: SCOPES.includes(last) ? last : SCOPES[0] });
  }
}

// Switching units keeps the study mode and reopens the unit where the learner left it.
function switchUnit(id) {
  if (id === unit.id) return;
  stopSpeakSession(true);
  loadUnit(id);
  store.set('current-unit', id);
  mqBuiltFor = fcBuiltFor = prBuiltFor = learnBuiltFor = speakBuiltFor = null;
  const last = store.get(`last-vocab-${id}`);
  currentScope = SCOPES.includes(last) ? last : SCOPES[0];
  store.set('book-scope', currentScope);
  renderUnits();
  updateProgress();
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// The course's units as one row of buttons: a familiar icon for each unit's topic, its name under the icon,
// and how much of it is learned. Every name is always shown, so learners see what each unit holds without
// pointing at it. On a phone the row scrolls sideways and the current unit is brought into view.
// Icons: line drawings in the style of the site's other icons, after Lucide (lucide.dev, ISC License,
// Copyright (c) Lucide Contributors). Stroke only, 24 x 24.
const UNIT_ICONS = {
  // Start: pronunciation, the alphabet and numbers: a speech bubble with letters
  0: `<path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/>
      <text x="12" y="14" text-anchor="middle" font-size="8" font-weight="700" font-family="inherit" fill="currentColor" stroke="none">Aa</text>`,
  // 1: introductions and greetings: a waving hand
  1: `<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/>
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
      <path d="M3.5 6.5a5 5 0 0 1 2-3M1.5 5a8 8 0 0 1 3-4"/>`,
  // 2: family and personal details: a family
  2: `<circle cx="9" cy="7" r="4"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>`,
  // 3: food and shopping: a shopping cart
  3: `<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
      <path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1"/>`,
  // 4: home and living: a house
  4: `<path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>`,
  // 5: daily routine and time: a clock
  5: `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`,
  // 6: weather, holidays and hobbies: the sun behind a cloud
  6: `<path d="M12 2v2M4.9 4.9l1.4 1.4M20 12h2M19.1 4.9l-1.4 1.4M15.9 12.7a4 4 0 0 0-5.9-4.1"/>
      <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6z"/>`,
  // 7: jobs and abilities: a briefcase
  7: `<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
  // 8: travel and transport: an aeroplane
  8: `<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>`,
  // 9: yesterday and last year: a calendar with an arrow pointing back
  9: `<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>
      <path d="M16 16H8M11 13l-3 3 3 3"/>`,
};
const UNIT_ICON_DEFAULT = `<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>`; // a book

const unitIcon = id => `<svg class="unit-icon" viewBox="0 0 24 24" aria-hidden="true">${UNIT_ICONS[id] || UNIT_ICON_DEFAULT}</svg>`;

function renderUnits() {
  const nav = document.getElementById('units');
  const testPass = Math.ceil(REVIEW_QUIZ_SIZE * GRAMMAR_PASS / GRAMMAR_QUIZ_SIZE);
  const list = el('ol', 'unit-list');
  COURSE_UNITS.forEach((u, i) => {
    const words = new Map();
    u.sections.forEach(s => s.words.forEach(w => words.set(w.german, w)));
    const known = [...words.keys()].filter(g => learned.has(g)).length;
    const percent = Math.round(known / words.size * 100);
    const test = u.grammar.find(g => g.custom === 'review');
    const passed = test && grammarScores[test.key] >= testPass;
    const item = el('li');
    const btn = el('button', 'unit-btn');
    btn.type = 'button';
    btn.classList.toggle('active', u === unit);
    btn.classList.toggle('done', !!passed);
    if (u === unit) btn.setAttribute('aria-current', 'true');
    btn.innerHTML = `<span class="unit-tile">${unitIcon(u.id)}${passed ? `<span class="unit-check">${icon('check')}</span>` : ''}</span>
      <span class="unit-num"></span><span class="unit-name"></span>
      <span class="unit-bar" aria-hidden="true"><i style="width:${percent}%"></i></span>`;
    btn.querySelector('.unit-num').textContent = unitName(u);
    btn.querySelector('.unit-name').textContent = u.title;
    btn.title = `${unitName(u)}: ${u.title} · ${T('{known} of {total} words learned', { known, total: words.size })}`;
    btn.setAttribute('aria-label', `${unitName(u)}: ${u.title}. ${T('{known} of {total} words learned', { known, total: words.size })}${passed ? ` · ${T('Unit test passed')}` : ''}`);
    btn.onclick = () => switchUnit(u.id);
    // Left and right arrows move from unit to unit.
    btn.onkeydown = e => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      const next = step && list.querySelectorAll('.unit-btn')[i + step];
      if (next) { e.preventDefault(); next.focus(); }
    };
    item.appendChild(btn);
    list.appendChild(item);
  });
  nav.replaceChildren(list);
  // On a narrow screen the row scrolls: bring the current unit into view, without moving the page.
  const active = list.querySelector('.unit-btn.active');
  if (active && nav.scrollWidth > nav.clientWidth) {
    nav.scrollLeft = active.parentElement.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }
  document.getElementById('brand-sub').textContent = `${unitName(unit)} · ${unit.title}`;
  document.getElementById('part-grammar-name').textContent = lessonsLabel();
}

// The top bar is solid once the page scrolls under it.
{
  const bar = document.querySelector('.topbar');
  const onScroll = () => bar?.classList.toggle('scrolled', window.scrollY > 4);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function renderParts() {
  const inGrammar = isGrammar(currentScope);
  document.querySelector('.parts').classList.toggle('grammar-on', inGrammar);
  document.querySelectorAll('.part').forEach(b => {
    const on = (b.dataset.part === 'grammar') === inGrammar;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
  const all = wordsIn('all');
  const known = all.filter(w => learned.has(w.german)).length;
  const lessons = Object.keys(GRAMMAR);
  const passed = lessons.filter(k => grammarScores[k] >= passMark(k)).length;
  document.getElementById('part-vocab-meta').textContent = T('{known}/{total} words', { known, total: all.length });
  document.getElementById('part-grammar-meta').textContent = T('{passed}/{total} lessons done', { passed, total: lessons.length });
  document.getElementById('part-vocab-fill').style.width = `${Math.round(known / all.length * 100)}%`;
  document.getElementById('part-grammar-fill').style.width = `${Math.round(passed / lessons.length * 100)}%`;
}

function goTo({ scope = currentScope, mode = currentMode }) {
  closeSidebar();
  if (scope === currentScope && mode === currentMode) return;
  currentScope = scope;
  currentMode = mode;
  store.set(`${isGrammar(scope) ? 'last-grammar' : 'last-vocab'}-${unit.id}`, scope);
  store.set('book-scope', scope);
  store.set('book-mode', mode);
  renderPage();
  const top = document.querySelector('main').getBoundingClientRect().top + window.scrollY - 90;
  if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
}

function renderPage() {
  renderRail(); // the next step depends on the open section
  const grammar = GRAMMAR[currentScope];
  if (currentMode !== 'speak' || grammar) stopSpeakSession(true);
  document.querySelector('.tabs').hidden = !!grammar;
  document.getElementById('grammar-tabs').hidden = !grammar;
  [...MODES, 'grammar'].forEach(m => {
    const section = document.getElementById(m);
    const on = grammar ? m === 'grammar' : m === currentMode;
    section.classList.toggle('active', on);
    if (on) {
      section.classList.remove('view-enter');
      void section.offsetWidth; // restart the entrance animation
      section.classList.add('view-enter');
    }
  });
  document.querySelectorAll('.tab').forEach(b => {
    const on = b.dataset.mode === currentMode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  revealActiveTab();
  renderCrumbs();
  if (!grammar) setOnPage(null);
  const ribbon = document.getElementById('ribbon');
  ribbon.classList.remove('sway');
  void ribbon.offsetWidth;
  ribbon.classList.add('sway');
  document.getElementById('page-title').textContent = scopeTitle(currentScope);
  renderStats();
  renderToc();
  usage.view(grammar ? 'grammar' : currentMode, currentScope);
  if (grammar) renderGrammar();
  else if (currentMode === 'learn') renderLearn();
  else if (currentMode === 'speak') renderSpeak();
  else if (currentMode === 'practice') renderPractice();
  else if (currentMode === 'flashcards') renderFlashcards();
  else renderMatchQuiz();
}

function renderStats() {
  if (isGrammar(currentScope)) {
    const best = grammarScores[currentScope];
    document.getElementById('page-stat').innerHTML = best === undefined
      ? T('Read the lesson, then try the exercise')
      : T('Best exercise score: {best} of {total}', { best: `<strong>${best}</strong>`, total: quizSize(currentScope) });
    document.getElementById('page-fill').style.width = Math.round((best || 0) / quizSize(currentScope) * 100) + '%';
    return;
  }
  const words = wordsIn(currentScope);
  const known = words.filter(w => learned.has(w.german)).length;
  document.getElementById('page-stat').innerHTML = T('{known} of {total} words learned', { known: `<strong>${known}</strong>`, total: words.length });
  document.getElementById('page-fill').style.width = Math.round(known / words.length * 100) + '%';
}

function renderToc() {
  const toc = document.getElementById('toc');
  toc.innerHTML = '';
  renderParts();
  renderPager();
  const inGrammar = isGrammar(currentScope);
  document.getElementById('sidebar-heading').textContent = inGrammar ? T('{part} lessons', { part: lessonsLabel() }) : T('Vocabulary sections');
  if (inGrammar) return renderGrammarToc(toc);
  SCOPES.forEach(scope => {
    if (scope === 'all') toc.appendChild(el('li', 'divider'));
    const words = wordsIn(scope);
    const known = words.filter(w => learned.has(w.german)).length;
    const li = el('li');
    const btn = el('button', 'chapter-link');
    btn.type = 'button';
    btn.classList.toggle('active', scope === currentScope);
    btn.classList.toggle('done', known === words.length);
    if (scope === currentScope) btn.setAttribute('aria-current', 'true');
    btn.title = scope === 'all' ? '' : T('Chapter {n}', { n: geez(SCOPES.indexOf(scope) + 1) });
    btn.innerHTML = `<span class="chapter-num">${scope === 'all' ? T('All') : scope}</span>
      <span><span class="chapter-name"></span>
      <span class="chapter-meta"><span class="bar"><i style="width:${Math.round(known / words.length * 100)}%"></i></span>${known}/${words.length}</span></span>
      <span class="chapter-check">${icon('check', 'style="width:18px;height:18px"')}</span>`;
    btn.querySelector('.chapter-name').textContent = scopeTitle(scope);
    btn.onclick = () => goTo({ scope });
    li.appendChild(btn);
    toc.appendChild(li);
  });

}

function renderGrammarToc(toc) {
  Object.entries(GRAMMAR).forEach(([key, g]) => {
    const best = grammarScores[key];
    const li = el('li');
    const btn = el('button', 'chapter-link');
    btn.type = 'button';
    btn.classList.toggle('active', key === currentScope);
    btn.classList.toggle('done', best >= passMark(key));
    if (key === currentScope) btn.setAttribute('aria-current', 'true');
    btn.innerHTML = `<span class="chapter-num g">${g.code}</span>
      <span><span class="chapter-name"></span>
      <span class="chapter-meta"><span class="bar"><i style="width:${Math.round((best || 0) / quizSize(key) * 100)}%"></i></span>${best === undefined ? T('New') : `${best}/${quizSize(key)}`}</span></span>
      <span class="chapter-check">${icon('check', 'style="width:18px;height:18px"')}</span>`;
    btn.querySelector('.chapter-name').textContent = g.title;
    btn.onclick = () => goTo({ scope: key });
    li.appendChild(btn);
    if (key === currentScope && onPage.length) li.appendChild(fillOnPageList(el('ol', 'onpage')));
    toc.appendChild(li);
  });
}

/* ---------------- Page navigation: drawer, breadcrumbs, stepper, on-page sections ---------------- */

const drawerMode = () => matchMedia('(max-width: 1000px)').matches;
const scrollBehavior = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
let drawerOpener = null;

// On phones the sidebar is a drawer: while it is open the rest of the page is inert, so focus stays inside.
function setDrawerState(open) {
  document.querySelectorAll('[aria-controls="sidebar"]').forEach(b => b.setAttribute('aria-expanded', open));
  document.querySelectorAll('.topbar, .journey, main, .fab-dock').forEach(n => { n.inert = open; });
}

// On wide screens the chapters and progress columns can each be folded away to a narrow strip, giving the lesson
// the room. Each has a labelled "Hide" button, and its strip a word saying what it brings back; the choice is
// remembered on this device.
function setPanel(which, open, { focus = true } = {}) {
  const layout = document.querySelector('.layout');
  const panel = which === 'side' ? document.getElementById('sidebar') : document.querySelector('.rail-wrap');
  if (!layout || !panel) return;
  layout.classList.toggle(`${which}-collapsed`, !open);
  panel.querySelectorAll('.panel-hide').forEach(b => b.setAttribute('aria-expanded', open));
  panel.querySelectorAll('.panel-show').forEach(b => b.setAttribute('aria-expanded', open));
  try { localStorage.setItem(`panel-${which}`, JSON.stringify(open)); } catch (e) {}
  // Keep the keyboard where the learner is: on the button that undoes what they just did.
  if (focus) panel.querySelector(open ? '.panel-hide' : '.panel-show')?.focus({ preventScroll: true });
  if (open && which === 'rail') renderRail();
}

function restorePanels() {
  const saved = key => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } };
  if (saved('panel-side') === false) setPanel('side', false, { focus: false });
  if (saved('panel-rail') === false) setPanel('rail', false, { focus: false });
}
restorePanels();

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const current = sidebar.querySelector('.chapter-link.active');
  if (!drawerMode() && document.querySelector('.layout.side-collapsed')) setPanel('side', true, { focus: false });
  if (!drawerMode()) {
    // The sidebar is always visible on wide screens: point to the current chapter instead.
    if (current) { current.scrollIntoView({ block: 'nearest' }); current.focus({ preventScroll: true }); }
    return;
  }
  drawerOpener = document.activeElement;
  sidebar.classList.add('open');
  document.getElementById('scrim').classList.add('show');
  setDrawerState(true);
  (current || sidebar.querySelector('.sidebar-close')).focus({ preventScroll: true });
  if (current) current.scrollIntoView({ block: 'nearest' });
}

function closeSidebar(restoreFocus = true) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar.classList.contains('open')) return;
  sidebar.classList.remove('open');
  document.getElementById('scrim').classList.remove('show');
  setDrawerState(false);
  if (restoreFocus && drawerOpener && document.contains(drawerOpener)) drawerOpener.focus({ preventScroll: true });
  drawerOpener = null;
}

// Turning a phone to landscape can widen the page past the drawer breakpoint.
matchMedia('(max-width: 1000px)').addEventListener('change', e => { if (!e.matches) closeSidebar(false); });

// The course as one path: a unit's vocabulary sections and review, then its lessons and the unit test.
const stepsOf = u => [...u.sections.map(s => s.key), 'all', ...u.grammar.map(g => g.key)];

// code is the full label ("Section 2.3"); word + num let phones show just "2.3".
function stepLabel(u, key) {
  const lesson = u.grammar.find(g => g.key === key);
  const part = u.lessonsLabel || T('Grammar');
  if (lesson && lesson.custom === 'review') return { part, code: T('Unit test'), title: lesson.title };
  if (lesson) return { part, word: T('Lesson'), num: lesson.code, code: T('Lesson {n}', { n: lesson.code }), title: lesson.title };
  if (key === 'all') return { part: T('Vocabulary'), vocab: true, code: T('Review'), title: T('All chapters') };
  return { part: T('Vocabulary'), vocab: true, word: T('Section'), num: key, code: T('Section {n}', { n: key }), title: u.sections.find(s => s.key === key).title };
}

function stepDone(key) {
  if (isGrammar(key)) return grammarScores[key] >= passMark(key);
  const words = wordsIn(key);
  return words.length > 0 && words.every(w => learned.has(w.german));
}

// Opens any step of the course; lessons open at the explanation, not the exercise.
function openStep(unitId, scope) {
  const target = COURSE_UNITS.find(u => u.id === unitId);
  if (target.grammar.some(g => g.key === scope) && grammarView !== 'lesson') {
    grammarView = 'lesson';
    store.set('grammar-view', 'lesson');
  }
  if (unitId === unit.id) return goTo({ scope });
  closeSidebar(false);
  stopSpeakSession(true);
  loadUnit(unitId);
  store.set('current-unit', unitId);
  mqBuiltFor = fcBuiltFor = prBuiltFor = learnBuiltFor = speakBuiltFor = null;
  currentScope = scope; // set before rendering: section keys of the previous unit do not exist here
  store.set(`${isGrammar(scope) ? 'last-grammar' : 'last-vocab'}-${unitId}`, scope);
  store.set('book-scope', scope);
  renderUnits();
  updateProgress();
  renderPage();
  const top = document.querySelector('main').getBoundingClientRect().top + window.scrollY - 90;
  if (window.scrollY > top) window.scrollTo({ top, behavior: scrollBehavior() });
}

// Course › Unit › Part › this page. Each crumb leads to the level above, where the learner picks a sibling.
function renderCrumbs() {
  const list = document.getElementById('crumbs');
  const here = stepLabel(unit, currentScope);
  const index = !isGrammar(currentScope) && currentScope !== 'all' ? SCOPES.indexOf(currentScope) + 1 : 0;
  const crumbs = [
    { html: T('Course'), cls: 'crumb-course', title: T('All units'), go: () => { backToTop(); document.querySelector('.unit-btn.active')?.focus({ preventScroll: true }); } },
    { html: `${unitName(unit)}<span class="crumb-extra">: </span>`, extra: unit.title, title: `${unitName(unit)}: ${unit.title}`, go: () => { backToTop(); document.querySelector('.part.active')?.focus({ preventScroll: true }); } },
    { html: `${here.part}${icon('down', 'style="width:14px;height:14px"')}`, cls: 'crumb-part', drawer: true, title: here.vocab ? T('All vocabulary sections') : T('All {part} lessons', { part: here.part.toLowerCase() }), go: () => openSidebar() },
    // Phones drop the words "Section" and "Lesson": the crumb reads "2.3" or "G3".
    { html: `${here.word ? `<span class="crumb-word">${here.word}</span>${here.num}` : here.code}${index ? ` <span class="ethiopic" aria-hidden="true">· ${geez(index)}</span>` : ''}`, current: true },
  ];
  list.innerHTML = '';
  crumbs.forEach(c => {
    const li = el('li', c.cls || '');
    const node = el(c.current ? 'span' : 'button', c.current ? 'crumb crumb-current' : 'crumb');
    node.innerHTML = c.html;
    if (c.extra) node.querySelector('.crumb-extra').append(c.extra);
    if (c.current) node.setAttribute('aria-current', 'page');
    else { node.type = 'button'; node.title = c.title; node.onclick = c.go; }
    if (c.drawer) { node.setAttribute('aria-controls', 'sidebar'); node.setAttribute('aria-expanded', 'false'); }
    li.appendChild(node);
    list.appendChild(li);
  });
}

function pagerLink(dir, step) {
  const btn = el('button', `pager-link ${dir}`);
  btn.type = 'button';
  const word = dir === 'prev' ? T('Previous') : T('Next');
  const arrow = `<span class="pager-arrow">${icon(dir === 'prev' ? 'back' : 'arrow')}</span>`;
  if (!step) {
    btn.disabled = true;
    btn.innerHTML = `${arrow}<span class="pager-text"><span class="pager-kicker">${word}</span><span class="pager-title">${dir === 'prev' ? T('This is the start of the course') : T('You have reached the end of the course')}</span></span>`;
    return btn;
  }
  const label = stepLabel(step.unit, step.key);
  btn.innerHTML = `${arrow}<span class="pager-text"><span class="pager-kicker">${step.unit === unit ? word : dir === 'prev' ? T('Previous unit') : T('Next unit')}</span>
    <span class="pager-title"></span><span class="pager-meta"></span></span>`;
  btn.querySelector('.pager-title').textContent = step.unit === unit ? label.title : `${unitName(step.unit)}: ${step.unit.title}`;
  btn.querySelector('.pager-meta').textContent = `${label.part} · ${label.code}`;
  btn.onclick = () => {
    openStep(step.unit.id, step.key);
    document.getElementById('page-title').focus({ preventScroll: true });
  };
  return btn;
}

// Previous and next at the end of every page, and where this page sits in the unit.
function renderPager() {
  const pager = document.getElementById('pager');
  const steps = stepsOf(unit);
  const i = steps.indexOf(currentScope);
  const u = COURSE_UNITS.indexOf(unit);
  const before = COURSE_UNITS[u - 1];
  const after = COURSE_UNITS[u + 1];
  const prev = i > 0 ? { unit, key: steps[i - 1] } : before ? { unit: before, key: stepsOf(before).at(-1) } : null;
  const next = i < steps.length - 1 ? { unit, key: steps[i + 1] } : after ? { unit: after, key: stepsOf(after)[0] } : null;
  const firstLesson = unit.grammar[0]?.key;
  pager.innerHTML = `<div class="pager-track">
      <span class="pager-count">${T('Step {n} of {total} in {unit}', { n: `<strong>${i + 1}</strong>`, total: steps.length, unit: unitName(unit) })}</span>
      <ol class="pager-dots" aria-hidden="true">${steps.map((key, n) => `<li class="${[
        n === i ? 'current' : '', stepDone(key) ? 'done' : '', key === firstLesson ? 'part-start' : '',
      ].join(' ').trim()}"></li>`).join('')}</ol>
    </div>
    <div class="pager-links"></div>`;
  pager.querySelector('.pager-links').append(pagerLink('prev', prev), pagerLink('next', next));
}

// Long lesson pages list their sections: under the lesson in the sidebar, and in a sheet on phones.
let onPage = [];
let onPageActive = 0;

function setOnPage(page) {
  const panels = page ? [...page.querySelectorAll(':scope > .panel')].filter(p => p.querySelector('h2')) : [];
  onPage = panels.length >= 3 ? panels.map((panel, i) => {
    const heading = panel.querySelector('h2');
    panel.id = `section-${i + 1}`;
    heading.tabIndex = -1;
    return { id: panel.id, title: heading.textContent, node: panel, heading };
  }) : [];
  onPageActive = 0;
  document.querySelectorAll('#toc .onpage').forEach(n => n.remove());
  const current = document.querySelector('#toc .chapter-link.active');
  if (current && onPage.length) current.parentElement.appendChild(fillOnPageList(el('ol', 'onpage')));
  fillOnPageList(document.getElementById('onpage-sheet-list'));
  document.getElementById('onpage-fab').classList.toggle('available', onPage.length > 0);
  spy();
}

function fillOnPageList(list) {
  list.innerHTML = '';
  list.setAttribute('aria-label', T('On this page'));
  onPage.forEach(section => {
    const li = el('li');
    const a = el('a', 'onpage-link', section.title);
    a.href = `#${section.id}`;
    a.onclick = e => { e.preventDefault(); jumpToSection(section); };
    li.appendChild(a);
    list.appendChild(li);
  });
  markOnPage(list);
  return list;
}

function jumpToSection(section) {
  const sheet = document.getElementById('onpage-sheet');
  if (sheet.open) sheet.close();
  closeSidebar(false);
  section.node.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  section.heading.focus({ preventScroll: true });
}

function openOnPageSheet() {
  const sheet = document.getElementById('onpage-sheet');
  sheet.showModal();
  markOnPage(sheet.querySelector('.onpage'));
  sheet.querySelector('[aria-current]')?.focus();
}

// The marker slides to the current section; the link carries aria-current for screen readers.
function markOnPage(list) {
  const links = [...list.querySelectorAll('.onpage-link')];
  links.forEach((a, i) => { if (i === onPageActive) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  const active = links[onPageActive];
  if (!active || !active.offsetHeight) return;
  list.style.setProperty('--mark-y', `${active.offsetTop}px`);
  list.style.setProperty('--mark-h', `${active.offsetHeight}px`);
}

// Scroll-spy: the current section is the last one whose top has passed under the top bar.
function spy() {
  document.getElementById('to-top').classList.toggle('available', window.scrollY > window.innerHeight * 0.8);
  if (!onPage.length) return;
  let active = 0;
  onPage.forEach((s, i) => { if (s.node.getBoundingClientRect().top <= 130) active = i; });
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = onPage.length - 1;
  onPageActive = active;
  document.querySelectorAll('.onpage').forEach(markOnPage);
  document.querySelector('#onpage-fab span').textContent = onPage[active].title;
}

let spyQueued = false;
const queueSpy = () => {
  if (spyQueued) return;
  spyQueued = true;
  requestAnimationFrame(() => { spyQueued = false; spy(); });
};
addEventListener('scroll', queueSpy, { passive: true });
addEventListener('resize', queueSpy, { passive: true });

function backToTop() {
  window.scrollTo({ top: 0, behavior: scrollBehavior() });
}

function updateProgress() {
  store.set('book-learned', [...learned]);
  const all = wordsIn('all');
  const known = all.filter(w => learned.has(w.german)).length;
  const percent = Math.round(known / all.length * 100);
  document.getElementById('learned-count').textContent = known;
  document.getElementById('total-count').textContent = all.length;
  document.getElementById('progress-percent').textContent = percent + '%';
  document.getElementById('progress-fill').style.width = percent + '%';
  renderStats();
  renderToc();
  if (document.getElementById('units').childElementCount) renderUnits();
  renderRail();
}

/* ---------------- Learn ---------------- */

let learnView = store.get('learn-view', 'single') === 'grid' ? 'grid' : 'single';
let learnIndex = 0;
let learnBuiltFor = null;

function setLearnView(view) {
  learnView = view;
  store.set('learn-view', view);
  renderLearn();
}

// Words in reading order, each with the chapter it comes from (duplicates across chapters dropped).
function learnSequence() {
  const sections = currentScope === 'all' ? Object.keys(vocabulary) : [currentScope];
  const seen = new Set();
  const list = [];
  sections.forEach(section => vocabulary[section].forEach(item => {
    if (seen.has(item.german)) return;
    seen.add(item.german);
    list.push({ item, section });
  }));
  return list;
}

function renderGrammarCallout() {
  const box = document.getElementById('learn-grammar');
  box.innerHTML = '';
  Object.entries(GRAMMAR).filter(([, g]) => g.chapters.includes(currentScope)).forEach(([key, g]) => {
    const card = el('div', 'grammar-callout');
    card.innerHTML = `<span class="g-badge">${g.code}</span><div><small>${T('{part} for this chapter', { part: lessonsLabel() })}</small><strong></strong></div>`;
    card.querySelector('strong').textContent = g.title;
    const btn = el('button', 'btn', '');
    btn.type = 'button';
    btn.innerHTML = `${T('Open lesson')} ${icon('arrow')}`;
    btn.onclick = () => { grammarView = 'lesson'; store.set('grammar-view', 'lesson'); goTo({ scope: key }); };
    card.appendChild(btn);
    box.appendChild(card);
  });
}

function renderLearn() {
  renderGrammarCallout();
  document.querySelectorAll('.learn-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === learnView));
  if (learnBuiltFor !== currentScope) { learnIndex = 0; learnBuiltFor = currentScope; }
  if (learnView === 'single') return renderWordPage();
  renderLearnGrid();
}

function renderWordPage(direction) {
  const content = document.getElementById('learn-content');
  const words = learnSequence();
  if (learnIndex >= words.length) return renderLearnDone(words.length);
  const { item, section } = words[learnIndex];
  const known = learned.has(item.german);
  content.innerHTML = `
    <div class="narrow">
      <div class="fc-progress"><span>${T('Word {n} of {total}', { n: learnIndex + 1, total: words.length })}</span><div class="bar"><i style="width:${Math.round((learnIndex + 1) / words.length * 100)}%"></i></div></div>
      <div class="wv-stage">
        <div class="panel word-page view-enter ${direction === 'back' ? 'turn-back' : ''}">
          ${known ? `<span class="wv-learned">${icon('check')}${T('Learned')}</span>` : ''}
          <span class="wv-section"></span>
          <div class="wv-word"></div>
          <div class="wv-listen"></div>
          <div class="wv-meaning"></div>
          <button class="btn btn-ghost" type="button" id="wv-speak">${icon('mic')}${T('Say it with {name}', { name: COACH[currentVoice].name })}</button>
        </div>
        <button class="wv-arrow wv-arrow-prev" type="button" id="wv-prev" ${learnIndex === 0 ? 'disabled' : ''}>
          <span class="wv-arrow-disc">${icon('chev-left')}</span><span class="wv-arrow-label">${T('Previous')}</span>
        </button>
        <button class="wv-arrow wv-arrow-next" type="button" id="wv-next">
          <span class="wv-arrow-disc">${icon('chev-right')}</span><span class="wv-arrow-label">${learnIndex + 1 < words.length ? T('Next word') : T('Finish chapter')}</span>
        </button>
      </div>
      <div class="kbd-hint"><kbd>←</kbd> <kbd>→</kbd> ${T('move between words')}</div>
    </div>`;
  content.querySelector('.wv-section').textContent = currentScope === 'all' ? `${section} · ${SECTION_TITLES[section]}` : T('German');
  const gender = showGermanWord(content.querySelector('.wv-word'), item);
  if (gender) content.querySelector('.wv-word').after(genderTag(gender));
  content.querySelector('.wv-word').lang = 'de'; // long compounds break at German syllables, not mid-letter
  const picture = wordPicture(item, 'wv-pic');
  if (picture) content.querySelector('.wv-word').before(picture);
  const credits = photoCredits(item);
  if (credits) content.querySelector('.word-page').appendChild(credits);
  const listen = listenButton(item.german);
  listen.classList.add('lg');
  content.querySelector('.wv-listen').appendChild(listen);
  showWordMeaning();
  document.getElementById('wv-speak').onclick = () => {
    speakIndex = learnIndex;
    speakBuiltFor = currentScope;
    goTo({ mode: 'speak' });
    startSpeakSession();
  };
  document.getElementById('wv-prev').onclick = () => moveWord(-1);
  document.getElementById('wv-next').onclick = () => moveWord(1);
}

// The meaning and examples show with the word, so reading its page counts it as learned.
function showWordMeaning() {
  const box = document.querySelector('#learn-content .wv-meaning');
  if (!box) return;
  const { item } = learnSequence()[learnIndex];
  box.appendChild(el('div', 'wv-answer', meaning(item)));
  const examples = exampleList(item);
  if (examples) box.appendChild(examples);
  if (!learned.has(item.german)) {
    learned.add(item.german);
    updateProgress();
  }
}

function moveWord(step) {
  const total = learnSequence().length;
  const next = learnIndex + step;
  if (next < 0 || next > total) return;
  learnIndex = next;
  renderWordPage(step < 0 ? 'back' : 'forward');
}

function renderLearnDone(total) {
  const content = document.getElementById('learn-content');
  content.innerHTML = '';
  const i = SCOPES.indexOf(currentScope);
  const nextScope = SCOPES[i + 1] && SCOPES[i + 1] !== 'all' ? SCOPES[i + 1] : null;
  const buttons = [[T('Practise these words'), 'btn-primary', () => goTo({ mode: 'practice' })]];
  if (nextScope) buttons.push([T('Next chapter: {title}', { title: SECTION_TITLES[nextScope] }), '', () => goTo({ scope: nextScope })]);
  buttons.push([T('Start over'), 'btn-ghost', () => { learnIndex = 0; renderWordPage(); }]);
  content.appendChild(resultPanel({
    title: currentScope === 'all' ? T('You have read every word') : T('Chapter read'),
    text: currentScope === 'all' ? T('You went through all {n} words in the unit.', { n: total }) : T('You went through all {n} words in this chapter.', { n: total }),
    buttons,
  }));
}

function renderLearnGrid() {
  const content = document.getElementById('learn-content');
  content.innerHTML = '';
  const grid = el('div', 'vocab-grid');
  let index = 0;
  const sections = currentScope === 'all' ? Object.keys(vocabulary) : [currentScope];
  if (sections.some(section => vocabulary[section].some(nounGender))) content.appendChild(genderKey());
  const seen = new Set();
  sections.forEach(section => {
    if (currentScope === 'all') {
      const title = el('h2', 'group-title');
      title.innerHTML = `<span>${section}</span>`;
      title.append(SECTION_TITLES[section]);
      grid.appendChild(title);
    }
    vocabulary[section].forEach(item => {
      if (currentScope === 'all' && seen.has(item.german)) return;
      seen.add(item.german);
      grid.appendChild(vocabCard(item, index++));
    });
  });
  content.appendChild(grid);
  watchCardsRead(grid);

  const i = SCOPES.indexOf(currentScope);
  if (SCOPES[i + 1] && SCOPES[i + 1] !== 'all') {
    const wrap = el('div', 'next-chapter');
    const next = el('button', 'btn');
    next.type = 'button';
    next.innerHTML = `${T('Next chapter:')} <strong></strong>${icon('arrow')}`;
    next.querySelector('strong').textContent = SECTION_TITLES[SCOPES[i + 1]];
    next.onclick = () => goTo({ scope: SCOPES[i + 1] });
    wrap.appendChild(next);
    content.appendChild(wrap);
  }
}

// A noun's gender (der, die, das or plural), from its article; tools/course_content.py works it out.
function nounGender(item) { return item.gender || null; }
const GENDER_NAMES = { der: () => T('masculine'), die: () => T('feminine'), das: () => T('neuter'), plural: () => T('plural') };

// Writes a course word into a node: a noun all in its gender's colour (der blue, die rose, das green, plural
// plum), its article bolder. Used wherever a word is shown with its article: word cards, flashcards, Match,
// Practice, Speak and search. Never inside lesson exercises, where the colour would give the article away.
function showGermanWord(node, item) {
  const gender = nounGender(item);
  node.textContent = '';
  delete node.dataset.gender;
  node.classList.toggle('de-noun', !!gender);
  if (!gender) { node.textContent = item.german; return null; }
  node.dataset.gender = gender;
  item.german.split(/(,\s*)/).forEach(part => {
    const space = part.indexOf(' ');
    if (part.startsWith(',') || space < 0) { node.append(part); return; }
    node.append(el('span', 'article', part.slice(0, space)), part.slice(space));
  });
  return gender;
}

// A small label naming the gender in words, so the colour is never the only sign.
function genderTag(gender) {
  const tag = el('span', 'gender-tag', GENDER_NAMES[gender]());
  tag.dataset.gender = gender;
  return tag;
}

// Above the word grid: what each colour means.
function genderKey() {
  const key = el('div', 'gender-key');
  key.appendChild(el('span', 'gender-key-title', T('Noun colours:')));
  [['der', 'der'], ['die', 'die'], ['das', 'das'], ['plural', 'die']].forEach(([gender, article]) => {
    const item = el('span', 'gender-key-item');
    item.dataset.gender = gender;
    const word = el('b', 'article', article);
    word.lang = 'de';
    item.append(word, ' ', GENDER_NAMES[gender]());
    key.appendChild(item);
  });
  return key;
}

function vocabCard(item, index) {
  const card = el('div', 'vocab-card');
  card.style.setProperty('--i', Math.min(index, 20));
  card.classList.toggle('learned', learned.has(item.german));
  card.dataset.german = item.german;
  card.innerHTML = `<span class="vc-learned" aria-hidden="true"></span>
    <div class="vc-top"><span class="vc-word"></span></div>
    <div class="vc-meaning"><span class="vc-text"></span></div>`;
  const gender = showGermanWord(card.querySelector('.vc-word'), item);
  if (gender) {
    card.dataset.gender = gender;
    card.querySelector('.vc-meaning').appendChild(genderTag(gender));
  }
  card.querySelector('.vc-text').textContent = meaning(item);
  card.querySelector('.vc-word').lang = 'de'; // lets long compounds hyphenate at German syllables
  const picture = wordPicture(item, 'vc-pic');
  if (picture) card.querySelector('.vc-top').before(picture); // own row: the word keeps the full width
  card.querySelector('.vc-top').appendChild(listenButton(item.german));
  const examples = exampleList(item);
  if (examples) {
    examples.classList.add('vc-examples');
    card.appendChild(examples);
  }
  return card;
}

// Every card shows its meaning, so a word counts as learned once its card has been fully on screen for a moment.
let cardWatcher;
function watchCardsRead(grid) {
  cardWatcher?.disconnect();
  const timers = new Map();
  cardWatcher = new IntersectionObserver(entries => entries.forEach(({ target: card, isIntersecting }) => {
    clearTimeout(timers.get(card));
    if (!isIntersecting) return;
    timers.set(card, setTimeout(() => {
      cardWatcher.unobserve(card);
      if (!card.isConnected || learned.has(card.dataset.german)) return;
      learned.add(card.dataset.german);
      card.classList.add('learned');
      updateProgress();
    }, 1500));
  }), { threshold: 0.9 });
  grid.querySelectorAll('.vocab-card:not(.learned)').forEach(card => cardWatcher.observe(card));
}

/* ---------------- Grammar ---------------- */

const GRAMMAR_QUIZ_SIZE = 8;
const GRAMMAR_PASS = 6;
const REVIEW_QUIZ_SIZE = 12;
// Unit tests are longer than lesson exercises; three quarters right completes either.
const quizSize = key => (GRAMMAR[key]?.custom === 'review' ? REVIEW_QUIZ_SIZE : GRAMMAR_QUIZ_SIZE);
const passMark = key => Math.ceil(quizSize(key) * GRAMMAR_PASS / GRAMMAR_QUIZ_SIZE);
const VERBS = [
  { inf: 'machen', stem: 'mach', en: T('to do / make') },
  { inf: 'kochen', stem: 'koch', en: T('to cook') },
  { inf: 'kommen', stem: 'komm', en: T('to come') },
  { inf: 'heißen', stem: 'heiß', en: T('to be called') },
];
// Table rows: label, pronoun used for audio, ending, meaning.
const PERSONS = [
  { label: 'ich', say: 'ich', ending: 'e', en: T('I') },
  { label: 'du', say: 'du', ending: 'st', en: T('you') },
  { label: 'er / sie / es', say: 'er', ending: 't', en: T('he / she / it') },
  { label: 'wir', say: 'wir', ending: 'en', en: T('we') },
  { label: 'ihr', say: 'ihr', ending: 't', en: T('you all') },
  { label: 'sie / Sie', say: 'sie', ending: 'en', en: T('they / you (formal)') },
];
const QUIZ_PRONOUNS = [
  ['ich', 0, T('I')], ['du', 1, T('you')], ['er', 2, T('he')], ['sie', 2, T('she')], ['es', 2, T('it')],
  ['wir', 3, T('we')], ['ihr', 4, T('you all')], ['sie', 5, T('they')], ['Sie', 5, T('you (formal)')],
];
const COUNTRIES = [
  { nom: 'die Schweiz', gender: T('feminine'), aus: 'aus der', rest: 'Schweiz', en: T('Switzerland') },
  { nom: 'die Türkei', gender: T('feminine'), aus: 'aus der', rest: 'Türkei', en: T('Turkey') },
  { nom: 'die Vereinigten Staaten', gender: T('plural'), aus: 'aus den', rest: 'Vereinigten Staaten', en: T('the United States') },
  { nom: 'die Niederlande', gender: T('plural'), aus: 'aus den', rest: 'Niederlanden', en: T('the Netherlands') },
  { nom: 'die Vereinigten Arabischen Emirate', gender: T('plural'), aus: 'aus den', rest: 'Vereinigten Arabischen Emiraten', en: T('the UAE') },
];
const NO_ARTICLE = [
  { rest: 'Deutschland', en: T('Germany') },
  { rest: 'Äthiopien', en: T('Ethiopia') },
  { rest: 'Österreich', en: T('Austria') },
];
let gVerb = VERBS[0];
let gQuiz = null;

// du adds only -t when the stem already ends in an s-sound (heiß → du heißt).
const endingFor = (verb, person) => (person === 1 && /[sßzx]$/.test(verb.stem) ? 't' : PERSONS[person].ending);

function lessonPanel(step, title, html) {
  const box = el('section', 'panel');
  box.innerHTML = `${step ? `<div class="g-step">${step}</div>` : ''}<h2></h2>${html}`;
  box.querySelector('h2').textContent = title;
  return box;
}

let grammarView = store.get('grammar-view', 'lesson') === 'exercise' ? 'exercise' : 'lesson';

function setGrammarView(view) {
  grammarView = view;
  store.set('grammar-view', view);
  const section = document.getElementById('grammar');
  section.classList.remove('view-enter');
  void section.offsetWidth; // restart the entrance animation
  section.classList.add('view-enter');
  renderGrammar();
  const top = document.querySelector('main').getBoundingClientRect().top + window.scrollY - 90;
  if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
}

// Grammar pages have two sections: the lesson itself and a separate exercise.
function renderGrammar() {
  document.querySelectorAll('#grammar-tabs .tab').forEach(b => {
    const on = b.dataset.gview === grammarView;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  const box = document.getElementById('grammar-content');
  box.innerHTML = '';
  const page = el('div', 'g-lesson');
  box.appendChild(page);
  const lesson = GRAMMAR[currentScope];
  const kind = lesson.tree ? 'tree' : lesson.custom || 'data';
  if (grammarView === 'exercise') {
    const reading = (lesson.blocks || []).find(b => b.reading);
    if (reading) {
      // Reading exercises keep the text in view.
      const box = el('details', 'panel reading-panel');
      box.open = true;
      box.innerHTML = '<summary></summary>';
      box.querySelector('summary').textContent = T('The text: {title}', { title: L(reading.title) });
      box.appendChild(readingText(reading));
      page.appendChild(box);
    }
    page.appendChild(quizPanel(kind));
    const back = lessonPanel('', T('Need a reminder?'), `<p>${T('Go back to the lesson for the rule and the examples, then return here.')}</p><div class="actions" style="justify-content:flex-start"></div>`);
    const btn = el('button', 'btn', '');
    btn.type = 'button';
    btn.innerHTML = `${icon('learn')}${T('Review the lesson')}`;
    btn.onclick = () => setGrammarView('lesson');
    back.querySelector('.actions').appendChild(btn);
    page.appendChild(back);
    setOnPage(null);
    return;
  }
  page.appendChild(exerciseCallout());
  if (kind === 'present') renderPresentLesson(page);
  else if (kind === 'countries') renderCountriesLesson(page);
  else if (kind === 'review') renderReviewLesson(page, lesson);
  else renderDataLesson(page, lesson);
  setOnPage(page);
}

// The part of an example that is spoken: "A → B" examples say B.
const spokenPart = text => (text.includes('→') ? text.split('→').pop().trim() : text);

function lessonTable(table) {
  const wrap = el('div', 'table-scroll');
  const t = el('table', 'conj-table');
  t.innerHTML = `<thead><tr>${table.head.map(h => `<th></th>`).join('')}<th></th></tr></thead><tbody></tbody>`;
  t.querySelectorAll('thead th').forEach((th, i) => { th.textContent = L(table.head[i] || ''); });
  table.rows.forEach((row, r) => {
    const tr = el('tr');
    row.forEach((cell, c) => {
      const td = el('td', c === 0 ? '' : 'form', L(cell));
      // A time in the first column ("9:05") shows its clock.
      const clock = c === 0 && clockPics(clocksFor(cell), 'small', false);
      if (clock) { td.prepend(clock); td.classList.add('time-cell'); }
      if (c > 0) td.style.fontSize = '1.1rem';
      if (c === table.highlight) td.classList.add('end');
      tr.appendChild(td);
    });
    const last = el('td');
    if (table.say && table.say[r]) last.appendChild(listenButton(table.say[r]));
    tr.appendChild(last);
    t.querySelector('tbody').appendChild(tr);
  });
  wrap.appendChild(t);
  return wrap;
}

// A reading text: each paragraph can be heard, with the new words underneath.
function readingText(block) {
  const box = el('div', 'reading');
  block.reading.forEach(paragraph => {
    const row = el('div', 'reading-row');
    const p = el('p', 'reading-de', paragraph);
    p.lang = 'de';
    row.append(p, listenButton(paragraph));
    box.appendChild(row);
    const clock = clockPics(clocksFor(paragraph), 'small');
    if (clock) box.appendChild(clock);
  });
  if (block.glossary && block.glossary.length) {
    const list = el('dl', 'glossary');
    block.glossary.forEach(([de, en]) => {
      const dt = el('dt', '', de);
      dt.lang = 'de';
      list.append(dt, el('dd', '', L(en)));
    });
    box.appendChild(list);
  }
  return box;
}

function renderReviewLesson(page, lesson) {
  page.appendChild(lessonPanel('', T('How the unit test works'), lesson.intro.map(p => `<p>${L(p)}</p>`).join('')));
  const lessons = Object.values(GRAMMAR).filter(g => g !== lesson);
  const panel = lessonPanel('', T('What it covers'), '<ul class="review-list"></ul>');
  lessons.forEach(g => panel.querySelector('ul').appendChild(el('li', '', `${g.code} · ${g.title}`)));
  panel.querySelector('ul').appendChild(el('li', '', T('Vocabulary from all {n} sections', { n: SCOPES.length - 1 })));
  page.appendChild(panel);
}

function renderDataLesson(page, lesson) {
  page.appendChild(lessonPanel('', T('The idea'), lesson.intro.map(p => `<p>${L(p)}</p>`).join('')));
  if (lesson.tree) {
    const panel = lessonPanel(T('Look and listen'), L(lesson.tree.title), `<p>${T('Press a person to hear the word.')}</p>`);
    panel.appendChild(familyTree(lesson.tree, { onPerson: (person, node) => speak(person.word) }));
    page.appendChild(panel);
  }
  lesson.blocks.forEach(block => {
    const panel = lessonPanel(L(block.step || ''), L(block.title), block.text ? `<p></p>` : '');
    if (block.text) panel.querySelector('p').textContent = L(block.text);
    if (block.reading) panel.appendChild(readingText(block));
    if (block.table) panel.appendChild(lessonTable(block.table));
    if (block.examples) {
      const list = el('div', 'ex-list');
      block.examples.forEach(([de, en]) => {
        const row = el('div', 'ex-row');
        row.innerHTML = '<div><div class="ex-de"></div><div class="ex-en"></div></div>';
        row.querySelector('.ex-de').textContent = de;
        row.querySelector('.ex-en').textContent = L(en);
        const clock = clockPics(clocksFor(de), 'small');
        if (clock) row.appendChild(clock);
        row.appendChild(listenButton(de));
        list.appendChild(row);
      });
      panel.appendChild(list);
    }
    page.appendChild(panel);
  });
  if (lesson.rules && lesson.rules.length) {
    const remember = lessonPanel('', T('Remember'), '<div class="rule-cards"></div>');
    lesson.rules.forEach(([title, text]) => {
      const card = el('div', 'rule-card');
      card.innerHTML = '<b></b><span></span>';
      card.querySelector('b').textContent = L(title);
      card.querySelector('span').textContent = L(text);
      remember.querySelector('.rule-cards').appendChild(card);
    });
    page.appendChild(remember);
  }
}

function exerciseCallout() {
  const best = grammarScores[currentScope];
  const card = el('section', 'exercise-cta');
  card.innerHTML = `<span class="cta-icon">${icon('practice')}</span>
    <div><small>${GRAMMAR[currentScope].tree ? T('Exercise · {n} people to match', { n: quizSize(currentScope) }) : T('Exercise · {n} quick questions', { n: quizSize(currentScope) })}</small>
    <strong>${best === undefined ? (GRAMMAR[currentScope].custom === 'review' ? T('Test yourself on the whole unit') : T('Test yourself on this lesson')) : best >= passMark(currentScope) ? T('Keep it fresh: practise again') : T('Try again and beat your score')}</strong>
    <span>${best === undefined ? T('Score {n} or more to complete it.', { n: passMark(currentScope) }) : T('Best score so far: {best} of {total}.', { best, total: quizSize(currentScope) })}</span></div>`;
  const start = el('button', 'btn btn-primary', '');
  start.type = 'button';
  start.innerHTML = `${best === undefined ? T('Start the exercise') : T('Practise again')} ${icon('arrow')}`;
  start.onclick = () => setGrammarView('exercise');
  card.appendChild(start);
  return card;
}

function renderPresentLesson(lesson) {
  lesson.appendChild(lessonPanel('', T('Why verbs change their ending'),
    `<p>${T('In German, the end of a verb changes to match <strong>who</strong> is doing the action: <em class="de">ich mache</em>, <em class="de">du machst</em>, <em class="de">wir machen</em>.')}</p>
     <p>${T('Regular verbs all follow the same pattern, built in two steps.')}</p>`));

  const step1 = lessonPanel(T('Step 1'), T('Find the stem'),
    `<p>${T('Take the infinitive (the dictionary form) and remove the ending <strong>-en</strong>. Pick a verb:')}</p>
     <div class="chip-row" id="verb-chips"></div>
     <div class="stem-demo" id="stem-demo"></div>`);
  const step2 = lessonPanel(T('Step 2'), T('Add the ending'),
    `<p>${T('Add the ending that belongs to the person. Press a speaker to hear each form.')}</p>
     <table class="conj-table"><thead><tr><th>${T('Person')}</th><th>${T('Ending')}</th><th>${T('Form')}</th><th class="en">${T('Meaning')}</th><th></th></tr></thead><tbody id="conj-body"></tbody></table>
     <div class="g-note" id="verb-note" hidden></div>`);
  const remember = lessonPanel('', T('Remember'),
    `<div class="rule-cards">
       <div class="rule-card"><b>-e · -st · -t</b><span>ich, du, er/sie/es</span></div>
       <div class="rule-card"><b>-en · -t · -en</b><span>wir, ihr, sie/Sie</span></div>
       <div class="rule-card"><b>wir = sie = Sie</b><span>${T('These look just like the infinitive: <mark>machen</mark>')}</span></div>
       <div class="rule-card"><b>er/sie/es = ihr</b><span>${T('Both end in <mark>-t</mark>: er macht, ihr macht')}</span></div>
     </div>`);
  lesson.append(step1, step2, remember);

  const chips = document.getElementById('verb-chips');
  VERBS.forEach(v => {
    const chip = el('button', 'chip', v.inf);
    chip.type = 'button';
    chip.onclick = () => { gVerb = v; drawVerb(); };
    chips.appendChild(chip);
  });
  drawVerb();
}

function drawVerb() {
  document.querySelectorAll('#verb-chips .chip').forEach(c => c.classList.toggle('active', c.textContent === gVerb.inf));
  document.getElementById('stem-demo').innerHTML =
    `<span>${gVerb.stem}<s>en</s></span><span class="arrow">→</span><span class="stem">${gVerb.stem}-</span><span class="arrow" style="font-size:0.95rem">${gVerb.en}</span>`;
  const body = document.getElementById('conj-body');
  body.innerHTML = '';
  PERSONS.forEach((p, i) => {
    const ending = endingFor(gVerb, i);
    const row = el('tr');
    row.innerHTML = `<td>${p.label}</td><td><span class="ending-pill">-${ending}</span></td>
      <td class="form">${gVerb.stem}<span class="end">${ending}</span></td><td class="en">${p.en}</td><td></td>`;
    row.lastElementChild.appendChild(listenButton(`${p.say} ${gVerb.stem}${ending}`));
    body.appendChild(row);
  });
  const note = document.getElementById('verb-note');
  note.hidden = gVerb.inf !== 'heißen';
  note.textContent = T('Watch out: the stem heiß- already ends in ß, so du only adds -t: du heißt (not du heißst).');
}

function renderCountriesLesson(lesson) {
  lesson.appendChild(lessonPanel('', T('Most countries need no article'),
    `<p>${T('To say where you are from, use <strong>aus</strong> + the country: <em class="de">Ich komme aus Deutschland.</em> <em class="de">Ich komme aus Äthiopien.</em>')}</p>
     <p>${T('A few countries always have an article. After <strong>aus</strong> that article changes.')}</p>`));

  const table = lessonPanel(T('The rule'), T('Countries with an article'),
    `<table class="conj-table country-table"><thead><tr><th>${T('Country')}</th><th>${T('Type')}</th><th>${T('I come from …')}</th><th></th></tr></thead><tbody id="country-body"></tbody></table>
     <div class="g-note">${T('Die Niederlande and die Vereinigten Arabischen Emirate are plural, so after aus they become <em class="de">aus den Niederlanden</em> and <em class="de">aus den … Emiraten</em>.')}</div>`);
  const remember = lessonPanel('', T('Remember'),
    `<div class="rule-cards">
       <div class="rule-card"><b>die → aus <mark>der</mark></b><span>${T('feminine: die Schweiz, die Türkei')}</span></div>
       <div class="rule-card"><b>die → aus <mark>den</mark> (+n)</b><span>${T('plural: die USA, die Niederlande')}</span></div>
       <div class="rule-card"><b>${T('no article → aus')}</b><span>Deutschland, Äthiopien, Österreich …</span></div>
     </div>`);
  lesson.append(table, remember);

  const body = document.getElementById('country-body');
  COUNTRIES.forEach(c => {
    const row = el('tr');
    row.innerHTML = `<td class="form" style="font-size:1.1rem"></td><td class="en" style="display:table-cell">${c.gender}</td>
      <td class="form" style="font-size:1.1rem">aus <span class="end">${c.aus.split(' ')[1]}</span> ${c.rest}</td><td></td>`;
    row.firstElementChild.textContent = c.nom;
    row.lastElementChild.appendChild(listenButton(`Ich komme ${c.aus} ${c.rest}.`));
    body.appendChild(row);
  });
}

/* The exercise section: a short tap-to-answer quiz. */
function quizPanel(kind) {
  const title = kind === 'present' ? T('Choose the right ending') : kind === 'countries' ? T('aus, aus der or aus den?') : kind === 'review' ? GRAMMAR[currentScope].title : L(GRAMMAR[currentScope].quiz.title);
  const box = lessonPanel(T('Exercise'), title, '<div id="g-quiz"></div>');
  setTimeout(() => startGrammarQuiz(kind));
  return box;
}

const withChoices = item => ({ ...item, options: item.options ? shuffle([...item.options]) : item.options, label: o => L(o) });

// "What does it mean in English?" asks for an Amharic meaning in Amharic; typed Amharic has too many right
// wordings to check fairly, so it becomes a choice between this meaning and two from the same unit.
function forLanguage(item) {
  if (!AM || item.type !== 'write' || item.lang !== 'en') return item;
  // A course word keeps its own meaning, which also keeps du/Sie apart (Woher kommen Sie? = ከየት ነዎት?).
  const amharic = i => AM.words[i.text] || L(i.answer);
  const right = amharic(item);
  const fromUnit = Object.values(GRAMMAR).flatMap(g => g.quiz?.items || [])
    .filter(i => i.type === 'write' && i.lang === 'en').map(amharic);
  const fromWords = wordsIn('all').map(meaning);
  const others = [...new Set(shuffle(fromUnit).concat(shuffle(fromWords)))].filter(o => o !== right).slice(0, 2);
  return {
    type: 'choose', prompt: T('What does “{word}” mean?', { word: item.text }), answer: right,
    options: [right, ...others], hint: '', say: item.say, show: right, why: item.why || '',
  };
}

// Unit test: questions from every lesson of the unit, plus vocabulary in both directions.
function reviewQuestions() {
  const pool = shuffle(Object.values(GRAMMAR).filter(g => g.quiz && !g.custom).flatMap(g => g.quiz.items)).map(forLanguage);
  const fromLessons = pool.slice(0, Math.min(pool.length, REVIEW_QUIZ_SIZE - 4));
  const words = shuffle(wordsIn('all').filter(w => w.german.length <= 40));
  const fromWords = words.slice(0, REVIEW_QUIZ_SIZE - fromLessons.length).map((w, i) => {
    const others = shuffle(words.filter(o => o.german !== w.german && meaning(o) !== meaning(w))).slice(0, 2);
    // The explanation pairs the word with its meaning, in the learner's language.
    const why = `${w.german} = ${meaning(w)}`;
    return i % 2
      ? { type: 'choose', prompt: T('What does “{word}” mean?', { word: w.german }), answer: meaning(w), options: [meaning(w), ...others.map(meaning)], hint: T('Choose the English meaning.'), say: w.german, why }
      : { type: 'choose', prompt: T('How do you say “{word}” in German?', { word: meaning(w) }), answer: w.german, options: [w.german, ...others.map(o => o.german)], hint: T('Choose the German.'), say: w.german, why };
  });
  return shuffle([...fromLessons, ...fromWords]).map(withChoices);
}

function makeQuestions(kind) {
  if (kind === 'review') return reviewQuestions();
  if (kind === 'present') {
    const all = [];
    VERBS.forEach(v => QUIZ_PRONOUNS.forEach(([p, person, en]) => {
      const ending = endingFor(v, person);
      all.push({ before: `${p} ${v.stem}`, after: '', hint: `${v.inf} · ${en}`, answer: ending, options: ['e', 'st', 't', 'en'], label: o => '-' + o, say: `${p} ${v.stem}${ending}` });
    }));
    return shuffle(all).slice(0, GRAMMAR_QUIZ_SIZE);
  }
  const items = [
    ...COUNTRIES.map(c => ({ answer: c.aus, rest: c.rest, en: c.en })),
    ...NO_ARTICLE.map(c => ({ answer: 'aus', rest: c.rest, en: c.en })),
  ];
  return shuffle(items).slice(0, GRAMMAR_QUIZ_SIZE).map(c => ({
    before: 'Ich komme', after: ` ${c.rest}.`, hint: T('I come from {country}.', { country: c.en }), answer: c.answer,
    options: ['aus', 'aus der', 'aus den'], label: o => o, say: `Ich komme ${c.answer} ${c.rest}.`,
  }));
}

// `again`: the round being restarted; its questions come back in a new order.
function startGrammarQuiz(kind, again = null) {
  if (kind === 'tree') return startTreeQuiz();
  if (kind !== 'data') {
    gQuiz = { kind, questions: again ? shuffle([...again.questions]) : makeQuestions(kind), index: 0, score: 0, answers: [] };
    return showGrammarQuestion();
  }
  // Lesson exercises are drawn as item numbers, so another device can rebuild the same questions.
  const all = GRAMMAR[currentScope].quiz.items;
  const resume = pendingResume && pendingResume.ref === currentScope ? pendingResume : null;
  pendingResume = null;
  const items = resume ? resume.items.filter(i => i >= 0 && i < all.length)
    : again ? shuffle([...again.items])
    : shuffle(all.map((_, i) => i)).slice(0, quizSize(currentScope));
  const answers = resume ? resume.answers.slice(0, resume.position) : [];
  gQuiz = {
    kind, items, answers,
    questions: items.map(i => all[i]).map(forLanguage).map(withChoices),
    index: answers.length,
    score: answers.filter(Boolean).length,
  };
  recordQuizSession(false);
  showGrammarQuestion();
}

function showGrammarQuestion() {
  const box = document.getElementById('g-quiz');
  if (!box) return;
  const q = gQuiz.questions[gQuiz.index];
  if (!q) return showGrammarResult();
  box.innerHTML = `
    <div class="q-head"><span>${T('Question {n} of {total}', { n: gQuiz.index + 1, total: gQuiz.questions.length })}</span><div class="bar"><i style="width:${Math.round(gQuiz.index / gQuiz.questions.length * 100)}%"></i></div></div>
    <div class="g-q-prompt view-enter"><span class="before"></span> <span class="blank">?</span><span class="after"></span></div>
    <div class="g-q-hint"></div>
    <div class="chip-row" id="g-options"></div>
    <div id="g-feedback" aria-live="polite"></div>
    <div class="actions" id="g-next" hidden><button class="btn btn-primary" type="button">${gQuiz.index + 1 < gQuiz.questions.length ? T('Next question') : T('See results')}</button></div>`;
  const round = gQuiz;
  box.prepend(redoBar(() => startGrammarQuiz(round.kind, round), () => round.answers.length > 0));
  box.querySelector('.before').textContent = q.before;
  box.querySelector('.after').textContent = q.after;
  box.querySelector('.g-q-hint').textContent = L(q.hint);
  // A question about a time shows the clock (from its question only, never its answer).
  const clock = clockPics(q.clocks, 'large');
  if (clock) box.querySelector('.g-q-prompt').before(clock);
  // Data items: the blank sits exactly where the item puts it (no extra space).
  if (q.type === 'gap') {
    const prompt = box.querySelector('.g-q-prompt');
    prompt.innerHTML = '<span class="before"></span><span class="blank">?</span><span class="after"></span>';
    prompt.querySelector('.before').textContent = q.before;
    prompt.querySelector('.after').textContent = q.after;
  }
  // "Which sentence is correct?" items show the meaning and whole sentences as choices.
  if (q.type === 'choose') {
    box.querySelector('.g-q-prompt').classList.add('choose');
    box.querySelector('.g-q-prompt').textContent = L(q.prompt);
    box.querySelector('.g-q-hint').textContent = L(q.hint) || T('Choose the correct German sentence.');
    document.getElementById('g-options').classList.add('stack');
  }
  // Building a sentence or typing an answer: the prompt is an instruction, the hint the meaning.
  const builds = q.type === 'order' || q.type === 'write';
  if (builds) {
    const prompt = box.querySelector('.g-q-prompt');
    prompt.classList.add('choose');
    prompt.textContent = L(q.prompt);
    box.querySelector('.g-q-hint').textContent = L(q.hint) || '';
  }
  // Listening items: the learner hears the word first (it plays once by itself) and can replay it.
  if (q.type === 'listen' || q.listen) {
    const prompt = box.querySelector('.g-q-prompt');
    if (q.type === 'listen') {
      prompt.classList.add('choose');
      prompt.textContent = L(q.prompt);
      box.querySelector('.g-q-hint').textContent = L(q.hint);
    }
    const play = el('button', 'btn listen-btn', '');
    play.type = 'button';
    play.innerHTML = `${icon('speaker')}${T('Play again')}`;
    play.onclick = () => speak(q.say);
    prompt.after(play);
    speak(q.say);
  }
  box.querySelector('#g-next button').onclick = () => {
    gQuiz.index++;
    if (gQuiz.index < gQuiz.questions.length) recordQuizSession(false); // the result screen clears it instead
    showGrammarQuestion();
  };
  if (builds) return (q.type === 'order' ? buildOrder : buildWrite)(box, q);
  // For endings the blank sits right after the stem, with no space.
  if (gQuiz.kind === 'present') box.querySelector('.g-q-prompt').innerHTML = `<span></span><span class="blank">?</span>`;
  if (gQuiz.kind === 'present') box.querySelector('.g-q-prompt span').textContent = q.before;
  q.options.forEach(option => {
    const chip = el('button', 'chip', q.label(option));
    chip.type = 'button';
    chip.onclick = () => answerGrammar(option, chip);
    document.getElementById('g-options').appendChild(chip);
  });
}

function answerGrammar(option, chip) {
  const q = gQuiz.questions[gQuiz.index];
  const right = option === q.answer;
  document.querySelectorAll('#g-options .chip').forEach(c => {
    c.disabled = true;
    if (c.textContent === q.label(q.answer)) c.classList.add('correct');
  });
  if (!right) chip.classList.add('wrong');
  const blank = document.querySelector('#g-quiz .blank');
  if (blank) blank.textContent = q.answer;
  finishGrammar(right);
}

// Shared feedback for every question type.
function finishGrammar(right, note) {
  const q = gQuiz.questions[gQuiz.index];
  if (right) gQuiz.score++;
  gQuiz.answers.push(right);
  if (right && gQuiz.kind === 'data') queue(operation('xp', { amount: XP.answerRight }));
  const label = q.type === 'listen' ? T('You heard')
    : q.type === 'order' || q.type === 'write' || !q.say ? T('Answer')
    : q.say !== q.answer && q.type === 'choose' ? T('The word') : T('Correct form');
  const fb = document.getElementById('g-feedback');
  fb.innerHTML = `<div class="alert ${right ? 'correct' : 'wrong'}"><span class="alert-icon">${icon(right ? 'check' : 'x')}</span>
    <span class="alert-title">${right ? T('Correct') : T('Not quite')}</span><span class="alert-answer"><small>${label}</small><span></span></span><span class="alert-note"></span></div>`;
  fb.querySelector('.alert-answer span').textContent = L(q.show || q.say);
  fb.querySelector('.alert-note').textContent = note !== undefined ? note
    : gQuiz.kind === 'present'
    ? explainEnding(q)
    : gQuiz.kind === 'countries'
    ? (q.answer === 'aus' ? T('No article: this country is used without one.') : q.answer === 'aus der' ? T('Feminine country: die → der after aus.') : T('Plural country: die → den after aus.'))
    : L(q.why || '');
  document.getElementById('g-next').hidden = false;
  document.querySelector('#g-next button').focus({ preventScroll: true });
  if (q.say) speak(q.say);
}

// Word tiles (or dialogue lines) are tapped into order; tapping a placed tile sends it back.
function buildOrder(box, q) {
  const lines = q.mode === 'lines';
  const area = box.querySelector('#g-options');
  area.className = 'order-area';
  area.innerHTML = `<div class="order-line${lines ? ' lines' : ''}" aria-label="${T('Your answer')}"><span class="order-empty">${lines ? T('Tap the lines below in the right order.') : T('Tap the words below in the right order.')}</span></div>
    <div class="chip-row order-bank${lines ? ' stack' : ''}"></div>
    <div class="actions"><button class="btn" type="button" id="g-reset">${T('Start again')}</button><button class="btn btn-primary" type="button" id="g-check" disabled>${T('Check')}</button></div>`;
  const line = area.querySelector('.order-line');
  const bank = area.querySelector('.order-bank');
  const check = area.querySelector('#g-check');
  let order = shuffle([...q.tiles]);
  for (let i = 0; i < 5 && order.join('|') === q.tiles.join('|'); i++) order = shuffle([...q.tiles]);
  const update = () => {
    check.disabled = bank.children.length > 0;
    line.classList.toggle('has-tiles', line.querySelector('.chip') !== null);
  };
  order.forEach(text => {
    const chip = el('button', 'chip', text);
    chip.type = 'button';
    chip.dataset.tile = text; // the answer is checked against this, not the label an admin may have reworded
    if (!lines) chip.lang = 'de';
    chip.onclick = () => { (chip.parentElement === bank ? line : bank).appendChild(chip); update(); };
    bank.appendChild(chip);
  });
  area.querySelector('#g-reset').onclick = () => { line.querySelectorAll('.chip').forEach(c => bank.appendChild(c)); update(); };
  check.onclick = () => {
    const given = [...line.querySelectorAll('.chip')].map(c => c.dataset.tile);
    const right = lines
      ? given.join('\n') === q.tiles.join('\n')
      : [q.answer, ...(q.alts || [])].some(a => normalizeAnswer(a) === normalizeAnswer(given.join(' ')));
    area.querySelectorAll('.chip, #g-reset').forEach(b => { b.disabled = true; });
    line.classList.add(right ? 'correct' : 'wrong');
    area.querySelector('.actions').remove();
    finishGrammar(right);
  };
}

// Typed answers: translations and dictation, checked like the Practice mode.
function buildWrite(box, q) {
  const toGerman = q.lang === 'de';
  const area = box.querySelector('#g-options');
  area.className = 'write-area';
  area.innerHTML = `${q.text ? '<div class="write-text"></div>' : ''}
    <input class="input" id="g-input" autocomplete="off" autocapitalize="off" spellcheck="false" lang="${toGerman ? 'de' : 'en'}"
           placeholder="${T('Type your answer…')}" aria-label="${T('Your answer')}">
    ${toGerman ? germanKeys() : ''}
    <div class="actions"><button class="btn btn-primary" type="button" id="g-check">${T('Check')}</button></div>`;
  if (q.text) {
    area.querySelector('.write-text').textContent = L(q.text);
    if (!toGerman) area.querySelector('.write-text').lang = 'de';
  }
  const input = area.querySelector('#g-input');
  area.querySelectorAll('.keys button').forEach(b => {
    b.onmousedown = e => e.preventDefault();
    b.onclick = () => input.setRangeText(b.dataset.char, input.selectionStart, input.selectionEnd, 'end');
  });
  const submit = () => {
    if (!input.value.trim()) return input.focus();
    let result = { verdict: 'wrong', note: '' };
    for (const target of [q.answer, ...(q.alts || [])]) {
      const r = localCheck(input.value, target, toGerman);
      if (r.verdict === 'correct') { result = r; break; }
      if (r.verdict === 'almost' && result.verdict === 'wrong') result = r;
    }
    input.disabled = true;
    area.querySelectorAll('.keys button').forEach(b => { b.disabled = true; });
    area.querySelector('.actions').remove();
    input.classList.add(result.verdict === 'wrong' ? 'is-wrong' : 'is-right');
    // The checker's note (a missing article, a spelling slip) first, then why the answer is what it is.
    finishGrammar(result.verdict !== 'wrong', [result.note, L(q.why || '')].filter(Boolean).join(' '));
  };
  area.querySelector('#g-check').onclick = submit;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  input.focus({ preventScroll: true });
}

function explainEnding(q) {
  const who = q.before.split(' ')[0];
  if (who === 'du' && q.answer === 't') return T('The stem ends in ß, so du only adds -t.');
  return T('{who} always takes -{ending}.', { who, ending: q.answer });
}

function showGrammarResult() {
  const { kind, score, questions } = gQuiz;
  if (kind === 'data' || kind === 'tree') {
    const bonus = (score >= passMark(currentScope) ? XP.lessonPassed : 0) + (score === questions.length ? XP.perfect : 0);
    if (bonus) queue(operation('xp', { amount: bonus }));
    recordQuizSession(true);
  }
  const best = Math.max(score, grammarScores[currentScope] || 0);
  grammarScores[currentScope] = best;
  store.set('grammar-scores', grammarScores);
  usage.grammar(currentScope, score);
  renderStats();
  renderToc();
  renderRail();
  const box = document.getElementById('g-quiz');
  box.innerHTML = '';
  const keys = Object.keys(GRAMMAR);
  const other = keys.length > 1 ? keys[(keys.indexOf(currentScope) + 1) % keys.length] : null;
  const buttons = [[T('Try again'), 'btn-primary', () => startGrammarQuiz(kind)], [T('Back to the lesson'), '', () => setGrammarView('lesson')]];
  if (other) buttons.push([T('Next lesson: {title}', { title: GRAMMAR[other].title }), '', () => goTo({ scope: other })]);
  const panel = resultPanel({
    title: score >= passMark(currentScope) ? T('Well done!') : T('Keep practising'),
    text: score >= passMark(currentScope) ? T('You have got this.') : T('Score {n} or more to complete it.', { n: passMark(currentScope) }),
    stats: [[`${score}/${questions.length}`, T('this round'), score >= passMark(currentScope) ? 'good' : 'mid'], [`${best}/${questions.length}`, T('best score')]],
    buttons,
  });
  panel.classList.remove('panel', 'narrow');
  if (gQuiz.summary) panel.querySelector('.actions').before(gQuiz.summary());
  const streak = el('div', 'tally-full result-tally');
  panel.appendChild(streak);
  box.appendChild(panel);
  const model = streakModel();
  ZemaTallyView.render(streak, model, 'full', streakLabel(model));
}

/* ---------------- Family tree ----------------
   A lesson with a `tree` (tools/course_content.py) draws the family: people placed by row and x (a percentage of
   the width), a line between each couple and lines down to their children. The lesson labels everyone; the
   exercise numbers them, and the learner matches each number with a word by tapping or dragging. */
const TREE_ROW = 164; // px per generation: room for a label of three lines above the next row's lines
const TREE_PIC = 60; // picture size; its centre sits TREE_PIC_Y below the top of the row
const TREE_PIC_Y = 4 + TREE_PIC / 2;
const shortWord = word => word.split(',')[0].trim(); // "die Oma, die Großmutter" → "die Oma"
const shortMeaning = text => text.replace(/\s*\([^)]*\)/g, ''); // drops "(f.)"
const vocabItem = german => COURSE_UNITS.flatMap(u => u.sections).flatMap(s => s.words).find(w => w.german === german);
const wordMeaning = german => shortMeaning(meaning(vocabItem(german) || { german, english: '' }));

function familyTree(tree, { pins = null, onPerson = null } = {}) {
  const rows = Math.max(...tree.people.map(p => p.row)) + 1;
  const height = rows * TREE_ROW;
  const box = el('div', 'family-tree');
  box.style.height = `${height}px`;
  const at = Object.fromEntries(tree.people.map(p => [p.key, { x: p.x, y: p.row * TREE_ROW + TREE_PIC_Y }]));

  // Lines: x in per cent of the width, y in pixels. The pictures sit on top and hide the line ends.
  const paths = [];
  tree.couples.forEach(([a, b]) => paths.push(`M${at[a].x} ${at[a].y}H${at[b].x}`));
  tree.families.forEach(({ parents, children }) => {
    const [a, b] = parents.map(k => at[k]);
    const mid = (a.x + b.x) / 2;
    const kids = children.map(k => at[k]);
    const bus = kids[0].y - TREE_PIC_Y - 12; // just above the children's row, below the parents' labels
    const xs = kids.map(k => k.x).concat(mid);
    paths.push(`M${mid} ${a.y}V${bus}`, `M${Math.min(...xs)} ${bus}H${Math.max(...xs)}`);
    kids.forEach(k => paths.push(`M${k.x} ${bus}V${k.y}`));
  });
  box.innerHTML = `<svg class="tree-lines" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">
    ${paths.map(d => `<path d="${d}" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`;

  tree.people.forEach(person => {
    const pin = pins && pins.find(p => p.person.key === person.key);
    const clickable = !person.me && (onPerson || pin);
    const node = el(clickable ? 'button' : 'div', `tree-person${person.me ? ' me' : ''}`);
    if (clickable) node.type = 'button';
    node.style.left = `${person.x}%`;
    node.style.top = `${person.row * TREE_ROW}px`;
    const pic = el('span', `tree-pic${person.me ? ' me' : ''}`);
    if (person.me) {
      pic.textContent = 'ich';
      pic.lang = 'de';
    } else {
      pic.appendChild(picImage(person.pic));
    }
    node.appendChild(pic);
    const label = el('span', 'tree-label');
    if (person.me) {
      label.append(el('b', '', 'ich'), el('small', '', T('this is you')));
    } else if (pin) {
      node.dataset.pin = pin.number;
      node.appendChild(el('span', 'tree-pin', String(pin.number)));
      label.classList.add('tree-slot');
    } else {
      const german = el('b', '', shortWord(person.word));
      german.lang = 'de';
      label.append(german, el('small', '', wordMeaning(person.word)));
      node.setAttribute('aria-label', T('Listen: {text}', { text: person.word }));
    }
    node.appendChild(label);
    if (clickable) node.onclick = () => onPerson(person, node);
    box.appendChild(node);
  });
  return box;
}

let treePins = [];
let treeSelected = null;
let treeDrag = null;
let treeDragEnded = false;

function startTreeQuiz() {
  const tree = GRAMMAR[currentScope].tree;
  // New numbers every round, so trying again means reading the tree again, not remembering numbers.
  treePins = shuffle(tree.people.filter(p => !p.me)).map((person, i) => ({ person, number: i + 1, given: null, right: false }));
  gQuiz = { kind: 'tree', questions: treePins, index: 0, score: 0, answers: [], summary: () => treeSummary(treePins) };
  const box = document.getElementById('g-quiz');
  box.innerHTML = `
    <div class="q-head"><span id="t-count"></span><div class="bar"><i id="t-bar"></i></div></div>
    <ol class="tree-how">
      <li>${T('Tap a number on the tree.')}</li>
      <li>${T('Tap the word for that person.')}</li>
    </ol>
    <p class="tree-how-drag">${T('You can also drag a word onto a number.')}</p>
    <div id="t-tree"></div>
    <div id="g-feedback" aria-live="polite"></div>
    <div class="tree-ask" id="t-ask" aria-live="polite"></div>
    <div class="chip-row tree-bank" id="t-bank" role="group" aria-label="${T('Words')}"></div>
    <div class="actions" id="t-done" hidden><button class="btn btn-primary" type="button">${T('See results')}</button></div>`;
  document.getElementById('t-tree').appendChild(familyTree(tree, { pins: treePins, onPerson: person => {
    const pin = treePins.find(p => p.person === person);
    if (pin.given) return speak(person.word);
    selectPin(pin);
  } }));
  const bank = document.getElementById('t-bank');
  shuffle([...treePins.map(p => p.person.word), ...tree.distractors]).forEach(word => bank.appendChild(treeWordChip(word)));
  box.querySelector('#t-done button').onclick = () => showGrammarResult();
  box.prepend(redoBar(startTreeQuiz, () => treePins.some(p => p.given)));
  selectPin(treePins[0]);
  updateTreeCount();
}

const pinNode = pin => document.querySelector(`#t-tree .tree-person[data-pin="${pin.number}"]`);

function selectPin(pin) {
  treeSelected = pin;
  document.querySelectorAll('#t-tree .tree-person[data-pin]').forEach(node => {
    const p = treePins.find(x => String(x.number) === node.dataset.pin);
    node.classList.toggle('selected', p === pin);
    node.setAttribute('aria-pressed', p === pin);
    node.setAttribute('aria-label', p.given
      ? T('Number {n}: {word}', { n: p.number, word: shortWord(p.person.word) })
      : T('Number {n}: who is it?', { n: p.number }));
  });
  const ask = document.getElementById('t-ask');
  if (!pin) {
    ask.innerHTML = '';
    return;
  }
  ask.innerHTML = `<span class="tree-pin">${pin.number}</span><strong></strong>`;
  ask.querySelector('strong').textContent = T('Who is number {n}? Tap the word.', { n: pin.number });
}

function treeWordChip(word) {
  const chip = el('button', 'chip tree-word', shortWord(word));
  chip.type = 'button';
  chip.lang = 'de';
  chip.dataset.word = word;
  chip.onclick = () => {
    if (treeDragEnded) return; // the drop already answered
    if (!treeSelected) return;
    answerPin(treeSelected, word, chip);
  };
  // Dragging: the chip follows the pointer as a copy; letting go over a number answers for that person.
  chip.addEventListener('pointerdown', e => {
    if (e.button !== 0 || chip.disabled) return;
    treeDrag = { chip, x: e.clientX, y: e.clientY, ghost: null };
    chip.setPointerCapture(e.pointerId);
  });
  chip.addEventListener('pointermove', e => {
    if (!treeDrag || treeDrag.chip !== chip) return;
    if (!treeDrag.ghost) {
      if (Math.hypot(e.clientX - treeDrag.x, e.clientY - treeDrag.y) < 8) return;
      treeDrag.ghost = el('span', 'chip tree-ghost', chip.textContent);
      document.body.appendChild(treeDrag.ghost);
      chip.classList.add('dragging');
    }
    treeDrag.ghost.style.left = `${e.clientX}px`;
    treeDrag.ghost.style.top = `${e.clientY}px`;
    const over = pinUnder(e.clientX, e.clientY);
    document.querySelectorAll('#t-tree .drop-over').forEach(n => { if (n !== over) n.classList.remove('drop-over'); });
    if (over) over.classList.add('drop-over');
  });
  const endDrag = (e, drop) => {
    if (!treeDrag || treeDrag.chip !== chip) return;
    const { ghost } = treeDrag;
    treeDrag = null;
    if (!ghost) return; // a tap, not a drag: the click answers
    ghost.remove();
    chip.classList.remove('dragging');
    document.querySelectorAll('#t-tree .drop-over').forEach(n => n.classList.remove('drop-over'));
    treeDragEnded = true;
    setTimeout(() => { treeDragEnded = false; });
    const over = drop && pinUnder(e.clientX, e.clientY);
    if (over) answerPin(treePins.find(p => String(p.number) === over.dataset.pin), word, chip);
  };
  chip.addEventListener('pointerup', e => endDrag(e, true));
  chip.addEventListener('pointercancel', e => endDrag(e, false));
  return chip;
}

function pinUnder(x, y) {
  const node = document.elementFromPoint(x, y)?.closest('#t-tree .tree-person[data-pin]');
  const pin = node && treePins.find(p => String(p.number) === node.dataset.pin);
  return pin && !pin.given ? node : null;
}

function answerPin(pin, word, chip) {
  if (!pin || pin.given) return;
  const right = word === pin.person.word;
  pin.given = word;
  pin.right = right;
  gQuiz.answers.push(right);
  if (right) {
    gQuiz.score++;
    queue(operation('xp', { amount: XP.answerRight }));
  }
  // The person's word is used up; a wrong word goes back to the list, it may belong to someone else.
  const used = document.querySelector(`#t-bank .chip[data-word="${CSS.escape(pin.person.word)}"]`);
  if (used) used.remove();
  if (!right) {
    chip.classList.add('wrong');
    setTimeout(() => chip.classList.remove('wrong'), 700);
  }
  const node = pinNode(pin);
  node.classList.add(right ? 'right' : 'wrong');
  const slot = node.querySelector('.tree-slot');
  slot.innerHTML = '<b lang="de"></b>';
  slot.querySelector('b').textContent = shortWord(pin.person.word);
  if (!right) {
    const not = el('s', '', shortWord(word));
    not.lang = 'de';
    slot.appendChild(not);
  }

  const fb = document.getElementById('g-feedback');
  fb.innerHTML = `<div class="alert ${right ? 'correct' : 'wrong'}"><span class="alert-icon">${icon(right ? 'check' : 'x')}</span>
    <span class="alert-title">${right ? T('Correct') : T('Not quite')}</span><span class="alert-answer"><small></small><span lang="de"></span></span><span class="alert-note"></span></div>`;
  fb.querySelector('.alert-answer small').textContent = T('Number {n}', { n: pin.number });
  fb.querySelector('.alert-answer span').textContent = pin.person.word.replace(', ', ' · ');
  // Who the person is to you, so the answer is explained, not just named.
  const reason = pin.person.why ? ` ${L(pin.person.why)}` : '';
  fb.querySelector('.alert-note').textContent = (right
    ? `${wordMeaning(pin.person.word)}${LANG === 'am' ? '።' : '.'}`
    : T('You chose {word}. This person is {right}: {meaning}.', { word: shortWord(word), right: shortWord(pin.person.word), meaning: wordMeaning(pin.person.word) })) + reason;
  speak(pin.person.word);

  updateTreeCount();
  const next = treePins.find(p => !p.given);
  selectPin(next || null);
  if (!next) {
    document.getElementById('t-bank').hidden = true;
    document.getElementById('t-done').hidden = false;
    document.querySelector('#t-done button').focus({ preventScroll: true });
  }
}

function updateTreeCount() {
  const done = treePins.filter(p => p.given).length;
  document.getElementById('t-count').textContent = T('{done} of {total} matched · {right} right', {
    done, total: treePins.length, right: treePins.filter(p => p.right).length,
  });
  document.getElementById('t-bar').style.width = `${Math.round(done / treePins.length * 100)}%`;
}

// The end of the round: every number with its word, right or wrong.
function treeSummary(pins) {
  const list = el('ol', 'tree-results');
  list.setAttribute('aria-label', T('Your answers'));
  pins.forEach(pin => {
    const row = el('li', pin.right ? 'right' : 'wrong');
    row.innerHTML = `<span class="tree-pin"></span><span class="alert-icon">${icon(pin.right ? 'check' : 'x')}</span>
      <span class="tree-result-text"><b lang="de"></b><small></small></span>`;
    row.querySelector('.tree-pin').textContent = pin.number;
    row.querySelector('b').textContent = shortWord(pin.person.word);
    row.querySelector('small').textContent = pin.right
      ? wordMeaning(pin.person.word)
      : T('{meaning} · you chose {word}', { meaning: wordMeaning(pin.person.word), word: shortWord(pin.given) });
    row.appendChild(listenButton(pin.person.word));
    list.appendChild(row);
  });
  return list;
}

/* ---------------- Speak ---------------- */

// The coach matches the chosen voice: Selam (Katja) or Dawit (Conrad).
const COACH = { katja: { name: T('Selam'), look: 'female' }, conrad: { name: T('Dawit'), look: 'male' } };
const SAY_TIMES = 3;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let speakIndex = 0;
let speakBuiltFor = null;
let speakToken = 0;
// How we hear the learner: 'recognition' (checks the words), 'voice' (only detects speaking), 'manual' (tap to confirm).
let micMode = Recognition ? 'recognition' : 'voice';
let micStream = null;
let audioCtx = null;
let activeRecognition = null;
let manualResolve = null;

const wait = ms => new Promise(r => setTimeout(r, ms));
const coachEl = () => document.getElementById('coach');

function applyCoachLook() {
  const coach = coachEl();
  if (!coach) return;
  const { name, look } = COACH[currentVoice] || COACH.katja;
  coach.classList.toggle('female', look === 'female');
  coach.classList.toggle('male', look === 'male');
  document.getElementById('coach-name').textContent = name;
  const btn = document.getElementById('wv-speak');
  if (btn) btn.lastChild.textContent = T('Say it with {name}', { name });
}

function setPose(pose) {
  const coach = coachEl();
  coach.classList.remove('pose-ear', 'pose-cheer', 'happy');
  if (pose === 'ear') coach.classList.add('pose-ear');
  if (pose === 'cheer') coach.classList.add('pose-cheer', 'happy');
}

function setListening(on) {
  document.getElementById('coach-wrap').classList.toggle('listening', on);
  if (on) document.getElementById('sp-heard').innerHTML = `<span class="mic-meter"><b></b><b></b><b></b></span>${T('Listening…')}`;
}

function bubble(de, en) {
  const box = document.getElementById('sp-bubble');
  box.querySelector('.de').textContent = de;
  box.querySelector('.en').textContent = en;
  box.classList.remove('pop');
  void box.offsetWidth;
  box.classList.add('pop');
}

function markDot(row, i, state) {
  const dot = document.querySelectorAll(`#sp-${row}-row i`)[i];
  dot.className = state;
  dot.textContent = state === 'good' ? '✓' : '';
}

function updateMicBadge() {
  const badge = document.getElementById('sp-mic');
  const [cls, text, tip] = {
    recognition: ['on', T('Checks your pronunciation'), T('Your browser turns speech into text to compare it with the word. In Chrome this is processed by Google.')],
    voice: ['off', T('Hears when you speak'), T('This browser cannot turn speech into text, so the coach only listens for your voice.')],
    manual: ['off', T('Microphone off: tap to confirm'), T('Allow the microphone for this page to let the coach hear you.')],
  }[micMode];
  badge.className = 'badge ' + cls;
  badge.querySelector('span:last-child').textContent = text;
  badge.title = tip;
}

// Plays a clip and resolves when it finishes (or is interrupted).
async function playClip(text, speed = currentSpeed, onAudio) {
  await clipsReady;
  return new Promise(resolve => {
    if (currentAudio) currentAudio.pause();
    tts.cancel();
    const id = clipIds[text];
    if (!id) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      u.rate = { slow: 0.6, normal: 0.85, natural: 1 }[speed];
      u.onend = u.onerror = () => resolve();
      tts.speak(u);
      return;
    }
    const audio = new Audio(`${APP.audioBase}${currentVoice}/${speed}/${id}.mp3`);
    currentAudio = audio;
    onAudio?.(audio);
    audio.onended = audio.onerror = audio.onpause = () => resolve();
    audio.play().catch(() => resolve());
  });
}

async function coachSays(text, speed) {
  coachEl().classList.add('talking');
  const lips = await startLipSync();
  await playClip(text, speed, audio => lips.attach(audio));
  lips.stop();
  coachEl().classList.remove('talking');
}

async function audioContextReady() {
  try {
    audioCtx = audioCtx || new AudioContext();
    if (audioCtx.state !== 'running') await Promise.race([audioCtx.resume(), wait(300)]);
    return audioCtx.state === 'running';
  } catch (e) {
    return false;
  }
}

// Opens the coach's mouth in time with the voice. Runs from script (not CSS), so it also works with Reduce Motion on.
async function startLipSync() {
  const coach = coachEl();
  const mouth = coach.querySelector('.mouth-open');
  const smile = coach.querySelector('.smile');
  const canAnalyse = await audioContextReady();
  const started = performance.now();
  let analyser = null;
  let data = null;
  let loudest = 0;
  let level = 0;
  let running = true;
  let raf = 0;

  const setMouth = v => {
    const open = v > 0.06;
    mouth.style.opacity = open ? 1 : 0;
    smile.style.opacity = open ? 0 : 1;
    mouth.style.transform = `scale(${(0.8 + 0.25 * v).toFixed(3)}, ${(0.15 + 0.95 * v).toFixed(3)})`;
  };

  const frame = () => {
    if (!running) return;
    let target;
    if (analyser) {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) { const x = (v - 128) / 128; sum += x * x; }
      target = Math.min(1, Math.sqrt(sum / data.length) * 6);
      loudest = Math.max(loudest, target);
      // If the analyser stays silent while audio plays, it isn't getting the signal: use the rhythm instead.
      if (performance.now() - started > 700 && loudest < 0.02) analyser = null;
    } else {
      const t = (performance.now() - started) / 1000;
      target = 0.3 + 0.7 * Math.abs(Math.sin(t * 11)) * (0.65 + 0.35 * Math.sin(t * 3.3));
    }
    level += (target - level) * 0.5;
    setMouth(level);
    raf = requestAnimationFrame(frame);
  };
  frame();

  return {
    attach(audio) {
      if (!canAnalyse) return;
      try {
        const source = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        data = new Uint8Array(analyser.fftSize);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch (e) {
        analyser = null;
      }
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      setMouth(0);
    },
  };
}

function renderSpeak() {
  applyCoachLook();
  updateMicBadge();
  if (speakBuiltFor !== currentScope) { speakIndex = 0; speakBuiltFor = currentScope; }
  showSpeakWord();
}

function showSpeakWord() {
  stopSpeakSession();
  const words = learnSequence();
  speakIndex = Math.min(Math.max(speakIndex, 0), words.length - 1);
  const { item } = words[speakIndex];
  document.getElementById('sp-pos').textContent = T('Word {n} of {total}', { n: speakIndex + 1, total: words.length });
  document.getElementById('sp-fill').style.width = Math.round((speakIndex + 1) / words.length * 100) + '%';
  showGermanWord(document.getElementById('sp-word'), item);
  document.getElementById('sp-pic').replaceChildren(...[wordPicture(item, '')].filter(Boolean));
  document.getElementById('sp-meaning').textContent = meaning(item);
  document.getElementById('sp-heard').textContent = '';
  ['listen', 'say'].forEach(row => [0, 1, 2].forEach(i => markDot(row, i, '')));
  setPose('rest');
  bubble('Los geht’s!', T("Hi, I'm {name}. I'll say it three times, then it's your turn.", { name: COACH[currentVoice].name }));
  setSpeakActions('idle');
  const prev = document.getElementById('sp-prev');
  const next = document.getElementById('sp-next');
  prev.disabled = speakIndex === 0;
  next.disabled = speakIndex >= words.length - 1;
  prev.onclick = () => { speakIndex--; showSpeakWord(); };
  if (!document.getElementById('sp-restart')) {
    const restart = el('button', 'btn redo-btn');
    restart.type = 'button';
    restart.id = 'sp-restart';
    restart.innerHTML = `${icon('redo')}${T('Start again from the first word')}`;
    prev.before(restart);
  }
  const restart = document.getElementById('sp-restart');
  restart.disabled = speakIndex === 0;
  restart.onclick = () => { speakIndex = 0; showSpeakWord(); };
  next.onclick = () => { speakIndex++; showSpeakWord(); };
}

function setSpeakActions(state) {
  const box = document.getElementById('sp-actions');
  box.innerHTML = '';
  const add = (label, cls, onClick) => {
    const b = el('button', 'btn ' + cls);
    b.type = 'button';
    b.innerHTML = label;
    b.onclick = onClick;
    box.appendChild(b);
    return b;
  };
  if (state === 'idle') add(`${icon('mic')}${T('Begin')}`, 'btn-primary', startSpeakSession);
  if (state === 'running') add(T('Stop'), 'btn-ghost', () => { stopSpeakSession(); bubble('Kein Problem.', T('Stopped. Press Begin whenever you are ready.')); setPose('rest'); setSpeakActions('idle'); });
  if (state === 'done') {
    add(T('Say it again'), '', startSpeakSession);
    const last = speakIndex >= learnSequence().length - 1;
    if (!last) add(`${T('Next word')} →`, 'btn-primary', () => { speakIndex++; showSpeakWord(); startSpeakSession(); });
  }
}

function stopSpeakSession(releaseMic = false) {
  speakToken++;
  activeRecognition?.abort();
  activeRecognition = null;
  manualResolve?.({ spoke: false });
  manualResolve = null;
  if (currentAudio) currentAudio.pause();
  tts.cancel();
  const coach = coachEl();
  if (coach) coach.classList.remove('talking');
  document.getElementById('coach-wrap')?.classList.remove('listening');
  if (releaseMic && micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
}

async function startSpeakSession() {
  stopSpeakSession();
  const token = speakToken;
  const alive = () => token === speakToken && currentMode === 'speak';
  const { item } = learnSequence()[speakIndex];
  const name = item.german;
  ['listen', 'say'].forEach(row => [0, 1, 2].forEach(i => markDot(row, i, '')));
  document.getElementById('sp-heard').textContent = '';
  setSpeakActions('running');

  // 1. The coach reads the word three times; the middle one slowly.
  setPose('rest');
  bubble('Hör zu!', T('Listen carefully.'));
  await coachSays('Hör zu!');
  for (let i = 0; i < SAY_TIMES; i++) {
    if (!alive()) return;
    markDot('listen', i, 'current');
    bubble(name, i === 1 ? T('Once more, slowly.') : T('Listen · {n} of 3', { n: i + 1 }));
    await coachSays(name, i === 1 ? 'slow' : currentSpeed);
    if (!alive()) return;
    markDot('listen', i, 'done');
    await wait(450);
  }

  // 2. The learner says it three times, with encouragement after each try.
  let good = 0;
  let checked = 0;
  let lastMissed = false;
  for (let i = 0; i < SAY_TIMES; i++) {
    if (!alive()) return;
    markDot('say', i, 'current');
    setPose('rest');
    if (i === 0) { bubble('Jetzt du!', T('Now you. Say “{word}” out loud.', { word: name })); await coachSays('Jetzt du!'); }
    else if (lastMissed) bubble('Jetzt du!', T('Your turn · {n} of 3', { n: i + 1 }));
    else { bubble('Noch einmal!', T('Once more · {n} of 3', { n: i + 1 })); await coachSays('Noch einmal!'); }

    let result;
    for (let silent = 0; ; silent++) {
      if (!alive()) return;
      setPose('ear');
      setListening(micMode !== 'manual');
      if (micMode === 'manual') document.getElementById('sp-heard').textContent = T('Say it out loud, then tap “I said it”.');
      result = await listenForSpeech(name, alive);
      setListening(false);
      if (!alive()) return;
      if (result.spoke) break;
      setPose('rest');
      bubble('Ich höre nichts…', T("I didn't hear you. Try again, a little louder."));
      document.getElementById('sp-heard').textContent = '';
      await wait(1400);
    }

    if (result.heard) document.getElementById('sp-heard').innerHTML = `${T('I heard:')} <strong></strong>`;
    if (result.heard) document.querySelector('#sp-heard strong').textContent = `“${result.heard}”`;
    else document.getElementById('sp-heard').textContent = '';

    lastMissed = result.match === false;
    if (result.match === false) {
      checked++;
      markDot('say', i, 'try');
      setPose('rest');
      bubble('Fast! Noch einmal.', T('Almost! Listen once more and copy the sound.'));
      await coachSays('Fast! Noch einmal.');
      if (!alive()) return;
      await coachSays(name);
    } else {
      if (result.match) { good++; checked++; }
      markDot('say', i, result.match ? 'good' : 'done');
      setPose('cheer');
      const praise = i % 2 ? 'Super!' : 'Sehr gut!';
      bubble(praise, result.match ? T('That sounded right!') : T('Well done!'));
      await coachSays(praise);
    }
    await wait(500);
  }
  if (!alive()) return;

  // 3. Celebrate and count the word as learned.
  learned.add(name);
  updateProgress();
  setPose('cheer');
  bubble('Wunderbar!', checked
    ? T('You said it three times. {good} of {checked} sounded right.', { good, checked })
    : T('You said it three times. Great practice!'));
  await coachSays('Wunderbar!');
  if (!alive()) return;
  setSpeakActions('done');
}

// Listens for one attempt. Falls back from recognition to voice detection to a tap button.
async function listenForSpeech(target, alive) {
  if (micMode === 'recognition') {
    try {
      const heard = await recognizeOnce();
      if (!heard.length) return { spoke: false };
      return { spoke: true, heard: heard[0], match: soundsLike(heard, target) };
    } catch (err) {
      micMode = ['not-allowed', 'service-not-allowed', 'audio-capture'].includes(err) ? 'manual' : 'voice';
      updateMicBadge();
      if (!alive()) return { spoke: false };
      return listenForSpeech(target, alive);
    }
  }
  if (micMode === 'voice') {
    try {
      return { spoke: await detectVoice(alive), heard: null, match: null };
    } catch (err) {
      micMode = 'manual';
      updateMicBadge();
      if (!alive()) return { spoke: false };
    }
  }
  return waitForTap();
}

function recognizeOnce() {
  return new Promise((resolve, reject) => {
    const rec = new Recognition();
    rec.lang = 'de-DE';
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    let heard = [];
    let failed = null;
    const timer = setTimeout(() => rec.stop(), 7000);
    rec.onresult = e => { heard = [...e.results[0]].map(a => a.transcript.trim()).filter(Boolean); };
    rec.onerror = e => { if (!['no-speech', 'aborted'].includes(e.error)) failed = e.error; };
    rec.onend = () => {
      clearTimeout(timer);
      if (activeRecognition === rec) activeRecognition = null;
      failed ? reject(failed) : resolve(heard);
    };
    activeRecognition = rec;
    try { rec.start(); } catch (e) { clearTimeout(timer); reject('start-failed'); }
  });
}

// Without speech-to-text, at least notice that the learner spoke: some sound, then a short pause.
async function detectVoice(alive) {
  if (!micStream) micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioCtx = audioCtx || new AudioContext();
  await audioCtx.resume();
  const source = audioCtx.createMediaStreamSource(micStream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const start = performance.now();
  let voicedMs = 0;
  let lastVoice = 0;
  let last = start;
  return new Promise(resolve => {
    const tick = () => {
      const now = performance.now();
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) { const x = (v - 128) / 128; sum += x * x; }
      if (Math.sqrt(sum / data.length) > 0.035) { voicedMs += now - last; lastVoice = now; }
      last = now;
      const spoke = voicedMs > 250;
      if (!alive() || (spoke && now - lastVoice > 700) || now - start > 7000) {
        source.disconnect();
        return resolve(alive() && spoke);
      }
      setTimeout(tick, 40); // a timer keeps listening even when the tab is in the background
    };
    tick();
  });
}

function waitForTap() {
  return new Promise(resolve => {
    manualResolve = resolve;
    const box = document.getElementById('sp-actions');
    const b = el('button', 'btn btn-success');
    b.type = 'button';
    b.innerHTML = `${icon('check')}${T('I said it')}`;
    b.onclick = () => { b.remove(); manualResolve = null; resolve({ spoke: true, heard: null, match: null }); };
    box.prepend(b);
  });
}

// Close enough counts: recognisers often drop punctuation, umlauts or a short word.
function soundsLike(heardList, target) {
  const targets = acceptedAnswers(target).map(foldUmlauts);
  return heardList.some(h => {
    const heard = foldUmlauts(normalizeAnswer(h));
    return heard && targets.some(t => heard === t || heard.includes(t) ||
      editDistance(heard, t) <= Math.max(1, Math.round(t.length * 0.34)));
  });
}

/* ---------------- Match ---------------- */

// Matching quiz: 10 random pairs; drag (pointer events, so touch works too) or tap a tile, then its match.
const MATCH_QUIZ_SIZE = 10;
let mqPairs = [];
let mqMatched = 0;
let mqMistakes = 0;
let mqSelected = null;
let mqDrag = null;
let mqBuiltFor = null;

function renderMatchQuiz() {
  if (mqBuiltFor !== currentScope) startMatchQuiz();
}

// `again`: the same words as the round being restarted.
function startMatchQuiz(again = null) {
  mqBuiltFor = currentScope;
  const pool = again ? shuffle([...again]) : shuffle([...(currentScope === 'all' ? Object.values(vocabulary).flat() : vocabulary[currentScope])]);
  // Skip repeated words or meanings so each tile has exactly one correct partner.
  const germanSeen = new Set();
  const englishSeen = new Set();
  mqPairs = [];
  for (const item of pool) {
    if (germanSeen.has(item.german) || englishSeen.has(meaning(item).toLowerCase())) continue;
    germanSeen.add(item.german);
    englishSeen.add(meaning(item).toLowerCase());
    mqPairs.push(item);
    if (mqPairs.length === MATCH_QUIZ_SIZE) break;
  }
  mqMatched = 0;
  mqMistakes = 0;
  mqSelected = null;

  const area = document.getElementById('mq-area');
  area.innerHTML = `
    <div class="panel view-enter">
      <div class="fc-progress"><span id="mq-progress"></span><div class="bar"><i id="mq-fill"></i></div><span id="mq-mistakes"></span></div>
      <div class="mq-board">
        <div class="mq-col" id="mq-de"><h3>${T('German')}</h3></div>
        <div class="mq-col" id="mq-en"><h3>${T('English')}</h3></div>
      </div>
    </div>`;
  const makeTile = (index, side, order) => {
    const tile = el('button', 'mq-tile', side === 'de' ? mqPairs[index].german : meaning(mqPairs[index]));
    if (side === 'de') showGermanWord(tile, mqPairs[index]);
    tile.type = 'button';
    tile.style.setProperty('--i', order);
    tile.dataset.side = side;
    tile.dataset.pair = index;
    tile.addEventListener('pointerdown', mqPointerDown);
    tile.addEventListener('click', () => mqTap(tile));
    return tile;
  };
  const order = () => shuffle(mqPairs.map((_, i) => i));
  order().forEach((i, n) => document.getElementById('mq-de').appendChild(makeTile(i, 'de', n)));
  order().forEach((i, n) => document.getElementById('mq-en').appendChild(makeTile(i, 'en', n + 2)));
  const pairs = mqPairs;
  area.querySelector('.panel').prepend(redoBar(() => startMatchQuiz(pairs), () => mqMatched > 0 || mqMistakes > 0));
  mqUpdateStatus();
}

function mqUpdateStatus() {
  document.getElementById('mq-progress').textContent = T('{n} of {total} matched', { n: mqMatched, total: mqPairs.length });
  document.getElementById('mq-fill').style.width = Math.round(mqMatched / mqPairs.length * 100) + '%';
  document.getElementById('mq-mistakes').textContent = mqMistakes === 1 ? T('1 mistake') : T('{n} mistakes', { n: mqMistakes });
}

function mqTryMatch(a, b) {
  if (!a || !b || a === b || a.dataset.side === b.dataset.side) return;
  if (a.classList.contains('matched') || b.classList.contains('matched')) return;
  a.classList.remove('selected');
  b.classList.remove('selected');
  mqSelected = null;
  if (a.dataset.pair === b.dataset.pair) {
    a.classList.add('matched');
    b.classList.add('matched');
    mqMatched++;
    speak(mqPairs[a.dataset.pair].german);
    mqUpdateStatus();
    if (mqMatched === mqPairs.length) setTimeout(mqShowResult, 700);
  } else {
    mqMistakes++;
    [a, b].forEach(t => {
      t.classList.remove('wrong');
      void t.offsetWidth; // restart the shake animation
      t.classList.add('wrong');
      setTimeout(() => t.classList.remove('wrong'), 600);
    });
    mqUpdateStatus();
  }
}

function mqTap(tile) {
  if (mqDrag && mqDrag.moved) return; // this click ends a drag, not a tap
  if (tile.classList.contains('matched')) return;
  if (mqSelected === tile) {
    tile.classList.remove('selected');
    mqSelected = null;
  } else if (mqSelected && mqSelected.dataset.side !== tile.dataset.side) {
    mqTryMatch(mqSelected, tile);
  } else {
    if (mqSelected) mqSelected.classList.remove('selected');
    mqSelected = tile;
    tile.classList.add('selected');
  }
}

function mqPointerDown(e) {
  const tile = e.currentTarget;
  if (tile.classList.contains('matched') || e.button > 0) return;
  mqDrag = { tile, startX: e.clientX, startY: e.clientY, moved: false, ghost: null, target: null };
  window.addEventListener('pointermove', mqPointerMove);
  window.addEventListener('pointerup', mqPointerUp, { once: true });
  window.addEventListener('pointercancel', mqPointerUp, { once: true });
}

function mqPointerMove(e) {
  const d = mqDrag;
  if (!d) return;
  if (!d.moved) {
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
    d.moved = true;
    const rect = d.tile.getBoundingClientRect();
    d.offsetX = d.startX - rect.left;
    d.offsetY = d.startY - rect.top;
    d.ghost = d.tile.cloneNode(true);
    d.ghost.classList.remove('selected');
    d.ghost.classList.add('mq-ghost');
    d.ghost.style.width = rect.width + 'px';
    document.body.appendChild(d.ghost);
    d.tile.classList.add('dragging');
  }
  d.ghost.style.left = (e.clientX - d.offsetX) + 'px';
  d.ghost.style.top = (e.clientY - d.offsetY) + 'px';
  // Tiles block touch scrolling, so scroll the page when dragging near the top or bottom edge.
  if (e.clientY < 90) window.scrollBy(0, -15);
  else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 15);
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.mq-tile');
  const valid = under && under.dataset.side !== d.tile.dataset.side && !under.classList.contains('matched') ? under : null;
  if (valid !== d.target) {
    d.target?.classList.remove('drop-target');
    valid?.classList.add('drop-target');
    d.target = valid;
  }
}

function mqPointerUp() {
  const d = mqDrag;
  window.removeEventListener('pointermove', mqPointerMove);
  window.removeEventListener('pointerup', mqPointerUp);
  window.removeEventListener('pointercancel', mqPointerUp);
  if (!d) return;
  if (d.moved) {
    d.ghost.remove();
    d.tile.classList.remove('dragging');
    d.target?.classList.remove('drop-target');
    mqTryMatch(d.tile, d.target);
    // Let the click that follows pointerup see the drag, then clear it.
    setTimeout(() => { mqDrag = null; }, 0);
  } else {
    mqDrag = null;
  }
}

function mqShowResult() {
  const score = mqPairs.length ? Math.round(mqPairs.length / (mqPairs.length + mqMistakes) * 100) : 0;
  const title = mqMistakes === 0 ? T('Perfect match!') : score >= 75 ? T('Well done!') : T('Keep practising');
  mqPairs.forEach(item => learned.add(item.german));
  updateProgress();
  const area = document.getElementById('mq-area');
  area.innerHTML = '';
  area.appendChild(resultPanel({
    title,
    text: T('You matched all {n} pairs.', { n: mqPairs.length }),
    stats: [[mqPairs.length, T('pairs matched'), 'good'], [mqMistakes, T('mistakes'), mqMistakes ? 'bad' : 'good'], [score + '%', T('accuracy')]],
    buttons: [[T('Play again with new words'), 'btn-primary', startMatchQuiz]],
  }));
}

/* ---------------- Flashcards ---------------- */

// Flashcards: each card is { item, dir } where dir is 'de-en' (German prompt) or 'en-de' (English prompt).
let fcDirection = store.get('book-fc-direction', 'de-en');
let fcQueue = [];
let fcTotal = 0;
let fcRound = []; // this round's words, for "Start again"
let fcFlipped = false;
let fcFirstTry = 0;
let fcMissed = new Map();
let fcSeen = new Set();
let fcBuiltFor = null;

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function renderFlashcards() {
  document.querySelectorAll('.fc-dir').forEach(b => b.classList.toggle('active', b.dataset.dir === fcDirection));
  if (fcBuiltFor !== currentScope) startFlashcards();
}

function setDirection(dir) {
  fcDirection = dir;
  store.set('book-fc-direction', dir);
  document.querySelectorAll('.fc-dir').forEach(b => b.classList.toggle('active', b.dataset.dir === dir));
  startFlashcards();
}

function startFlashcards(items) {
  fcBuiltFor = currentScope;
  items = items || wordsIn(currentScope);
  fcRound = items;
  fcQueue = shuffle(items.map(item => ({
    item,
    dir: fcDirection === 'mixed' ? (Math.random() < 0.5 ? 'de-en' : 'en-de') : fcDirection,
  })));
  fcTotal = fcQueue.length;
  fcFirstTry = 0;
  fcMissed = new Map();
  fcSeen = new Set();
  showCard();
}

function face(side, card) {
  const german = (card.dir === 'de-en') === (side === 'front');
  const node = el('div', `fc-face fc-${side}`);
  node.appendChild(el('span', 'fc-lang', german ? T('German') : T('English')));
  const picture = !german && wordPicture(card.item, 'fc-pic');
  if (picture) node.appendChild(picture);
  const text = node.appendChild(el('div', 'fc-text', german ? card.item.german : meaning(card.item)));
  if (german) showGermanWord(text, card.item);
  if (german) node.appendChild(listenButton(card.item.german));
  node.appendChild(el('div', 'fc-hint', side === 'front'
    ? (card.dir === 'de-en' ? T('What does it mean? Tap the card to check.') : T('Say it in German, then tap the card.'))
    : T('Did you know it?')));
  return node;
}

function showCard() {
  const area = document.getElementById('fc-area');
  area.innerHTML = '';
  fcFlipped = false;
  if (!fcQueue.length) return showSummary();

  const card = fcQueue[0];
  const done = fcTotal - new Set(fcQueue.map(c => c.item.german)).size;
  area.innerHTML = `
    <div class="narrow view-enter">
      <div class="fc-progress"><span>${T('{n} of {total}', { n: done, total: fcTotal })}</span><div class="bar"><i style="width:${Math.round(done / fcTotal * 100)}%"></i></div><span>${card.dir === 'de-en' ? T('German → English') : T('English → German')}</span></div>
      <div class="fc-scene"><div class="fc-card" onclick="flipCard()"></div></div>
      <div class="actions center">
        <button class="btn btn-danger" onclick="answerCard(false)" disabled>${icon('x')}${T('Still learning')}</button>
        <button class="btn btn-primary fc-flip" onclick="flipCard()">${T('Show answer')}</button>
        <button class="btn btn-success" onclick="answerCard(true)" disabled>${icon('check')}${T('I knew it')}</button>
      </div>
      <div class="kbd-hint"><kbd>Space</kbd> ${T('flip')} · <kbd>←</kbd> ${T('still learning')} · <kbd>→</kbd> ${T('knew it')}</div>
    </div>`;
  area.firstElementChild.prepend(redoBar(() => startFlashcards(fcRound), () => fcSeen.size > 0));
  const cardEl = area.querySelector('.fc-card');
  cardEl.appendChild(face('front', card));
  cardEl.appendChild(face('back', card));
}

function flipCard() {
  const cardEl = document.querySelector('#fc-area .fc-card');
  if (!cardEl) return;
  fcFlipped = !fcFlipped;
  cardEl.classList.toggle('flipped', fcFlipped);
  document.querySelectorAll('#fc-area .btn-danger, #fc-area .btn-success').forEach(b => { b.disabled = !fcFlipped; });
  document.querySelector('#fc-area .fc-flip').textContent = fcFlipped ? T('Show question') : T('Show answer');
  // In English → German mode the German answer is spoken as soon as it is revealed.
  if (fcFlipped && fcQueue[0].dir === 'en-de') speak(fcQueue[0].item.german);
}

function answerCard(knewIt) {
  if (!fcFlipped) return;
  const card = fcQueue.shift();
  const key = card.item.german;
  if (knewIt) {
    if (!fcSeen.has(key)) fcFirstTry++;
    learned.add(key);
    updateProgress();
  } else {
    fcMissed.set(key, card.item);
    // Bring the missed card back a few cards later instead of at the very end.
    fcQueue.splice(Math.min(3, fcQueue.length), 0, card);
  }
  fcSeen.add(key);
  showCard();
}

function showSummary() {
  const area = document.getElementById('fc-area');
  area.innerHTML = '';
  const buttons = [[T('Start again'), 'btn-primary', () => startFlashcards()]];
  if (fcMissed.size) buttons.push([T('Review {n} missed', { n: fcMissed.size }), '', () => startFlashcards([...fcMissed.values()])]);
  area.appendChild(resultPanel({
    title: T('Deck complete'),
    text: T('You went through all {n} cards.', { n: fcTotal }),
    stats: [[fcFirstTry, T('known first try'), 'good'], [fcMissed.size, T('to review'), fcMissed.size ? 'mid' : 'good']],
    buttons,
  }));
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSidebar();
  if (document.getElementById('settings').open || isGrammar(currentScope)) return;
  if (currentMode === 'learn' && learnView === 'single' && !e.target.matches('input, select, textarea')) {
    if (e.key === 'ArrowRight') moveWord(1);
    else if (e.key === 'ArrowLeft') moveWord(-1);
    return;
  }
  if (currentMode !== 'flashcards') return;
  if (e.target.matches('input, select, textarea')) return;
  if (e.key === ' ' || e.key === 'Enter') {
    if (e.target.matches('button, [role="button"]')) return; // the focused button already handles its own click
    e.preventDefault();
    flipCard();
  }
  else if (e.key === 'ArrowLeft' || e.key === '1') answerCard(false);
  else if (e.key === 'ArrowRight' || e.key === '2') answerCard(true);
});

/* ---------------- Practice ---------------- */

// Practice: type a translation. A forgiving local check runs first; answers it can't accept go to a
// local AI model (Ollama on this Mac), which judges synonyms and rewordings. The correct answer is always shown.
const AI_URL = 'http://localhost:11434';
const AI_MODEL = 'gemma3:4b';
const PRACTICE_SIZE = 10;
const AI_SYSTEM = `You grade answers in a beginner (A1) German vocabulary course. Judge MEANING, not wording: the expected answer is only one possible translation.
First write "meaning": what the student's answer means in plain English. Then compare it with the phrase and choose "verdict":
- "correct": means the same thing. Synonyms, contractions, different word order and other natural wordings count as correct.
- "almost": the right idea with one real mistake to fix: wrong German article, wrong verb ending, du used instead of Sie (or the reverse), or a spelling mistake.
- "wrong": a different meaning or the wrong word.
Rules:
- Notes in brackets such as (formal), (informal) or (m.) are hints. When translating into English, never mark an answer down for leaving them out.
- "…" means the sentence continues with any word, so the student may leave it open.
- Casual short forms such as "Wie geht's?" or "Wie gehts?" for "Wie geht es dir?" are correct.
- Writing ss for ß or ae, oe, ue for ä, ö, ü is acceptable German spelling, not a mistake.
Examples:
- German "Woher kommst du?", expected "Where are you from?", student "where do you come from" -> correct.
- German "Auf Wiedersehen!", expected "Goodbye!", student "bye" -> correct.
- English "What are you called? (formal)", expected "Wie heißen Sie?", student "Wie heißt du?" -> almost: it uses informal du instead of formal Sie.
- English "the woman", expected "die Frau", student "der Mann" -> wrong: that means "the man".
"feedback": one short, friendly sentence in English, speaking to the student, about THEIR answer.`;
const AI_SCHEMA = {
  type: 'object',
  properties: {
    meaning: { type: 'string', maxLength: 120 },
    verdict: { type: 'string', enum: ['correct', 'almost', 'wrong'] },
    feedback: { type: 'string', maxLength: 200 },
  },
  required: ['meaning', 'verdict', 'feedback'],
};

let aiReady = false;
let prDirection = store.get('book-pr-direction', 'de-en');
let prQueue = [];
let prIndex = 0;
let prResults = [];
let prChecked = false;
let prPending = false;
let prBuiltFor = null;
let prRound = []; // this round's words, for "Start again"

async function detectAI() {
  const badge = document.getElementById('pr-ai');
  if (AM) {
    // The AI grader judges English answers; Amharic answers get the local spelling check.
    badge.className = 'badge off';
    badge.querySelector('span:last-child').textContent = T('Spelling check only');
    badge.title = '';
    return;
  }
  try {
    const res = await fetch(`${AI_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    const { models } = await res.json();
    aiReady = models.some(m => m.name === AI_MODEL || m.model === AI_MODEL);
  } catch (e) {
    aiReady = false;
  }
  badge.className = 'badge ' + (aiReady ? 'on' : 'off');
  badge.querySelector('span:last-child').textContent = aiReady ? T('AI checking on') : T('Spelling check only');
  badge.title = aiReady
    ? T('Answers in your own words are judged by {model}, running privately on this Mac.', { model: AI_MODEL })
    : T('Start Ollama (brew services start ollama) and reload to turn on AI checking.');
}

function renderPractice() {
  document.querySelectorAll('.pr-dir').forEach(b => b.classList.toggle('active', b.dataset.dir === prDirection));
  if (!aiReady) detectAI();
  if (prBuiltFor !== currentScope) startPractice();
}

function setPracticeDirection(dir) {
  prDirection = dir;
  store.set('book-pr-direction', dir);
  document.querySelectorAll('.pr-dir').forEach(b => b.classList.toggle('active', b.dataset.dir === dir));
  startPractice();
}

function startPractice(items) {
  prBuiltFor = currentScope;
  prQueue = items || shuffle(wordsIn(currentScope)).slice(0, PRACTICE_SIZE);
  prRound = prQueue;
  prIndex = 0;
  prResults = [];
  showPracticeQuestion();
}

function showPracticeQuestion() {
  const area = document.getElementById('pr-area');
  if (prIndex >= prQueue.length) return showPracticeSummary();
  const item = prQueue[prIndex];
  const toGerman = prDirection === 'en-de';
  prChecked = false;
  area.innerHTML = `
    <div class="panel narrow view-enter">
      <div class="q-head"><span>${T('Question {n} of {total}', { n: prIndex + 1, total: prQueue.length })}</span><div class="bar"><i style="width:${Math.round(prIndex / prQueue.length * 100)}%"></i></div></div>
      <p class="q-label">${toGerman ? T('Translate from English') : T('Translate from German')}</p>
      <div class="q-prompt"><span class="q-text"></span></div>
      <label class="field-label" for="pr-input">${toGerman ? T('Your German translation') : T('Your English translation')}</label>
      <input class="input" id="pr-input" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="${T('Type your answer…')}" lang="${toGerman ? 'de' : 'en'}">
      ${toGerman ? germanKeys() : ''}
      <div id="pr-feedback" aria-live="polite"></div>
      <div class="actions">
        <button class="btn btn-ghost" id="pr-skip" type="button">${T("I don't know")}</button>
        <button class="btn btn-primary" id="pr-check" type="button">${T('Check answer')}</button>
      </div>
    </div>`;
  if (toGerman) area.querySelector('.q-text').textContent = meaning(item);
  else showGermanWord(area.querySelector('.q-text'), item);
  area.querySelector('.panel').prepend(redoBar(() => startPractice(shuffle([...prRound])), () => prResults.length > 0 || prChecked));
  if (!toGerman) {
    area.querySelector('.q-prompt').appendChild(listenButton(item.german));
  }
  const input = document.getElementById('pr-input');
  area.querySelectorAll('.keys button').forEach(b => {
    b.onmousedown = e => e.preventDefault(); // keep focus (and the caret) in the input
    b.onclick = () => input.setRangeText(b.dataset.char, input.selectionStart, input.selectionEnd, 'end');
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); prChecked ? nextPracticeQuestion() : checkPracticeAnswer(); }
  });
  document.getElementById('pr-check').onclick = () => prChecked ? nextPracticeQuestion() : checkPracticeAnswer();
  document.getElementById('pr-skip').onclick = () => checkPracticeAnswer(true);
  input.focus({ preventScroll: true });
}

// The ä ö ü ß buttons under a German answer field.
const germanKeys = () => `<div class="keys" aria-label="${T('German letters')}">${['ä', 'ö', 'ü', 'ß'].map(c => `<button type="button" data-char="${c}" aria-label="${T('Insert {letter}', { letter: c })}">${c}</button>`).join('')}</div>`;

function normalizeAnswer(text) {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[…."!?¿¡,;:„“”«»።፣፤፥፦፧]/g, ' ')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const foldUmlauts = s => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
const stripUmlauts = s => s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// "to do/make" -> ["to do/make", "to do", "to make"]; "danke / danke schön" -> both halves.
function acceptedAnswers(expected) {
  const parts = expected.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1 && /^to /i.test(parts[0])) {
    for (let i = 1; i < parts.length; i++) if (!/^to /i.test(parts[i])) parts[i] = 'to ' + parts[i];
  }
  return [expected, ...(parts.length > 1 ? parts : [])].map(normalizeAnswer);
}

// Returns { verdict: 'correct' | 'almost' | 'wrong', note } without any AI.
const expandContractions = s => s
  .replace(/\b(what|who|where|how|it|he|she|that)'s\b/g, '$1 is')
  .replace(/\bi'm\b/g, 'i am')
  .replace(/\b(you|we|they)'re\b/g, '$1 are')
  .replace(/\bcan't\b/g, 'cannot')
  .replace(/\b(do|does|is|are)n't\b/g, '$1 not');

function localCheck(answer, expected, toGerman) {
  if (!toGerman) {
    answer = expandContractions(normalizeAnswer(answer));
    expected = expected.split('/').map(p => expandContractions(normalizeAnswer(p))).join(' / ');
  }
  const given = normalizeAnswer(answer);
  if (!given) return { verdict: 'wrong', note: '' };
  const dropEnglishArticle = s => s.replace(/^(the|a|an|to) /, '');
  const germanArticle = /^(der|die|das) /;
  for (const target of acceptedAnswers(expected)) {
    if (given === target) return { verdict: 'correct', note: '' };
    if (!toGerman && dropEnglishArticle(given) === dropEnglishArticle(target)) return { verdict: 'correct', note: '' };
    if (toGerman) {
      if (foldUmlauts(given) === foldUmlauts(target)) return { verdict: 'correct', note: T('ae/oe/ue/ss works, but try the ä ö ü ß keys.') };
      if (stripUmlauts(given) === stripUmlauts(target)) return { verdict: 'almost', note: T('Watch the umlauts (ä, ö, ü) and ß.') };
      if (germanArticle.test(target)) {
        const noun = target.replace(germanArticle, '');
        const article = target.split(' ')[0];
        if (given === noun) return { verdict: 'almost', note: T("Don't forget the article: {article}.", { article }) };
        if (germanArticle.test(given) && given.replace(germanArticle, '') === noun) return { verdict: 'almost', note: T('Wrong article. This noun takes {article}.', { article }) };
      }
    }
    const allowed = target.length <= 5 ? 1 : 2;
    if (editDistance(foldUmlauts(given), foldUmlauts(target)) <= allowed) return { verdict: 'almost', note: T('Nearly! Check the spelling.') };
  }
  return { verdict: 'wrong', note: '' };
}

async function aiCheck(item, answer, toGerman, attempt = 1) {
  const question = toGerman
    ? `Translate from English into German.\nEnglish phrase: "${item.english}"\nExpected German answer: "${item.german}"`
    : `Translate from German into English.\nGerman phrase: "${item.german}"\nExpected English answer: "${item.english}"`;
  const res = await fetch(`${AI_URL}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      model: AI_MODEL,
      stream: false,
      format: AI_SCHEMA,
      keep_alive: '30m',
      // A little randomness plus a length cap stops small models from looping on one phrase.
      options: { temperature: 0.2, num_predict: 200 },
      messages: [
        { role: 'system', content: AI_SYSTEM },
        { role: 'user', content: `${question}\nStudent's answer: "${answer}"` },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  let result;
  try {
    result = JSON.parse(data.message.content);
    if (!['correct', 'almost', 'wrong'].includes(result.verdict)) throw new Error('Unexpected AI verdict');
  } catch (e) {
    if (attempt < 2) return aiCheck(item, answer, toGerman, attempt + 1);
    throw new Error(data.error || e.message);
  }
  // Small models sometimes keep writing after the sentence (e.g. `…right!”} **Note** …`); keep only the sentence.
  const note = String(result.feedback || '').split(/["”]\s*}/)[0].trim();
  return { verdict: result.verdict, note, byAI: true };
}

async function checkPracticeAnswer(skip = false) {
  if (prChecked) return;
  prChecked = true;
  const item = prQueue[prIndex];
  const toGerman = prDirection === 'en-de';
  const input = document.getElementById('pr-input');
  const answer = skip ? '' : input.value.trim();
  const expected = toGerman ? item.german : meaning(item);
  const feedback = document.getElementById('pr-feedback');
  const checkBtn = document.getElementById('pr-check');
  prPending = true;
  input.readOnly = true;
  document.getElementById('pr-skip').style.display = 'none';
  checkBtn.disabled = true;

  let result = localCheck(answer, expected, toGerman);
  if (result.verdict === 'wrong' && answer && aiReady && !AM) {
    feedback.innerHTML = `<div class="alert pending"><span><span class="spinner" aria-hidden="true"></span>${T('Your wording is different, so the AI is checking the meaning…')}</span></div>`;
    try {
      result = await aiCheck(item, answer, toGerman);
    } catch (e) {
      result.note = T('The AI checker did not respond, so only exact and near-exact answers count.');
    }
  }
  if (skip) result.note = T('No problem. This one will come up again.');

  const label = { correct: T('Correct'), almost: T('Almost there'), wrong: skip ? T('Here is the answer') : T('Not quite') }[result.verdict];
  const mark = { correct: 'check', almost: 'dash', wrong: 'x' }[result.verdict];
  feedback.innerHTML = `
    <div class="alert ${result.verdict}">
      <span class="alert-icon">${icon(mark)}</span>
      <span class="alert-title">${label}</span>
      <span class="alert-answer"><small>${T('Correct answer')}</small><span id="pr-answer"></span></span>
      <span class="alert-note" id="pr-note"></span>
    </div>`;
  if (toGerman) showGermanWord(document.getElementById('pr-answer'), item);
  else document.getElementById('pr-answer').textContent = expected;
  document.getElementById('pr-note').textContent = (result.note || '') + (result.byAI ? ` · ${T('Checked by AI')}` : '');
  if (toGerman) speak(item.german);

  prPending = false;
  prResults.push({ item, answer, verdict: result.verdict });
  if (result.verdict === 'correct') {
    learned.add(item.german);
    updateProgress();
  }
  checkBtn.disabled = false;
  checkBtn.textContent = prIndex + 1 < prQueue.length ? T('Next question') : T('See results');
  checkBtn.focus({ preventScroll: true });
}

function nextPracticeQuestion() {
  if (prPending) return; // still waiting for the AI
  prIndex++;
  showPracticeQuestion();
}

function showPracticeSummary() {
  const count = v => prResults.filter(r => r.verdict === v).length;
  const toReview = prResults.filter(r => r.verdict !== 'correct').map(r => r.item);
  const area = document.getElementById('pr-area');
  area.innerHTML = '';
  const buttons = [[T('Next 10 words'), 'btn-primary', () => startPractice()]];
  if (toReview.length) buttons.push([T('Practise {n} again', { n: toReview.length }), '', () => startPractice(shuffle(toReview))]);
  const round = prRound;
  buttons.push([T('Do the same words again'), '', () => startPractice(shuffle([...round]))]);
  area.appendChild(resultPanel({
    title: T('Practice complete'),
    text: prResults.length === 1 ? T('You answered 1 question.') : T('You answered {n} questions.', { n: prResults.length }),
    stats: [[count('correct'), T('correct'), 'good'], [count('almost'), T('almost'), 'mid'], [count('wrong'), T('to learn'), 'bad']],
    buttons,
  }));
}

/* ---------------- Point to hear ---------------- */

// Pointing at German reads it aloud with its meaning on every page (static/core/js/hover-read.js). Here it
// uses the course's player, and stays quiet in Practice, Flashcards, Match and lesson exercises, where it
// would give the answers away.
window.ZemaHoverRead = {
  speak,
  allowed: () => (isGrammar(currentScope) ? grammarView === 'lesson' : currentMode === 'learn' || currentMode === 'speak'),
};

/* ---------------- Start ---------------- */

// On narrow phones the tab row scrolls sideways: keep the chosen tab in view.
function revealActiveTab() {
  const tab = document.querySelector('.tabs:not([hidden]) .tab.active');
  if (!tab) return;
  const bar = tab.parentElement;
  if (bar.scrollWidth <= bar.clientWidth) return;
  const left = tab.offsetLeft - bar.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
  bar.scrollLeft = left;
}

// The landing page links to /learn/#signup and /learn/#signin to open the right dialog straight away.
function openAccountFromLink() {
  const view = { '#signup': 'register', '#signin': 'signin' }[location.hash];
  if (!view) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (account) return;
  openAccount();
  showAccountView(view);
}

(function start() {
  setTheme(store.get('app-theme', 'light'));
  currentVoice = store.get('book-voice', 'katja');
  document.getElementById('voice-select').value = currentVoice;
  applyCoachLook();
  setSpeed(store.get('book-pace', 'normal'));
  document.getElementById('usage-toggle').checked = usage.enabled;
  if (window.hoverRead) document.getElementById('hover-read-toggle').checked = hoverRead.enabled;
  renderAds();
  loadAccount().then(openAccountFromLink);
  renderUnits();
  updateProgress();
  renderPage();
  railReady = true;
  renderRail();
})();
