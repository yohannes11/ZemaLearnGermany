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

// A word's picture (Twemoji SVGs, see tools/word_pictures.py); compounds read "🍎 + 🍰".
// Decorative for screen readers: the German and English text carry the meaning.
function wordPicture(item, className) {
  if (!item.pic) return null;
  const box = el('span', `word-pic ${className}`);
  box.setAttribute('aria-hidden', 'true');
  item.pic.forEach(name => {
    if (name === '+') return box.appendChild(el('span', 'word-pic-plus', '+'));
    const img = el('img');
    img.src = `${APP.picBase}${name}.svg`;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.draggable = false;
    box.appendChild(img);
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
const SYNCED_KEYS = ['book-learned', 'grammar-scores'];
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
  if (!res.ok) throw new Error(T(data.error || 'Something went wrong. Please try again.'));
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
    await syncProgress(true);
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
  clearTimeout(syncTimer);
  await pushProgress();
  try { await api(APP.api.logout, 'POST', {}); } catch (e) {}
  // The progress is safe in the account; clear it here so the next person on this device starts fresh.
  SYNCED_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  account = null;
  location.reload();
}

function localProgress() {
  return { learned: store.get('book-learned', []), grammar: store.get('grammar-scores', {}) };
}

// On sign-in, device and account progress are merged; afterwards this device's state is the latest.
async function syncProgress(merge) {
  if (!account) return;
  try {
    const merged = await api(APP.api.progress, 'PUT', { ...localProgress(), replace: !merge });
    lastSynced = new Date();
    if (!merge) return;
    const before = localProgress();
    if (merged.learned.length === before.learned.length && JSON.stringify(merged.grammar) === JSON.stringify(before.grammar)) return;
    learned = new Set(merged.learned);
    grammarScores = merged.grammar;
    store.set('book-learned', merged.learned);
    store.set('grammar-scores', merged.grammar);
    mqBuiltFor = fcBuiltFor = prBuiltFor = learnBuiltFor = speakBuiltFor = null;
    renderUnits();
    updateProgress();
    renderPage();
  } catch (e) {}
}

function pushProgress() { return syncProgress(false); }

function scheduleSync(key) {
  if (!account || !SYNCED_KEYS.includes(key)) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushProgress, 1500);
}

async function loadAccount() {
  try {
    const { user } = await api(APP.api.me);
    account = user;
  } catch (e) {
    account = null;
  }
  renderAccountButton();
  if (account) syncProgress(true);
}

addEventListener('pagehide', () => {
  if (!account || !syncTimer) return;
  clearTimeout(syncTimer);
  fetch(APP.api.progress, { method: 'PUT', keepalive: true, credentials: 'same-origin', headers: jsonHeaders(), body: JSON.stringify({ ...localProgress(), replace: true }) }).catch(() => {});
});

function openSettings() { document.getElementById('settings').showModal(); }

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

// The course as a woven thread: one bead per unit. A bead's ring fills with the words learned, it turns
// green when the unit test is passed, and the thread is woven up to the current unit.
function renderUnits() {
  const nav = document.getElementById('units');
  nav.innerHTML = '';
  const here = COURSE_UNITS.indexOf(unit);
  const testPass = Math.ceil(REVIEW_QUIZ_SIZE * GRAMMAR_PASS / GRAMMAR_QUIZ_SIZE);
  COURSE_UNITS.forEach((u, i) => {
    if (i) {
      const thread = el('span', i <= here ? 'thread woven' : 'thread');
      thread.setAttribute('aria-hidden', 'true');
      nav.appendChild(thread);
    }
    const words = new Map();
    u.sections.forEach(s => s.words.forEach(w => words.set(w.german, w)));
    const known = [...words.keys()].filter(g => learned.has(g)).length;
    const test = u.grammar.find(g => g.custom === 'review');
    const passed = test && grammarScores[test.key] >= testPass;
    const btn = el('button', 'bead');
    btn.type = 'button';
    btn.classList.toggle('active', u === unit);
    btn.classList.toggle('done', !!passed);
    if (u === unit) btn.setAttribute('aria-current', 'true');
    btn.style.setProperty('--p', Math.round(known / words.size * 100));
    btn.innerHTML = `<span class="bead-core">${u.label ? icon('speaker') : u.id}</span>`;
    btn.setAttribute('aria-label', `${unitName(u)}: ${u.title}. ${T('{known} of {total} words learned', { known, total: words.size })}${passed ? ` · ${T('Unit test passed')}` : ''}`);
    btn.onclick = () => switchUnit(u.id);
    btn.onpointerenter = btn.onfocus = () => previewUnit(u);
    btn.onpointerleave = btn.onblur = () => previewUnit(null);
    nav.appendChild(btn);
  });
  // Keep the current unit visible when the thread scrolls (phones).
  const active = nav.querySelector('.bead.active');
  if (active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  previewUnit(null);
  document.getElementById('brand-sub').textContent = `${unitName(unit)} · ${unit.title}`;
  document.getElementById('part-grammar-name').textContent = lessonsLabel();
}

// Pointing at a bead shows where it leads; leaving it shows the current unit again.
function previewUnit(u) {
  const other = u && u !== unit;
  const shown = other ? u : unit;
  document.getElementById('journey-kicker').textContent = other
    ? T('Go to {unit}', { unit: unitName(u) })
    : `${unitName(unit)} · ${T('stop {n} of {total}', { n: COURSE_UNITS.indexOf(unit) + 1, total: COURSE_UNITS.length })}`;
  document.getElementById('journey-title').textContent = shown.title;
  document.querySelector('.journey-where').classList.toggle('preview', !!other);
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

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const current = sidebar.querySelector('.chapter-link.active');
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
    { html: T('Course'), cls: 'crumb-course', title: T('All units'), go: () => { backToTop(); document.querySelector('.bead.active')?.focus({ preventScroll: true }); } },
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
  document.getElementById('reveal-all').hidden = learnView !== 'grid';
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
      <div class="panel word-page view-enter ${direction === 'back' ? 'turn-back' : ''}">
        ${known ? `<span class="wv-learned">${icon('check')}${T('Learned')}</span>` : ''}
        <span class="wv-section"></span>
        <div class="wv-word"></div>
        <div class="wv-listen"></div>
        <div class="wv-meaning"></div>
        <button class="btn btn-ghost" type="button" id="wv-speak">${icon('mic')}${T('Say it with {name}', { name: COACH[currentVoice].name })}</button>
      </div>
      <div class="wv-nav">
        <button class="btn" type="button" id="wv-prev" ${learnIndex === 0 ? 'disabled' : ''}>← ${T('Previous')}</button>
        <button class="btn btn-primary" type="button" id="wv-next">${learnIndex + 1 < words.length ? `${T('Next word')} →` : `${T('Finish chapter')} →`}</button>
      </div>
      <div class="kbd-hint"><kbd>←</kbd> <kbd>→</kbd> ${T('move between words')} · <kbd>Space</kbd> ${T('show meaning')}</div>
    </div>`;
  content.querySelector('.wv-section').textContent = currentScope === 'all' ? `${section} · ${SECTION_TITLES[section]}` : T('German');
  content.querySelector('.wv-word').textContent = item.german;
  const picture = wordPicture(item, 'wv-pic');
  if (picture) content.querySelector('.wv-word').before(picture);
  const listen = listenButton(item.german);
  listen.classList.add('lg');
  content.querySelector('.wv-listen').appendChild(listen);
  showWordMeaning(false);
  document.getElementById('wv-speak').onclick = () => {
    speakIndex = learnIndex;
    speakBuiltFor = currentScope;
    goTo({ mode: 'speak' });
    startSpeakSession();
  };
  document.getElementById('wv-prev').onclick = () => moveWord(-1);
  document.getElementById('wv-next').onclick = () => moveWord(1);
}

function showWordMeaning(reveal) {
  const box = document.querySelector('#learn-content .wv-meaning');
  if (!box) return;
  const { item } = learnSequence()[learnIndex];
  box.innerHTML = '';
  if (!reveal) {
    const btn = el('button', 'btn', '');
    btn.type = 'button';
    btn.id = 'wv-reveal';
    btn.innerHTML = `${icon('eye')}${T('Show meaning')}`;
    btn.onclick = () => showWordMeaning(true);
    box.appendChild(btn);
    return;
  }
  box.appendChild(el('div', 'wv-answer', meaning(item)));
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

  const reveal = document.getElementById('reveal-all');
  const cards = () => [...grid.querySelectorAll('.vocab-card')];
  const syncLabel = () => { reveal.querySelector('span').textContent = cards().every(c => c.classList.contains('open')) ? T('Hide all') : T('Reveal all'); };
  reveal.onclick = () => {
    const open = !cards().every(c => c.classList.contains('open'));
    cards().forEach((c, i) => setTimeout(() => toggleCard(c, open), open ? i * 25 : 0));
    setTimeout(syncLabel, open ? cards().length * 25 + 30 : 0);
  };
  syncLabel();

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

function vocabCard(item, index) {
  const card = el('div', 'vocab-card');
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-expanded', 'false');
  card.style.setProperty('--i', Math.min(index, 20));
  card.classList.toggle('learned', learned.has(item.german));
  card.dataset.german = item.german;
  card.innerHTML = `<span class="vc-learned" aria-hidden="true"></span>
    <div class="vc-top"><span class="vc-word"></span></div>
    <div class="vc-meaning"><span class="vc-hint">${icon('eye', 'style="width:16px;height:16px"')}${T('Show meaning')}</span><span class="vc-text"></span></div>`;
  card.querySelector('.vc-word').textContent = item.german;
  card.querySelector('.vc-text').textContent = meaning(item);
  card.querySelector('.vc-word').lang = 'de'; // lets long compounds hyphenate at German syllables
  const picture = wordPicture(item, 'vc-pic');
  if (picture) card.querySelector('.vc-top').before(picture); // own row: the word keeps the full width
  card.querySelector('.vc-top').appendChild(listenButton(item.german));
  card.onclick = () => toggleCard(card, !card.classList.contains('open'));
  card.onkeydown = e => {
    if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); card.click(); }
  };
  return card;
}

function toggleCard(card, open) {
  card.classList.toggle('open', open);
  card.setAttribute('aria-expanded', open);
  if (open && !learned.has(card.dataset.german)) {
    learned.add(card.dataset.german);
    card.classList.add('learned');
    updateProgress();
  }
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
  const kind = lesson.custom || 'data';
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
    <div><small>${T('Exercise · {n} quick questions', { n: quizSize(currentScope) })}</small>
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
    options: [right, ...others], hint: '', say: item.say, show: right, why: '',
  };
}

// Unit test: questions from every lesson of the unit, plus vocabulary in both directions.
function reviewQuestions() {
  const pool = shuffle(Object.values(GRAMMAR).filter(g => g.quiz && !g.custom).flatMap(g => g.quiz.items)).map(forLanguage);
  const fromLessons = pool.slice(0, Math.min(pool.length, REVIEW_QUIZ_SIZE - 4));
  const words = shuffle(wordsIn('all').filter(w => w.german.length <= 40));
  const fromWords = words.slice(0, REVIEW_QUIZ_SIZE - fromLessons.length).map((w, i) => {
    const others = shuffle(words.filter(o => o.german !== w.german && meaning(o) !== meaning(w))).slice(0, 2);
    return i % 2
      ? { type: 'choose', prompt: T('What does “{word}” mean?', { word: w.german }), answer: meaning(w), options: [meaning(w), ...others.map(meaning)], hint: T('Choose the English meaning.'), say: w.german, why: '' }
      : { type: 'choose', prompt: T('How do you say “{word}” in German?', { word: meaning(w) }), answer: w.german, options: [w.german, ...others.map(o => o.german)], hint: T('Choose the German.'), say: w.german, why: '' };
  });
  return shuffle([...fromLessons, ...fromWords]).map(withChoices);
}

function makeQuestions(kind) {
  if (kind === 'review') return reviewQuestions();
  if (kind === 'data') {
    return shuffle([...GRAMMAR[currentScope].quiz.items]).slice(0, quizSize(currentScope)).map(forLanguage).map(withChoices);
  }
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

function startGrammarQuiz(kind) {
  gQuiz = { kind, questions: makeQuestions(kind), index: 0, score: 0 };
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
  box.querySelector('.before').textContent = q.before;
  box.querySelector('.after').textContent = q.after;
  box.querySelector('.g-q-hint').textContent = L(q.hint);
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
  box.querySelector('#g-next button').onclick = () => { gQuiz.index++; showGrammarQuestion(); };
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
  const label = q.type === 'listen' ? T('You heard')
    : q.type === 'order' || q.type === 'write' || !q.say ? T('Answer')
    : q.say !== q.answer && q.type === 'choose' ? T('The word') : T('Correct form');
  const fb = document.getElementById('g-feedback');
  fb.innerHTML = `<div class="alert ${right ? 'correct' : 'wrong'}"><span class="alert-icon">${icon(right ? 'check' : 'x')}</span>
    <span class="alert-title">${right ? T('Correct') : T('Not quite')}</span><span class="alert-answer"><small>${label}</small><span></span></span><span class="alert-note"></span></div>`;
  fb.querySelector('.alert-answer span').textContent = L(q.show || q.say);
  fb.querySelector('.alert-note').textContent = note !== undefined ? note
    : gQuiz.kind === 'present'
    ? (right ? '' : explainEnding(q))
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
    finishGrammar(result.verdict !== 'wrong', result.note || L(q.why || ''));
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
  const best = Math.max(score, grammarScores[currentScope] || 0);
  grammarScores[currentScope] = best;
  store.set('grammar-scores', grammarScores);
  usage.grammar(currentScope, score);
  renderStats();
  renderToc();
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
  box.appendChild(panel);
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
  document.getElementById('sp-word').textContent = item.german;
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

function startMatchQuiz() {
  mqBuiltFor = currentScope;
  const pool = shuffle([...(currentScope === 'all' ? Object.values(vocabulary).flat() : vocabulary[currentScope])]);
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
  node.appendChild(el('div', 'fc-text', german ? card.item.german : meaning(card.item)));
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
    else if (e.key === ' ' && !e.target.matches('button, [role="button"]')) { e.preventDefault(); showWordMeaning(true); }
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
  area.querySelector('.q-text').textContent = toGerman ? meaning(item) : item.german;
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
  document.getElementById('pr-answer').textContent = expected;
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
  area.appendChild(resultPanel({
    title: T('Practice complete'),
    text: prResults.length === 1 ? T('You answered 1 question.') : T('You answered {n} questions.', { n: prResults.length }),
    stats: [[count('correct'), T('correct'), 'good'], [count('almost'), T('almost'), 'mid'], [count('wrong'), T('to learn'), 'bad']],
    buttons,
  }));
}

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
  renderAds();
  loadAccount().then(openAccountFromLink);
  renderUnits();
  updateProgress();
  renderPage();
})();
