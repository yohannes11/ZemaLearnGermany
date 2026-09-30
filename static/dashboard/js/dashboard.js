const PERIOD_WORDS = {
  day: { unit: 'day', current: 'Today', previous: 'yesterday', per: 'per day', range: 'last 30 days' },
  week: { unit: 'week', current: 'This week', previous: 'last week', per: 'per week', range: 'last 12 weeks' },
  month: { unit: 'month', current: 'This month', previous: 'last month', per: 'per month', range: 'last 12 months' },
  year: { unit: 'year', current: 'This year', previous: 'last year', per: 'per year', range: 'last 5 years' },
};
const METRICS = {
  users: 'Active users', new_users: 'New visitors', signups: 'Sign-ups', sessions: 'Visits', minutes: 'Study minutes',
};
const MODE_NAMES = { learn: 'Learn', speak: 'Speak', practice: 'Practice', flashcards: 'Flashcards', match: 'Match', grammar: 'Grammar' };

const saved = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

// Follow the course's own light/dark setting.
try { if (JSON.parse(localStorage.getItem('app-theme')) === 'dark') document.documentElement.dataset.theme = 'dark'; } catch (e) {}

let period = saved('stats-period', 'day');
let metric = saved('stats-metric', 'users');
let data = null;

const fmt = n => n.toLocaleString();
const minutes = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
const shortLabel = (start, p) => {
  const d = new Date(start + 'T00:00');
  if (p === 'day') return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (p === 'week') return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (p === 'month') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  return String(d.getFullYear());
};

