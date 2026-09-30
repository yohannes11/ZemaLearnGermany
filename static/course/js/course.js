// Server-side settings and URLs, rendered by Django into the page (see apps/course/views.py).
const APP = JSON.parse(document.getElementById('app-config').textContent);

// Django's CSRF token, read fresh for every request: signing in rotates it.
function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}
const jsonHeaders = () => ({ 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() });

const tts = window.speechSynthesis;
let currentSpeed = 'normal';

// Course content (Units 1–7) lives in course-data.js; the app shows one unit at a time.
const COURSE_UNITS = window.COURSE.units;
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
loadUnit(unitOf(savedScope)?.id || store.get('current-unit', 1));
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

const scopeTitle = scope => scope === 'all' ? 'All chapters' : isGrammar(scope) ? GRAMMAR[scope].title : SECTION_TITLES[scope];
const icon = (name, extra = '') => `<svg class="icon" ${extra}><use href="#i-${name}"/></svg>`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function listenButton(german) {
  const btn = el('button', 'icon-btn');
  btn.type = 'button';
  btn.innerHTML = icon('speaker');
  btn.setAttribute('aria-label', `Listen: ${german}`);
  btn.title = 'Listen';
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
      s.innerHTML = `<div class="ad-placeholder" aria-hidden="true"><div><b>Advertisement</b><br>Google AdSense · “${s.dataset.ad}” slot · ${sizes[s.dataset.ad]}</div></div>`;
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
    s.innerHTML = '<span class="ad-label">Advertisement</span>';
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
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function renderAccountButton() {
  const btn = document.getElementById('account-btn');
  btn.classList.toggle('signed-in', !!account);
  if (account) {
    btn.innerHTML = `<span class="avatar"></span><span id="account-label"></span>`;
    btn.querySelector('.avatar').textContent = account.name.trim()[0].toUpperCase();
    btn.querySelector('#account-label').textContent = account.name.split(' ')[0];
    btn.setAttribute('aria-label', `Account: ${account.name}`);
  } else {
    btn.innerHTML = '<svg class="icon"><use href="#i-user"/></svg><span id="account-label">Sign in</span>';
    btn.setAttribute('aria-label', 'Sign in');
  }
}

function showAccountView(view) {
  document.querySelectorAll('#account .auth-form').forEach(f => { f.hidden = f.dataset.view !== view; });
  document.getElementById('account-title').textContent = { signin: 'Sign in', register: 'Create account', profile: 'Your account' }[view];
  accountMessage('');
  if (view === 'profile') {
    document.getElementById('profile-avatar').textContent = account.name.trim()[0].toUpperCase();
    document.getElementById('profile-name').textContent = account.name;
    document.getElementById('profile-email').textContent = `@${account.username} · ${account.email}`;
    document.getElementById('admin-link').hidden = account.role !== 'admin';
    document.getElementById('sync-note').textContent = lastSynced
      ? `Your progress is saved to your account · last saved ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
      : 'Your progress is saved to your account.';
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
    accountMessage(kind === 'register' ? `Welcome, ${user.name}! Your progress will now be saved.` : `Welcome back, ${user.name}.`, true);
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
    accountMessage('Your password has been changed.', true);
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

function renderUnits() {
  const nav = document.getElementById('units');
  nav.innerHTML = '';
  COURSE_UNITS.forEach(u => {
    const words = new Map();
    u.sections.forEach(s => s.words.forEach(w => words.set(w.german, w)));
    const known = [...words.keys()].filter(g => learned.has(g)).length;
    const btn = el('button', 'unit-pill');
    btn.type = 'button';
    btn.classList.toggle('active', u.id === unit.id);
    if (u.id === unit.id) btn.setAttribute('aria-current', 'true');
    btn.innerHTML = `<b>Unit ${u.id}</b><span></span><i style="width:${Math.round(known / words.size * 100)}%"></i>`;
    btn.querySelector('span').textContent = u.title;
    btn.title = `${u.title} · ${known}/${words.size} words learned`;
    btn.onclick = () => switchUnit(u.id);
    nav.appendChild(btn);
  });
  // Keep the current unit visible when the bar scrolls (phones).
  const active = nav.querySelector('.unit-pill.active');
  if (active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  document.getElementById('brand-sub').textContent = `Unit ${unit.id} · ${unit.title}`;
}

function renderParts() {
  const inGrammar = isGrammar(currentScope);
  document.querySelectorAll('.part').forEach(b => {
    const on = (b.dataset.part === 'grammar') === inGrammar;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
  const all = wordsIn('all');
  const known = all.filter(w => learned.has(w.german)).length;
  const lessons = Object.keys(GRAMMAR);
  const passed = lessons.filter(k => grammarScores[k] >= GRAMMAR_PASS).length;
  document.getElementById('part-vocab-meta').innerHTML =
    `<span>${SCOPES.length - 1} sections · ${known}/${all.length} words</span><span class="bar"><i style="width:${Math.round(known / all.length * 100)}%"></i></span>`;
  document.getElementById('part-grammar-meta').innerHTML =
    `<span>${lessons.length} lesson${lessons.length === 1 ? '' : 's'} · ${passed} completed</span><span class="bar"><i style="width:${Math.round(passed / lessons.length * 100)}%"></i></span>`;
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
  document.getElementById('eyebrow').innerHTML = grammar
    ? `Unit ${unit.id} · Grammar · Lesson ${grammar.code}`
    : currentScope === 'all'
    ? 'Vocabulary · Review'
    : `Vocabulary · ${currentScope} <span class="ethiopic" aria-hidden="true">· ${geez(SCOPES.indexOf(currentScope) + 1)}</span>`;
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
      ? 'Read the lesson, then try the exercise'
      : `Best exercise score: <strong>${best}</strong> of ${GRAMMAR_QUIZ_SIZE}`;
    document.getElementById('page-fill').style.width = Math.round((best || 0) / GRAMMAR_QUIZ_SIZE * 100) + '%';
    return;
  }
  const words = wordsIn(currentScope);
  const known = words.filter(w => learned.has(w.german)).length;
  document.getElementById('page-stat').innerHTML = `<strong>${known}</strong> of ${words.length} words learned`;
  document.getElementById('page-fill').style.width = Math.round(known / words.length * 100) + '%';
}

function renderToc() {
  const toc = document.getElementById('toc');
  toc.innerHTML = '';
  renderParts();
  const inGrammar = isGrammar(currentScope);
  document.getElementById('sidebar-heading').textContent = inGrammar ? 'Grammar lessons' : 'Vocabulary sections';
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
    btn.title = scope === 'all' ? '' : `Chapter ${geez(SCOPES.indexOf(scope) + 1)}`;
    btn.innerHTML = `<span class="chapter-num">${scope === 'all' ? 'All' : scope}</span>
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
    btn.classList.toggle('done', best >= GRAMMAR_PASS);
    if (key === currentScope) btn.setAttribute('aria-current', 'true');
    btn.innerHTML = `<span class="chapter-num g">${g.code}</span>
      <span><span class="chapter-name"></span>
      <span class="chapter-meta"><span class="bar"><i style="width:${Math.round((best || 0) / GRAMMAR_QUIZ_SIZE * 100)}%"></i></span>${best === undefined ? 'New' : `${best}/${GRAMMAR_QUIZ_SIZE}`}</span></span>
      <span class="chapter-check">${icon('check', 'style="width:18px;height:18px"')}</span>`;
    btn.querySelector('.chapter-name').textContent = g.title;
    btn.onclick = () => goTo({ scope: key });
    li.appendChild(btn);
    toc.appendChild(li);
  });
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('scrim').classList.add('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('scrim').classList.remove('show');
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
    card.innerHTML = `<span class="g-badge">${g.code}</span><div><small>Grammar for this chapter</small><strong></strong></div>`;
    card.querySelector('strong').textContent = g.title;
    const btn = el('button', 'btn', '');
    btn.type = 'button';
    btn.innerHTML = `Open lesson ${icon('arrow')}`;
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
      <div class="fc-progress"><span>Word ${learnIndex + 1} of ${words.length}</span><div class="bar"><i style="width:${Math.round((learnIndex + 1) / words.length * 100)}%"></i></div></div>
      <div class="panel word-page view-enter ${direction === 'back' ? 'turn-back' : ''}">
        ${known ? `<span class="wv-learned">${icon('check')}Learned</span>` : ''}
        <span class="wv-section"></span>
        <div class="wv-word"></div>
        <div class="wv-listen"></div>
        <div class="wv-meaning"></div>
        <button class="btn btn-ghost" type="button" id="wv-speak">${icon('mic')}Say it with ${COACH[currentVoice].name}</button>
      </div>
      <div class="wv-nav">
        <button class="btn" type="button" id="wv-prev" ${learnIndex === 0 ? 'disabled' : ''}>← Previous</button>
        <button class="btn btn-primary" type="button" id="wv-next">${learnIndex + 1 < words.length ? 'Next word →' : 'Finish chapter →'}</button>
      </div>
      <div class="kbd-hint"><kbd>←</kbd> <kbd>→</kbd> move between words · <kbd>Space</kbd> show meaning</div>
    </div>`;
  content.querySelector('.wv-section').textContent = currentScope === 'all' ? `${section} · ${SECTION_TITLES[section]}` : 'German';
  content.querySelector('.wv-word').textContent = item.german;
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
    btn.innerHTML = `${icon('eye')}Show meaning`;
    btn.onclick = () => showWordMeaning(true);
    box.appendChild(btn);
    return;
  }
  box.appendChild(el('div', 'wv-answer', item.english));
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
  const buttons = [['Practise these words', 'btn-primary', () => goTo({ mode: 'practice' })]];
  if (nextScope) buttons.push([`Next chapter: ${SECTION_TITLES[nextScope]}`, '', () => goTo({ scope: nextScope })]);
  buttons.push(['Start over', 'btn-ghost', () => { learnIndex = 0; renderWordPage(); }]);
  content.appendChild(resultPanel({
    title: currentScope === 'all' ? 'You have read every word' : 'Chapter read',
    text: `You went through all ${total} words${currentScope === 'all' ? ' in the unit' : ' in this chapter'}.`,
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
  const syncLabel = () => { reveal.querySelector('span').textContent = cards().every(c => c.classList.contains('open')) ? 'Hide all' : 'Reveal all'; };
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
    next.innerHTML = `Next chapter: <strong></strong>${icon('arrow')}`;
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
    <div class="vc-meaning"><span class="vc-hint">${icon('eye', 'style="width:16px;height:16px"')}Show meaning</span><span class="vc-text"></span></div>`;
  card.querySelector('.vc-word').textContent = item.german;
  card.querySelector('.vc-text').textContent = item.english;
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
const VERBS = [
  { inf: 'machen', stem: 'mach', en: 'to do / make' },
  { inf: 'kochen', stem: 'koch', en: 'to cook' },
  { inf: 'kommen', stem: 'komm', en: 'to come' },
  { inf: 'heißen', stem: 'heiß', en: 'to be called' },
];
// Table rows: label, pronoun used for audio, ending, English.
const PERSONS = [
  { label: 'ich', say: 'ich', ending: 'e', en: 'I' },
  { label: 'du', say: 'du', ending: 'st', en: 'you' },
  { label: 'er / sie / es', say: 'er', ending: 't', en: 'he / she / it' },
  { label: 'wir', say: 'wir', ending: 'en', en: 'we' },
  { label: 'ihr', say: 'ihr', ending: 't', en: 'you all' },
  { label: 'sie / Sie', say: 'sie', ending: 'en', en: 'they / you (formal)' },
];
const QUIZ_PRONOUNS = [
  ['ich', 0, 'I'], ['du', 1, 'you'], ['er', 2, 'he'], ['sie', 2, 'she'], ['es', 2, 'it'],
  ['wir', 3, 'we'], ['ihr', 4, 'you all'], ['sie', 5, 'they'], ['Sie', 5, 'you (formal)'],
];
const COUNTRIES = [
  { nom: 'die Schweiz', gender: 'feminine', aus: 'aus der', rest: 'Schweiz', en: 'Switzerland' },
  { nom: 'die Türkei', gender: 'feminine', aus: 'aus der', rest: 'Türkei', en: 'Turkey' },
  { nom: 'die Vereinigten Staaten', gender: 'plural', aus: 'aus den', rest: 'Vereinigten Staaten', en: 'the United States' },
  { nom: 'die Niederlande', gender: 'plural', aus: 'aus den', rest: 'Niederlanden', en: 'the Netherlands' },
  { nom: 'die Vereinigten Arabischen Emirate', gender: 'plural', aus: 'aus den', rest: 'Vereinigten Arabischen Emiraten', en: 'the UAE' },
];
const NO_ARTICLE = [
  { rest: 'Deutschland', en: 'Germany' },
  { rest: 'Äthiopien', en: 'Ethiopia' },
  { rest: 'Österreich', en: 'Austria' },
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
    page.appendChild(quizPanel(kind));
    const back = lessonPanel('', 'Need a reminder?', `<p>Go back to the lesson for the rule and the examples, then return here.</p><div class="actions" style="justify-content:flex-start"></div>`);
    const btn = el('button', 'btn', '');
    btn.type = 'button';
    btn.innerHTML = `${icon('learn')}Review the lesson`;
    btn.onclick = () => setGrammarView('lesson');
    back.querySelector('.actions').appendChild(btn);
    page.appendChild(back);
    return;
  }
  page.appendChild(exerciseCallout());
  if (kind === 'present') renderPresentLesson(page);
  else if (kind === 'countries') renderCountriesLesson(page);
  else renderDataLesson(page, lesson);
}

// The part of an example that is spoken: "A → B" examples say B.
const spokenPart = text => (text.includes('→') ? text.split('→').pop().trim() : text);

function lessonTable(table) {
  const wrap = el('div', 'table-scroll');
  const t = el('table', 'conj-table');
  t.innerHTML = `<thead><tr>${table.head.map(h => `<th></th>`).join('')}<th></th></tr></thead><tbody></tbody>`;
  t.querySelectorAll('thead th').forEach((th, i) => { th.textContent = table.head[i] || ''; });
  table.rows.forEach((row, r) => {
    const tr = el('tr');
    row.forEach((cell, c) => {
      const td = el('td', c === 0 ? '' : 'form', cell);
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

function renderDataLesson(page, lesson) {
  page.appendChild(lessonPanel('', 'The idea', lesson.intro.map(p => `<p>${p}</p>`).join('')));
  lesson.blocks.forEach(block => {
    const panel = lessonPanel(block.step || '', block.title, block.text ? `<p></p>` : '');
    if (block.text) panel.querySelector('p').textContent = block.text;
    if (block.table) panel.appendChild(lessonTable(block.table));
    if (block.examples) {
      const list = el('div', 'ex-list');
      block.examples.forEach(([de, en]) => {
        const row = el('div', 'ex-row');
        row.innerHTML = '<div><div class="ex-de"></div><div class="ex-en"></div></div>';
        row.querySelector('.ex-de').textContent = de;
        row.querySelector('.ex-en').textContent = en;
        row.appendChild(listenButton(de));
        list.appendChild(row);
      });
      panel.appendChild(list);
    }
    page.appendChild(panel);
  });
  if (lesson.rules && lesson.rules.length) {
    const remember = lessonPanel('', 'Remember', '<div class="rule-cards"></div>');
    lesson.rules.forEach(([title, text]) => {
      const card = el('div', 'rule-card');
      card.innerHTML = '<b></b><span></span>';
      card.querySelector('b').textContent = title;
      card.querySelector('span').textContent = text;
      remember.querySelector('.rule-cards').appendChild(card);
    });
    page.appendChild(remember);
  }
}

function exerciseCallout() {
  const best = grammarScores[currentScope];
  const card = el('section', 'exercise-cta');
  card.innerHTML = `<span class="cta-icon">${icon('practice')}</span>
    <div><small>Exercise · ${GRAMMAR_QUIZ_SIZE} quick questions</small>
    <strong>${best === undefined ? 'Test yourself on this rule' : best >= GRAMMAR_PASS ? 'Keep it fresh: practise again' : 'Try again and beat your score'}</strong>
    <span>${best === undefined ? `Score ${GRAMMAR_PASS} or more to complete the lesson.` : `Best score so far: ${best} of ${GRAMMAR_QUIZ_SIZE}.`}</span></div>`;
  const start = el('button', 'btn btn-primary', '');
  start.type = 'button';
  start.innerHTML = `${best === undefined ? 'Start the exercise' : 'Practise again'} ${icon('arrow')}`;
  start.onclick = () => setGrammarView('exercise');
  card.appendChild(start);
  return card;
}

function renderPresentLesson(lesson) {
  lesson.appendChild(lessonPanel('', 'Why verbs change their ending',
    `<p>In German, the end of a verb changes to match <strong>who</strong> is doing the action: <em class="de">ich mache</em>, <em class="de">du machst</em>, <em class="de">wir machen</em>.</p>
     <p>Regular verbs all follow the same pattern, built in two steps.</p>`));

  const step1 = lessonPanel('Step 1', 'Find the stem',
    `<p>Take the infinitive (the dictionary form) and remove the ending <strong>-en</strong>. Pick a verb:</p>
     <div class="chip-row" id="verb-chips"></div>
     <div class="stem-demo" id="stem-demo"></div>`);
  const step2 = lessonPanel('Step 2', 'Add the ending',
    `<p>Add the ending that belongs to the person. Press a speaker to hear each form.</p>
     <table class="conj-table"><thead><tr><th>Person</th><th>Ending</th><th>Form</th><th class="en">Meaning</th><th></th></tr></thead><tbody id="conj-body"></tbody></table>
     <div class="g-note" id="verb-note" hidden></div>`);
  const remember = lessonPanel('', 'Remember',
    `<div class="rule-cards">
       <div class="rule-card"><b>-e · -st · -t</b><span>ich, du, er/sie/es</span></div>
       <div class="rule-card"><b>-en · -t · -en</b><span>wir, ihr, sie/Sie</span></div>
       <div class="rule-card"><b>wir = sie = Sie</b><span>These look just like the infinitive: <mark>machen</mark></span></div>
       <div class="rule-card"><b>er/sie/es = ihr</b><span>Both end in <mark>-t</mark>: er macht, ihr macht</span></div>
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
  note.textContent = 'Watch out: the stem heiß- already ends in ß, so du only adds -t: du heißt (not du heißst).';
}

function renderCountriesLesson(lesson) {
  lesson.appendChild(lessonPanel('', 'Most countries need no article',
    `<p>To say where you are from, use <strong>aus</strong> + the country: <em class="de">Ich komme aus Deutschland.</em> <em class="de">Ich komme aus Äthiopien.</em></p>
     <p>A few countries always have an article. After <strong>aus</strong> that article changes.</p>`));

  const table = lessonPanel('The rule', 'Countries with an article',
    `<table class="conj-table country-table"><thead><tr><th>Country</th><th>Type</th><th>I come from …</th><th></th></tr></thead><tbody id="country-body"></tbody></table>
     <div class="g-note">Die Niederlande and die Vereinigten Arabischen Emirate are plural, so after aus they become <em class="de">aus den Niederlanden</em> and <em class="de">aus den … Emiraten</em>. (The unit PDF prints “aus der Niederlande”, which is a typo.)</div>`);
  const remember = lessonPanel('', 'Remember',
    `<div class="rule-cards">
       <div class="rule-card"><b>die → aus <mark>der</mark></b><span>feminine: die Schweiz, die Türkei</span></div>
       <div class="rule-card"><b>die → aus <mark>den</mark> (+n)</b><span>plural: die USA, die Niederlande</span></div>
       <div class="rule-card"><b>no article → aus</b><span>Deutschland, Äthiopien, Österreich …</span></div>
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
  const title = kind === 'present' ? 'Choose the right ending' : kind === 'countries' ? 'aus, aus der or aus den?' : GRAMMAR[currentScope].quiz.title;
  const box = lessonPanel('Exercise', title, '<div id="g-quiz"></div>');
  setTimeout(() => startGrammarQuiz(kind));
  return box;
}

function makeQuestions(kind) {
  if (kind === 'data') {
    return shuffle([...GRAMMAR[currentScope].quiz.items]).slice(0, GRAMMAR_QUIZ_SIZE).map(item => ({
      ...item, options: shuffle([...item.options]), label: o => o,
    }));
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
    before: 'Ich komme', after: ` ${c.rest}.`, hint: `I come from ${c.en}.`, answer: c.answer,
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
    <div class="q-head"><span>Question ${gQuiz.index + 1} of ${gQuiz.questions.length}</span><div class="bar"><i style="width:${Math.round(gQuiz.index / gQuiz.questions.length * 100)}%"></i></div></div>
    <div class="g-q-prompt view-enter"><span class="before"></span> <span class="blank">?</span><span class="after"></span></div>
    <div class="g-q-hint"></div>
    <div class="chip-row" id="g-options"></div>
    <div id="g-feedback" aria-live="polite"></div>
    <div class="actions" id="g-next" hidden><button class="btn btn-primary" type="button">${gQuiz.index + 1 < gQuiz.questions.length ? 'Next question' : 'See results'}</button></div>`;
  box.querySelector('.before').textContent = q.before;
  box.querySelector('.after').textContent = q.after;
  box.querySelector('.g-q-hint').textContent = q.hint;
  // Data lessons: the blank sits exactly where the item puts it (no extra space).
  if (gQuiz.kind === 'data' && q.type === 'gap') {
    const prompt = box.querySelector('.g-q-prompt');
    prompt.innerHTML = '<span class="before"></span><span class="blank">?</span><span class="after"></span>';
    prompt.querySelector('.before').textContent = q.before;
    prompt.querySelector('.after').textContent = q.after;
  }
  // "Which sentence is correct?" items show the meaning and whole sentences as choices.
  if (q.type === 'choose') {
    box.querySelector('.g-q-prompt').classList.add('choose');
    box.querySelector('.g-q-prompt').textContent = q.prompt;
    box.querySelector('.g-q-hint').textContent = q.hint || 'Choose the correct German sentence.';
    document.getElementById('g-options').classList.add('stack');
  }
  // For endings the blank sits right after the stem, with no space.
  if (gQuiz.kind === 'present') box.querySelector('.g-q-prompt').innerHTML = `<span></span><span class="blank">?</span>`;
  if (gQuiz.kind === 'present') box.querySelector('.g-q-prompt span').textContent = q.before;
  q.options.forEach(option => {
    const chip = el('button', 'chip', q.label(option));
    chip.type = 'button';
    chip.onclick = () => answerGrammar(option, chip);
    document.getElementById('g-options').appendChild(chip);
  });
  box.querySelector('#g-next button').onclick = () => { gQuiz.index++; showGrammarQuestion(); };
}

function answerGrammar(option, chip) {
  const q = gQuiz.questions[gQuiz.index];
  const right = option === q.answer;
  if (right) gQuiz.score++;
  document.querySelectorAll('#g-options .chip').forEach(c => {
    c.disabled = true;
    if (c.textContent === q.label(q.answer)) c.classList.add('correct');
  });
  if (!right) chip.classList.add('wrong');
  const blank = document.querySelector('#g-quiz .blank');
  if (blank) blank.textContent = q.answer;
  const fb = document.getElementById('g-feedback');
  fb.innerHTML = `<div class="alert ${right ? 'correct' : 'wrong'}"><span class="alert-icon">${icon(right ? 'check' : 'x')}</span>
    <span class="alert-title">${right ? 'Correct' : 'Not quite'}</span><span class="alert-answer"><small>Correct form</small><span></span></span><span class="alert-note"></span></div>`;
  fb.querySelector('.alert-answer span').textContent = q.say;
  fb.querySelector('.alert-note').textContent = gQuiz.kind === 'present'
    ? (right ? '' : explainEnding(q))
    : gQuiz.kind === 'countries'
    ? (q.answer === 'aus' ? 'No article: this country is used without one.' : q.answer === 'aus der' ? 'Feminine country: die → der after aus.' : 'Plural country: die → den after aus.')
    : (q.why || '');
  document.getElementById('g-next').hidden = false;
  document.querySelector('#g-next button').focus({ preventScroll: true });
  speak(q.say);
}

function explainEnding(q) {
  const who = q.before.split(' ')[0];
  if (who === 'du' && q.answer === 't') return 'The stem ends in ß, so du only adds -t.';
  return `${who} always takes -${q.answer}.`;
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
  const buttons = [['Try again', 'btn-primary', () => startGrammarQuiz(kind)], ['Back to the lesson', '', () => setGrammarView('lesson')]];
  if (other) buttons.push([`Next lesson: ${GRAMMAR[other].title}`, '', () => goTo({ scope: other })]);
  const panel = resultPanel({
    title: score >= GRAMMAR_PASS ? 'Well done!' : 'Keep practising',
    text: score >= GRAMMAR_PASS ? 'You have got this rule.' : `Score ${GRAMMAR_PASS} or more to complete the lesson.`,
    stats: [[`${score}/${questions.length}`, 'this round', score >= GRAMMAR_PASS ? 'good' : 'mid'], [`${best}/${questions.length}`, 'best score']],
    buttons,
  });
  panel.classList.remove('panel', 'narrow');
  box.appendChild(panel);
}

/* ---------------- Speak ---------------- */

// The coach matches the chosen voice: Selam (Katja) or Dawit (Conrad).
const COACH = { katja: { name: 'Selam', look: 'female' }, conrad: { name: 'Dawit', look: 'male' } };
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
  if (btn) btn.lastChild.textContent = `Say it with ${name}`;
}

function setPose(pose) {
  const coach = coachEl();
  coach.classList.remove('pose-ear', 'pose-cheer', 'happy');
  if (pose === 'ear') coach.classList.add('pose-ear');
  if (pose === 'cheer') coach.classList.add('pose-cheer', 'happy');
}

function setListening(on) {
  document.getElementById('coach-wrap').classList.toggle('listening', on);
  if (on) document.getElementById('sp-heard').innerHTML = '<span class="mic-meter"><b></b><b></b><b></b></span>Listening…';
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
    recognition: ['on', 'Checks your pronunciation', 'Your browser turns speech into text to compare it with the word. In Chrome this is processed by Google.'],
    voice: ['off', 'Hears when you speak', 'This browser cannot turn speech into text, so the coach only listens for your voice.'],
    manual: ['off', 'Microphone off: tap to confirm', 'Allow the microphone for this page to let the coach hear you.'],
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
  document.getElementById('sp-pos').textContent = `Word ${speakIndex + 1} of ${words.length}`;
  document.getElementById('sp-fill').style.width = Math.round((speakIndex + 1) / words.length * 100) + '%';
  document.getElementById('sp-word').textContent = item.german;
  document.getElementById('sp-meaning').textContent = item.english;
  document.getElementById('sp-heard').textContent = '';
  ['listen', 'say'].forEach(row => [0, 1, 2].forEach(i => markDot(row, i, '')));
  setPose('rest');
  bubble('Los geht’s!', `Hi, I'm ${COACH[currentVoice].name}. I'll say it three times, then it's your turn.`);
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
  if (state === 'idle') add(`${icon('mic')}Start`, 'btn-primary', startSpeakSession);
  if (state === 'running') add('Stop', 'btn-ghost', () => { stopSpeakSession(); bubble('Kein Problem.', 'Stopped. Press Start whenever you are ready.'); setPose('rest'); setSpeakActions('idle'); });
  if (state === 'done') {
    add('Say it again', '', startSpeakSession);
    const last = speakIndex >= learnSequence().length - 1;
    if (!last) add('Next word →', 'btn-primary', () => { speakIndex++; showSpeakWord(); startSpeakSession(); });
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
  bubble('Hör zu!', 'Listen carefully.');
  await coachSays('Hör zu!');
  for (let i = 0; i < SAY_TIMES; i++) {
    if (!alive()) return;
    markDot('listen', i, 'current');
    bubble(name, i === 1 ? 'Once more, slowly.' : `Listen · ${i + 1} of 3`);
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
    if (i === 0) { bubble('Jetzt du!', `Now you. Say “${name}” out loud.`); await coachSays('Jetzt du!'); }
    else if (lastMissed) bubble('Jetzt du!', `Your turn · ${i + 1} of 3`);
    else { bubble('Noch einmal!', `Once more · ${i + 1} of 3`); await coachSays('Noch einmal!'); }

    let result;
    for (let silent = 0; ; silent++) {
      if (!alive()) return;
      setPose('ear');
      setListening(micMode !== 'manual');
      if (micMode === 'manual') document.getElementById('sp-heard').textContent = 'Say it out loud, then tap “I said it”.';
      result = await listenForSpeech(name, alive);
      setListening(false);
      if (!alive()) return;
      if (result.spoke) break;
      setPose('rest');
      bubble('Ich höre nichts…', "I didn't hear you. Try again, a little louder.");
      document.getElementById('sp-heard').textContent = '';
      await wait(1400);
    }

    if (result.heard) document.getElementById('sp-heard').innerHTML = `I heard: <strong></strong>`;
    if (result.heard) document.querySelector('#sp-heard strong').textContent = `“${result.heard}”`;
    else document.getElementById('sp-heard').textContent = '';

    lastMissed = result.match === false;
    if (result.match === false) {
      checked++;
      markDot('say', i, 'try');
      setPose('rest');
      bubble('Fast! Noch einmal.', 'Almost! Listen once more and copy the sound.');
      await coachSays('Fast! Noch einmal.');
      if (!alive()) return;
      await coachSays(name);
    } else {
      if (result.match) { good++; checked++; }
      markDot('say', i, result.match ? 'good' : 'done');
      setPose('cheer');
      const praise = i % 2 ? 'Super!' : 'Sehr gut!';
      bubble(praise, result.match ? 'That sounded right!' : 'Well done!');
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
    ? `You said it three times. ${good} of ${checked} sounded right.`
    : 'You said it three times. Great practice!');
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
    b.innerHTML = `${icon('check')}I said it`;
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
    if (germanSeen.has(item.german) || englishSeen.has(item.english.toLowerCase())) continue;
    germanSeen.add(item.german);
    englishSeen.add(item.english.toLowerCase());
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
        <div class="mq-col" id="mq-de"><h3>German</h3></div>
        <div class="mq-col" id="mq-en"><h3>English</h3></div>
      </div>
    </div>`;
  const makeTile = (index, side, order) => {
    const tile = el('button', 'mq-tile', side === 'de' ? mqPairs[index].german : mqPairs[index].english);
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
  document.getElementById('mq-progress').textContent = `${mqMatched} of ${mqPairs.length} matched`;
  document.getElementById('mq-fill').style.width = Math.round(mqMatched / mqPairs.length * 100) + '%';
  document.getElementById('mq-mistakes').textContent = `${mqMistakes} mistake${mqMistakes === 1 ? '' : 's'}`;
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
  const title = mqMistakes === 0 ? 'Perfect match!' : score >= 75 ? 'Well done!' : 'Keep practising';
  mqPairs.forEach(item => learned.add(item.german));
  updateProgress();
  const area = document.getElementById('mq-area');
  area.innerHTML = '';
  area.appendChild(resultPanel({
    title,
    text: `You matched all ${mqPairs.length} pairs.`,
    stats: [[mqPairs.length, 'pairs matched', 'good'], [mqMistakes, 'mistakes', mqMistakes ? 'bad' : 'good'], [score + '%', 'accuracy']],
    buttons: [['Play again with new words', 'btn-primary', startMatchQuiz]],
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
  node.appendChild(el('span', 'fc-lang', german ? 'German' : 'English'));
  node.appendChild(el('div', 'fc-text', german ? card.item.german : card.item.english));
  if (german) node.appendChild(listenButton(card.item.german));
  node.appendChild(el('div', 'fc-hint', side === 'front'
    ? (card.dir === 'de-en' ? 'What does it mean? Tap the card to check.' : 'Say it in German, then tap the card.')
    : 'Did you know it?'));
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
      <div class="fc-progress"><span>${done} of ${fcTotal}</span><div class="bar"><i style="width:${Math.round(done / fcTotal * 100)}%"></i></div><span>${card.dir === 'de-en' ? 'German → English' : 'English → German'}</span></div>
      <div class="fc-scene"><div class="fc-card" onclick="flipCard()"></div></div>
      <div class="actions center">
        <button class="btn btn-danger" onclick="answerCard(false)" disabled>${icon('x')}Still learning</button>
        <button class="btn btn-primary fc-flip" onclick="flipCard()">Show answer</button>
        <button class="btn btn-success" onclick="answerCard(true)" disabled>${icon('check')}I knew it</button>
      </div>
      <div class="kbd-hint"><kbd>Space</kbd> flip · <kbd>←</kbd> still learning · <kbd>→</kbd> knew it</div>
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
  document.querySelector('#fc-area .fc-flip').textContent = fcFlipped ? 'Show question' : 'Show answer';
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
  const buttons = [['Start again', 'btn-primary', () => startFlashcards()]];
  if (fcMissed.size) buttons.push([`Review ${fcMissed.size} missed`, '', () => startFlashcards([...fcMissed.values()])]);
  area.appendChild(resultPanel({
    title: 'Deck complete',
    text: `You went through all ${fcTotal} cards.`,
    stats: [[fcFirstTry, 'known first try', 'good'], [fcMissed.size, 'to review', fcMissed.size ? 'mid' : 'good']],
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
  try {
    const res = await fetch(`${AI_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    const { models } = await res.json();
    aiReady = models.some(m => m.name === AI_MODEL || m.model === AI_MODEL);
  } catch (e) {
    aiReady = false;
  }
  badge.className = 'badge ' + (aiReady ? 'on' : 'off');
  badge.querySelector('span:last-child').textContent = aiReady ? 'AI checking on' : 'Spelling check only';
  badge.title = aiReady
    ? `Answers in your own words are judged by ${AI_MODEL}, running privately on this Mac.`
    : 'Start Ollama (brew services start ollama) and reload to turn on AI checking.';
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
      <div class="q-head"><span>Question ${prIndex + 1} of ${prQueue.length}</span><div class="bar"><i style="width:${Math.round(prIndex / prQueue.length * 100)}%"></i></div></div>
      <p class="q-label">Translate from ${toGerman ? 'English' : 'German'}</p>
      <div class="q-prompt"><span class="q-text"></span></div>
      <label class="field-label" for="pr-input">Your ${toGerman ? 'German' : 'English'} translation</label>
      <input class="input" id="pr-input" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="Type your answer…" lang="${toGerman ? 'de' : 'en'}">
      ${toGerman ? '<div class="keys" aria-label="German letters">' + ['ä', 'ö', 'ü', 'ß'].map(c => `<button type="button" data-char="${c}" aria-label="Insert ${c}">${c}</button>`).join('') + '</div>' : ''}
      <div id="pr-feedback" aria-live="polite"></div>
      <div class="actions">
        <button class="btn btn-ghost" id="pr-skip" type="button">I don't know</button>
        <button class="btn btn-primary" id="pr-check" type="button">Check answer</button>
      </div>
    </div>`;
  area.querySelector('.q-text').textContent = toGerman ? item.english : item.german;
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

function normalizeAnswer(text) {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[…."!?¿¡,;:„“”]/g, ' ')
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
      if (foldUmlauts(given) === foldUmlauts(target)) return { verdict: 'correct', note: 'ae/oe/ue/ss works, but try the ä ö ü ß keys.' };
      if (stripUmlauts(given) === stripUmlauts(target)) return { verdict: 'almost', note: 'Watch the umlauts (ä, ö, ü) and ß.' };
      if (germanArticle.test(target)) {
        const noun = target.replace(germanArticle, '');
        const article = target.split(' ')[0];
        if (given === noun) return { verdict: 'almost', note: `Don't forget the article: ${article}.` };
        if (germanArticle.test(given) && given.replace(germanArticle, '') === noun) return { verdict: 'almost', note: `Wrong article. This noun takes ${article}.` };
      }
    }
    const allowed = target.length <= 5 ? 1 : 2;
    if (editDistance(foldUmlauts(given), foldUmlauts(target)) <= allowed) return { verdict: 'almost', note: 'Nearly! Check the spelling.' };
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
  const expected = toGerman ? item.german : item.english;
  const feedback = document.getElementById('pr-feedback');
  const checkBtn = document.getElementById('pr-check');
  prPending = true;
  input.readOnly = true;
  document.getElementById('pr-skip').style.display = 'none';
  checkBtn.disabled = true;

  let result = localCheck(answer, expected, toGerman);
  if (result.verdict === 'wrong' && answer && aiReady) {
    feedback.innerHTML = '<div class="alert pending"><span><span class="spinner" aria-hidden="true"></span>Your wording is different, so the AI is checking the meaning…</span></div>';
    try {
      result = await aiCheck(item, answer, toGerman);
    } catch (e) {
      result.note = 'The AI checker did not respond, so only exact and near-exact answers count.';
    }
  }
  if (skip) result.note = 'No problem. This one will come up again.';

  const label = { correct: 'Correct', almost: 'Almost there', wrong: skip ? 'Here is the answer' : 'Not quite' }[result.verdict];
  const mark = { correct: 'check', almost: 'dash', wrong: 'x' }[result.verdict];
  feedback.innerHTML = `
    <div class="alert ${result.verdict}">
      <span class="alert-icon">${icon(mark)}</span>
      <span class="alert-title">${label}</span>
      <span class="alert-answer"><small>Correct answer</small><span id="pr-answer"></span></span>
      <span class="alert-note" id="pr-note"></span>
    </div>`;
  document.getElementById('pr-answer').textContent = expected;
  document.getElementById('pr-note').textContent = (result.note || '') + (result.byAI ? ' · Checked by AI' : '');
  if (toGerman) speak(item.german);

  prPending = false;
  prResults.push({ item, answer, verdict: result.verdict });
  if (result.verdict === 'correct') {
    learned.add(item.german);
    updateProgress();
  }
  checkBtn.disabled = false;
  checkBtn.textContent = prIndex + 1 < prQueue.length ? 'Next question' : 'See results';
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
  const buttons = [['Next 10 words', 'btn-primary', () => startPractice()]];
  if (toReview.length) buttons.push([`Practise ${toReview.length} again`, '', () => startPractice(shuffle(toReview))]);
  area.appendChild(resultPanel({
    title: 'Practice complete',
    text: `You answered ${prResults.length} question${prResults.length === 1 ? '' : 's'}.`,
    stats: [[count('correct'), 'correct', 'good'], [count('almost'), 'almost', 'mid'], [count('wrong'), 'to learn', 'bad']],
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
  setSpeed(store.get('book-pace', 'normal'));
  document.getElementById('usage-toggle').checked = usage.enabled;
  renderAds();
  loadAccount().then(openAccountFromLink);
  renderUnits();
  updateProgress();
  renderPage();
})();