function setActive(groupId, attr, value) {
  document.querySelectorAll(`#${groupId} button`).forEach(b => {
    const on = b.dataset[attr] === value;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
}

async function load() {
  try {
    const res = await fetch(`${URLS.stats}?period=${period}`, { cache: 'no-store', credentials: 'same-origin' });
    if (res.status === 401 || res.status === 403) return location.reload();
    if (!res.ok) throw new Error(`The server answered ${res.status}.`);
    data = await res.json();
    document.getElementById('error').hidden = true;
    render();
  } catch (err) {
    showError(err instanceof TypeError || /JSON/.test(err.message)
      ? 'Could not reach the server. Start the course with "python3 server.py".'
      : err.message);
  }
}

function showError(text) {
  const box = document.getElementById('error');
  box.hidden = !text;
  box.textContent = text || '';
}

function render() {
  const w = PERIOD_WORDS[period];
  setActive('periods', 'period', period);
  setActive('metrics', 'metric', metric);
  document.getElementById('csv').href = `${URLS.statsCsv}?period=${period}`;
  document.getElementById('csv').setAttribute('download', `usage-${period}.csv`);
  document.getElementById('updated').textContent = `updated ${new Date(data.generated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  renderTiles(w);
  renderChart(w);
  renderBars('modes', Object.entries(data.modes).map(([k, v]) => [MODE_NAMES[k] || k, v]));
  renderBars('units', Object.entries(data.units).map(([k, v]) => [`Unit ${k}`, v]), true);
  renderBars('devices', Object.entries(data.devices).map(([k, v]) => [k === 'phone' ? 'Phone / tablet' : 'Computer', v]));
  renderTable(w);
}

function delta(now, before, label) {
  if (!before && !now) return `No change from ${label}`;
  if (!before) return `<b class="up">▲ new</b> vs ${label}`;
  const pct = Math.round((now - before) / before * 100);
  if (pct === 0) return `Same as ${label}`;
  return `<b class="${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%</b> vs ${label} (${fmt(before)})`;
}

function renderTiles(w) {
  const s = data.series;
  const cur = s[s.length - 1];
  const prev = s[s.length - 2] || { users: 0, new_users: 0, sessions: 0, minutes: 0 };
  const tiles = [
    [`${w.current} · active users`, fmt(cur.users), delta(cur.users, prev.users, w.previous)],
    [`${w.current} · new visitors`, fmt(cur.new_users), delta(cur.new_users, prev.new_users, w.previous)],
    [`${w.current} · visits`, fmt(cur.sessions), delta(cur.sessions, prev.sessions, w.previous)],
    [`${w.current} · study time`, minutes(cur.minutes), delta(cur.minutes, prev.minutes, w.previous)],
    [`${w.current} · sign-ups`, fmt(cur.signups), `${fmt(data.accounts)} account${data.accounts === 1 ? '' : 's'} in total`],
    ['All-time visitors', fmt(data.total_users), `${fmt(data.range_users)} in the ${w.range} · ${minutes(data.total_minutes)} studied in total`],
  ];
  document.getElementById('tiles').innerHTML = tiles.map(([k, v, d]) =>
    `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
}

function renderChart(w) {
  const box = document.getElementById('chart');
  const tip = document.getElementById('tip');
  box.querySelector('svg')?.remove();
  document.getElementById('chart-title').textContent = `${METRICS[metric]} ${w.per}`;
  const total = data.series.reduce((a, r) => a + r[metric], 0);
  document.getElementById('chart-sub').textContent = metric === 'users'
    ? `Each learner counts once per ${w.unit} · ${w.range}`
    : `${metric === 'minutes' ? minutes(total) : fmt(total)} in the ${w.range}`;

  const rows = data.series;
  const W = box.clientWidth, H = box.clientHeight;
  const pad = { l: 34, r: 4, t: 18, b: 26 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = Math.max(...rows.map(r => r[metric]));
  const niceMax = max <= 4 ? 4 : (() => { const p = 10 ** Math.floor(Math.log10(max)); const m = max / p; return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
  const ticks = 4;
  const slot = iw / rows.length;
  const bw = Math.max(2, Math.min(48, slot - 2));
  const y = v => pad.t + ih - (v / niceMax) * ih;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${METRICS[metric]} ${w.per}, ${w.range}. The table below lists every value.`);
  const add = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text !== undefined) n.textContent = text;
    svg.appendChild(n);
    return n;
  };
  for (let i = 0; i <= ticks; i++) {
    const v = niceMax / ticks * i;
    add('line', { class: 'gridline', x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) });
    add('text', { class: 'axis-label', x: pad.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, metric === 'minutes' && v >= 60 && niceMax >= 120 ? `${Math.round(v / 60)}h` : fmt(Math.round(v * 10) / 10));
  }
  const every = Math.ceil(rows.length / Math.max(1, Math.floor(iw / 64)));
  let peak = -1;
  rows.forEach((r, i) => { if (r[metric] === max && max > 0) peak = i; });
  rows.forEach((r, i) => {
    const v = r[metric];
    const x = pad.l + slot * i + (slot - bw) / 2;
    const top = y(v);
    const h = pad.t + ih - top;
    const hit = add('rect', { class: 'hit', x: pad.l + slot * i, y: pad.t, width: slot, height: ih });
    if (h > 0) {
      const rr = Math.min(4, bw / 2, h);
      add('path', { class: 'bar', d: `M${x},${top + h}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + bw - rr}Q${x + bw},${top} ${x + bw},${top + rr}V${top + h}Z` });
    } else {
      add('rect', { class: 'bar', x, y: top - 1, width: bw, height: 1, opacity: 0.35 });
    }
    if (i === peak || i === rows.length - 1 && v > 0) {
      add('text', { class: 'value-label', x: x + bw / 2, y: top - 6, 'text-anchor': 'middle' }, metric === 'minutes' ? minutes(v) : fmt(v));
    }
    if ((rows.length - 1 - i) % every === 0) {
      add('text', { class: 'axis-label', x: pad.l + slot * i + slot / 2, y: H - 6, 'text-anchor': 'middle' }, shortLabel(r.start, period));
    }
    const show = () => {
      tip.innerHTML = `${r.label}<br><b>${metric === 'minutes' ? minutes(v) : fmt(v)}</b> ${METRICS[metric].toLowerCase()}`
        + (metric === 'users' ? ` · ${fmt(r.new_users)} new, ${fmt(r.returning_users)} returning` : '');
      tip.style.left = `${Math.min(Math.max(pad.l + slot * i + slot / 2, 90), W - 90)}px`;
      tip.style.top = `${Math.max(top, pad.t + 30)}px`;
      tip.style.opacity = 1;
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerleave', () => { tip.style.opacity = 0; });
  });
  add('line', { class: 'gridline', x1: pad.l, x2: W - pad.r, y1: pad.t + ih, y2: pad.t + ih, style: 'stroke:var(--subtle)' });
  box.appendChild(svg);
}

function renderBars(id, entries, keepOrder = false) {
  const box = document.getElementById(id);
  if (!entries.length) { box.innerHTML = '<p class="none">No activity in this range yet.</p>'; return; }
  if (!keepOrder) entries.sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(e => e[1]));
  box.innerHTML = entries.map(([name, v]) =>
    `<div class="hbar" title="${name}: ${v} learner${v === 1 ? '' : 's'}"><span class="name">${name}</span><span class="track"><span class="fill" style="width:${v / max * 100}%;display:block"></span></span><span class="num">${fmt(v)}</span></div>`).join('');
}

function renderTable(w) {
  document.getElementById('table-title').textContent = `Report ${w.per} · ${w.range}`;
  const cols = [['label', PERIOD_WORDS[period].unit[0].toUpperCase() + PERIOD_WORDS[period].unit.slice(1)], ['users', 'Active users'], ['new_users', 'New visitors'], ['returning_users', 'Returning'], ['signups', 'Sign-ups'], ['sessions', 'Visits'], ['minutes', 'Study time'], ['grammar_quizzes', 'Grammar quizzes']];
  const rows = [...data.series].reverse();
  const cell = (r, k) => k === 'label' ? `<td>${r.label}</td>` : `<td class="${r[k] ? '' : 'zero'}">${k === 'minutes' ? minutes(r[k]) : fmt(r[k])}</td>`;
  document.getElementById('table').innerHTML =
    `<thead><tr>${cols.map(c => `<th scope="col">${c[1]}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map(r => `<tr>${cols.map(c => cell(r, c[0])).join('')}</tr>`).join('')}</tbody>`;
}

document.getElementById('periods').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  period = b.dataset.period; save('stats-period', period); load();
});
document.getElementById('metrics').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !data) return;
  metric = b.dataset.metric; save('stats-metric', metric); render();
});
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => data && renderChart(PERIOD_WORDS[period]), 120); });
setInterval(() => { if (tab === 'report') load(); }, 60 * 1000);
  
/* ---------------- Access ---------------- */

// URLs come from Django (see templates/analytics/dashboard.html); the page itself is staff-only.
const URLS = JSON.parse(document.getElementById('dashboard-urls').textContent);
let tab = saved('admin-tab', 'report');

function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  // Signed out or no longer an admin: reloading lets Django send the visitor to the login page.
  if (res.status === 401 || res.status === 403) { location.reload(); throw new Error('Please sign in again.'); }
  let json = {};
  try { json = await res.json(); } catch (e) {}
  if (!res.ok) { const err = new Error(json.error || `The server answered ${res.status}.`); err.status = res.status; throw err; }
  return json;
}

function showTab(name) {
  tab = name;
  save('admin-tab', name);
  document.querySelectorAll('.admin-tabs button').forEach(b => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  document.getElementById('report-view').hidden = name !== 'report';
  document.getElementById('users-view').hidden = name !== 'users';
  showError('');
  if (name === 'report') load(); else loadUsers();
}
document.querySelector('.admin-tabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) showTab(b.dataset.tab);
});

/* ---------------- Users ---------------- */

let users = [];
let myId = null;
let searchTimer;

const when = ts => {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days < 1 && new Date().toDateString() === d.toDateString()) return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (days < 2) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function loadUsers() {
  try {
    const q = document.getElementById('user-search').value;
    const res = await api(`${URLS.users}?q=${encodeURIComponent(q)}`);
    users = res.users;
    myId = res.me;
    renderUsers(!q);
  } catch (err) {
    showError(err.message);
  }
}

function renderUsers(updateTiles) {
  if (updateTiles) {
    const week = Date.now() / 1000 - 7 * 86400;
    const tiles = [
      ['Accounts', fmt(users.length), `${fmt(users.filter(u => u.status === 'disabled').length)} disabled`],
      ['New this week', fmt(users.filter(u => u.created >= week).length), 'Accounts created in the last 7 days'],
      ['Active this week', fmt(users.filter(u => u.last_active >= week).length), 'Signed-in learners who studied'],
      ['Admins', fmt(users.filter(u => u.role === 'admin').length), 'Can see this page'],
    ];
    document.getElementById('user-tiles').innerHTML = tiles.map(([k, v, d]) =>
      `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
  }
  const table = document.getElementById('users-table');
  if (!users.length) {
    table.innerHTML = `<tbody><tr><td class="zero" style="text-align:center;padding:28px">${document.getElementById('user-search').value ? 'No accounts match that search.' : 'No accounts yet. Learners can create one with the Sign in button in the course.'}</td></tr></tbody>`;
    return;
  }
  table.innerHTML = `<thead><tr><th scope="col">Learner</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col">Last active</th><th scope="col">Words</th><th scope="col">Lessons</th><th scope="col">Study time</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>` +
    users.map(u => {
      const self = u.id === myId;
      const options = [
        u.role === 'admin' ? ['make_learner', 'Remove admin rights'] : ['make_admin', 'Make admin'],
        u.status === 'active' ? ['disable', 'Disable account'] : ['enable', 'Enable account'],
        ['reset_password', 'Reset password'],
        ['delete', 'Delete account'],
      ].filter(([a]) => !(self && ['make_learner', 'disable', 'delete'].includes(a)));
      return `<tr>
        <td><div class="user-cell"><span class="avatar${u.status === 'disabled' ? ' off' : ''}">${esc(u.name.trim()[0].toUpperCase())}</span><div style="min-width:0"><b>${esc(u.name)}</b>${self ? ' <span class="you">(you)</span>' : ''}<small>@${esc(u.username)} · ${esc(u.email)}</small></div></div></td>
        <td data-label="Role">${u.role === 'admin' ? '<span class="badge admin">Admin</span>' : '<span class="badge">Learner</span>'}${u.status === 'disabled' ? ' <span class="badge disabled">Disabled</span>' : ''}</td>
        <td data-label="Joined">${when(u.created)}</td>
        <td data-label="Last active">${when(u.last_active)}</td>
        <td data-label="Words" class="${u.words ? '' : 'zero'}">${fmt(u.words)}</td>
        <td data-label="Lessons" class="${u.lessons ? '' : 'zero'}">${fmt(u.lessons)}</td>
        <td data-label="Study time" class="${u.minutes ? '' : 'zero'}">${minutes(u.minutes)}</td>
        <td class="actions-cell"><select class="actions-select" data-id="${u.id}" aria-label="Actions for ${esc(u.name)}"><option value="">Manage…</option>${options.map(([a, l]) => `<option value="${a}">${l}</option>`).join('')}</select></td>
      </tr>`;
    }).join('') + '</tbody>';
}

function notice(html, bad = false) {
  const box = document.getElementById('user-notice');
  box.innerHTML = html ? `<div class="notice${bad ? ' bad' : ''}" role="status">${html}<button class="btn x" type="button" onclick="notice('')">Dismiss</button></div>` : '';
}

document.getElementById('users-table').addEventListener('change', async e => {
  const select = e.target.closest('.actions-select');
  if (!select || !select.value) return;
  const action = select.value;
  select.value = '';
  const u = users.find(x => x.id === Number(select.dataset.id));
  const confirmText = {
    delete: `Delete the account of ${u.name} (@${u.username}, ${u.email})? Their saved progress is removed for good. Usage statistics stay, anonymously.`,
    disable: `Disable ${u.name}? They are signed out and cannot sign in until you enable the account again.`,
    reset_password: `Reset the password of ${u.name}? They are signed out, and you get a temporary password to give them.`,
    make_admin: `Make ${u.name} an admin? Admins can see the usage report and manage all users.`,
    make_learner: `Remove admin rights from ${u.name}?`,
  }[action];
  if (confirmText && !confirm(confirmText)) return;
  try {
    const res = await api(URLS.userAction.replace('/0/', `/${u.id}/`), 'POST', { action });
    if (action === 'reset_password') {
      notice(`Temporary password for <b>${esc(u.name)}</b>: <code>${esc(res.temporary_password)}</code> Give it to them privately; they can change it under Account → Change password.`);
    } else {
      notice({ delete: `The account of <b>${esc(u.name)}</b> was deleted.`, disable: `<b>${esc(u.name)}</b> is now disabled.`, enable: `<b>${esc(u.name)}</b> can sign in again.`, make_admin: `<b>${esc(u.name)}</b> is now an admin.`, make_learner: `<b>${esc(u.name)}</b> is no longer an admin.` }[action]);
    }
    loadUsers();
  } catch (err) {
    notice(esc(err.message), true);
  }
});

document.getElementById('user-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadUsers, 250);
});

showTab(tab);
