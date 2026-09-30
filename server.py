"""Serve the German A1 course with learner accounts, anonymous usage statistics and an admin area.

Run:     python3 server.py [port]        course at http://localhost:8000/german-a1-course.html
Admin:   http://localhost:8000/admin.html  (the first visit from this computer creates the admin account)
Forgot the admin password?   python3 server.py set-password you@example.com
On a server (behind nginx):   python3 server.py create-admin you@example.com "Your Name"

Everything is kept in usage.db (SQLite). Passwords are stored as PBKDF2 hashes; sessions are random
tokens in an HttpOnly cookie. Usage events carry a random browser id and, for signed-in learners, the
account id — never an IP address. Standard library only.
"""
import csv
import getpass
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import sqlite3
import sys
import threading
import time
from datetime import date, datetime, timedelta
from functools import partial
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get('USAGE_DB', ROOT / 'usage.db'))

EVENT_TYPES = {'session', 'view', 'active', 'grammar'}
MODES = {'learn', 'speak', 'practice', 'flashcards', 'match', 'grammar'}
ID_RE = re.compile(r'^[A-Za-z0-9-]{8,64}$')
EMAIL_RE = re.compile(r'^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$')
PERIODS = {'day': 30, 'week': 12, 'month': 12, 'year': 5}  # period -> buckets shown

COOKIE = 'a1_session'
SESSION_DAYS = 30
PBKDF2_ROUNDS = 390_000
LOGIN_LIMIT = (10, 15 * 60)  # failed attempts per address, window in seconds

# Only these files are served; everything else in the folder (database, tools, Django app) stays private.
PUBLIC_FILES = {'german-a1-course.html', 'admin.html', 'course-data.js', 'ads-config.js', 'ads.txt', 'favicon.ico'}
PUBLIC_DIRS = ('audio/',)

db_lock = threading.Lock()
failed_logins = {}


# ---------------------------------------------------------------- database

def connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        ts INTEGER NOT NULL,          -- unix seconds (server clock)
        uid TEXT NOT NULL,            -- random id stored in the learner's browser
        sid TEXT NOT NULL,            -- one visit; a new one starts after 30 idle minutes
        type TEXT NOT NULL,           -- session | view | active | grammar
        unit INTEGER, mode TEXT, scope TEXT, value INTEGER,
        device TEXT                   -- phone | desktop
    );
    CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
    CREATE INDEX IF NOT EXISTS events_uid ON events (uid, ts);
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'learner',     -- learner | admin
        status TEXT NOT NULL DEFAULT 'active',    -- active | disabled
        created INTEGER NOT NULL,
        last_login INTEGER,
        progress TEXT,                            -- JSON: {learned: [...], grammar: {...}}
        progress_updated INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,                   -- sha256 of the cookie value
        user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created INTEGER NOT NULL,
        expires INTEGER NOT NULL
    );
    """)
    if 'user_id' not in [r['name'] for r in conn.execute('PRAGMA table_info(events)')]:
        conn.execute('ALTER TABLE events ADD COLUMN user_id INTEGER')
    conn.execute('CREATE INDEX IF NOT EXISTS events_user ON events (user_id, ts)')
    conn.execute('PRAGMA foreign_keys = ON')
    conn.commit()
    return conn


conn = connect()


def query(sql, args=(), one=False):
    with db_lock:
        cur = conn.execute(sql, args)
        rows = cur.fetchall()
    return (rows[0] if rows else None) if one else rows


def execute(sql, args=()):
    with db_lock:
        cur = conn.execute(sql, args)
        conn.commit()
        return cur


# ---------------------------------------------------------------- accounts

def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, PBKDF2_ROUNDS)
    return f'pbkdf2_sha256${PBKDF2_ROUNDS}${salt.hex()}${digest.hex()}'


def check_password(password, stored):
    try:
        _, rounds, salt, digest = stored.split('$')
        test = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(test.hex(), digest)
    except (ValueError, AttributeError):
        return False


def validate_account(email, name, password):
    if not isinstance(email, str) or not EMAIL_RE.match(email.strip()):
        return 'Please enter a valid email address.'
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 60:
        return 'Please enter your name (up to 60 characters).'
    return validate_password(password)


def validate_password(password):
    if not isinstance(password, str) or not 8 <= len(password) <= 200:
        return 'The password needs at least 8 characters.'
    return None


def public_user(row):
    return {'id': row['id'], 'email': row['email'], 'name': row['name'], 'role': row['role']}


def new_session(user_id):
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    execute('INSERT INTO sessions (token, user_id, created, expires) VALUES (?,?,?,?)',
            (hashlib.sha256(token.encode()).hexdigest(), user_id, now, now + SESSION_DAYS * 86400))
    execute('UPDATE users SET last_login = ? WHERE id = ?', (now, user_id))
    execute('DELETE FROM sessions WHERE expires < ?', (now,))
    return token


def active_admins():
    return query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'", one=True)['n']


def merge_progress(old, new):
    """Combine two progress snapshots so nothing learned on any device is lost."""
    old, new = old or {}, new or {}
    # "replace" comes from a device that is already in sync, so words it un-marked stay un-marked.
    kept = [] if new.get('replace') else (old.get('learned') or [])
    learned = list(dict.fromkeys([*kept, *(new.get('learned') or [])]))
    grammar = dict(old.get('grammar') or {})
    for key, score in (new.get('grammar') or {}).items():
        if isinstance(score, int):
            grammar[key] = max(score, grammar.get(key, 0))
    return {'learned': [w for w in learned if isinstance(w, str)][:5000], 'grammar': grammar}


# ---------------------------------------------------------------- usage events

def clean_event(raw, user_agent, user_id):
    uid, sid, kind = raw.get('uid'), raw.get('sid'), raw.get('type')
    if not (isinstance(uid, str) and ID_RE.match(uid) and isinstance(sid, str) and ID_RE.match(sid)):
        return None
    if kind not in EVENT_TYPES:
        return None
    unit = raw.get('unit')
    unit = unit if isinstance(unit, int) and 1 <= unit <= 20 else None
    mode = raw.get('mode') if raw.get('mode') in MODES else None
    scope = raw.get('scope')
    scope = scope[:60] if isinstance(scope, str) else None
    value = raw.get('value')
    value = value if isinstance(value, int) and 0 <= value <= 1000 else None
    device = 'phone' if re.search(r'Mobi|Android|iPhone|iPad', user_agent or '') else 'desktop'
    return (int(time.time()), uid, sid, kind, unit, mode, scope, value, device, user_id)


# ---------------------------------------------------------------- reporting

def bucket_start(d, period):
    if period == 'day':
        return d
    if period == 'week':
        return d - timedelta(days=d.weekday())  # Monday
    if period == 'month':
        return d.replace(day=1)
    return d.replace(month=1, day=1)


def step_back(d, period):
    if period == 'day':
        return d - timedelta(days=1)
    if period == 'week':
        return d - timedelta(days=7)
    if period == 'month':
        return (d - timedelta(days=1)).replace(day=1)
    return d.replace(year=d.year - 1)


def bucket_label(d, period):
    if period == 'day':
        return d.strftime('%a %d %b %Y')
    if period == 'week':
        return f"Week of {d.strftime('%d %b %Y')}"
    if period == 'month':
        return d.strftime('%B %Y')
    return str(d.year)


def stats(period):
    count = PERIODS[period]
    starts = [bucket_start(date.today(), period)]
    for _ in range(count - 1):
        starts.append(step_back(starts[-1], period))
    starts.reverse()
    since = int(time.mktime(starts[0].timetuple()))

    rows = query('SELECT ts, uid, sid, type, unit, mode, device FROM events WHERE ts >= ?', (since,))
    first_seen = {r['uid']: r['first'] for r in query('SELECT uid, MIN(ts) AS first FROM events GROUP BY uid')}
    total_minutes = query("SELECT COUNT(*) AS n FROM events WHERE type = 'active'", one=True)['n']
    accounts = query('SELECT created, role, status FROM users')

    def key(ts):
        return bucket_start(datetime.fromtimestamp(ts).date(), period)

    buckets = {s: {'users': set(), 'sessions': set(), 'minutes': 0, 'lessons': 0} for s in starts}
    new_users = dict.fromkeys(starts, 0)
    signups = dict.fromkeys(starts, 0)
    for ts in first_seen.values():
        if key(ts) in new_users:
            new_users[key(ts)] += 1
    for a in accounts:
        if key(a['created']) in signups:
            signups[key(a['created'])] += 1

    modes, units, devices = {}, {}, {}
    for r in rows:
        b = buckets.get(key(r['ts']))
        if b is None:
            continue
        b['users'].add(r['uid'])
        b['sessions'].add(r['sid'])
        if r['type'] == 'active':
            b['minutes'] += 1
        if r['type'] == 'grammar':
            b['lessons'] += 1
        if r['type'] == 'view' and r['mode']:
            modes.setdefault(r['mode'], set()).add(r['uid'])
        if r['type'] == 'view' and r['unit']:
            units.setdefault(r['unit'], set()).add(r['uid'])
        devices.setdefault(r['device'] or 'desktop', set()).add(r['uid'])

    series = []
    for s in starts:
        b = buckets[s]
        series.append({
            'start': s.isoformat(),
            'label': bucket_label(s, period),
            'users': len(b['users']),
            'new_users': new_users[s],
            'returning_users': len(b['users']) - min(new_users[s], len(b['users'])),
            'sessions': len(b['sessions']),
            'minutes': b['minutes'],
            'grammar_quizzes': b['lessons'],
            'signups': signups[s],
        })

    return {
        'period': period,
        'generated': datetime.now().isoformat(timespec='seconds'),
        'total_users': len(first_seen),
        'total_minutes': total_minutes,
        'range_users': len(set().union(*(b['users'] for b in buckets.values()))),
        'accounts': len(accounts),
        'series': series,
        'modes': {m: len(u) for m, u in modes.items()},
        'units': {str(n): len(u) for n, u in sorted(units.items())},
        'devices': {d: len(u) for d, u in devices.items()},
    }


def stats_csv(period):
    out = io.StringIO()
    fields = ['start', 'label', 'users', 'new_users', 'returning_users', 'sessions', 'minutes', 'grammar_quizzes', 'signups']
    writer = csv.DictWriter(out, fieldnames=fields)
    writer.writeheader()
    writer.writerows(stats(period)['series'])
    return out.getvalue()


def list_users(search):
    like = f'%{search.strip()}%' if search else '%'
    rows = query("""
        SELECT u.*, (SELECT COUNT(*) FROM events e WHERE e.user_id = u.id AND e.type = 'active') AS minutes,
               (SELECT MAX(ts) FROM events e WHERE e.user_id = u.id) AS last_active
        FROM users u WHERE u.email LIKE ? OR u.name LIKE ? ORDER BY u.created DESC LIMIT 500""", (like, like))
    users = []
    for r in rows:
        progress = json.loads(r['progress']) if r['progress'] else {}
        users.append({
            'id': r['id'], 'email': r['email'], 'name': r['name'], 'role': r['role'], 'status': r['status'],
            'created': r['created'], 'last_login': r['last_login'],
            'last_active': max(filter(None, [r['last_active'], r['last_login']]), default=None),
            'minutes': r['minutes'],
            'words': len(progress.get('learned') or []),
            'lessons': sum(1 for s in (progress.get('grammar') or {}).values() if isinstance(s, int) and s >= 6),
        })
    return users


# ---------------------------------------------------------------- HTTP

class Handler(SimpleHTTPRequestHandler):
    # --- helpers
    def from_loopback(self):
        return self.client_address[0] in ('127.0.0.1', '::1', '::ffff:127.0.0.1')

    def is_local(self):
        # Behind nginx every request arrives from 127.0.0.1, so a forwarded visitor address means "not local".
        return self.from_loopback() and not self.headers.get('X-Real-IP') and not self.headers.get('X-Forwarded-For')

    def client_ip(self):
        forwarded = self.headers.get('X-Real-IP')
        return forwarded if forwarded and self.from_loopback() else self.client_address[0]

    def send_json(self, status, payload=None, cookie=None):
        body = json.dumps(payload if payload is not None else {}).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        if cookie is not None:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, status, text, ctype='text/plain; charset=utf-8', extra=None):
        body = text.encode()
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def session_cookie(self, token, max_age):
        secure = '; Secure' if self.headers.get('X-Forwarded-Proto') == 'https' else ''
        return f'{COOKIE}={token}; Path=/; Max-Age={max_age}; HttpOnly; SameSite=Lax{secure}'

    def read_json(self, limit=4096):
        length = int(self.headers.get('Content-Length') or 0)
        if not 0 < length <= limit:
            return None
        try:
            data = json.loads(self.rfile.read(length))
        except ValueError:
            return None
        return data if isinstance(data, dict) else None

    def current_user(self):
        cookie = SimpleCookie(self.headers.get('Cookie') or '')
        if COOKIE not in cookie:
            return None
        token = hashlib.sha256(cookie[COOKIE].value.encode()).hexdigest()
        return query("""SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                        WHERE s.token = ? AND s.expires > ? AND u.status = 'active'""", (token, int(time.time())), one=True)

    def too_many_failures(self):
        now = time.time()
        attempts = [t for t in failed_logins.get(self.client_ip(), []) if now - t < LOGIN_LIMIT[1]]
        failed_logins[self.client_ip()] = attempts
        return len(attempts) >= LOGIN_LIMIT[0]

    # --- routing
    def do_GET(self):
        url = urlparse(self.path)
        path = url.path
        if path == '/':
            return self.send_text(302, '', extra={'Location': '/german-a1-course.html'})
        if path == '/stats.html':
            return self.send_text(302, '', extra={'Location': '/admin.html'})
        if path.startswith('/api/'):
            return self.api_get(path, parse_qs(url.query))
        rel = path.lstrip('/')
        if rel in PUBLIC_FILES or (rel.startswith(PUBLIC_DIRS) and '..' not in rel):
            return super().do_GET()
        return self.send_text(404, 'Not found')

    def do_HEAD(self):
        rel = urlparse(self.path).path.lstrip('/')
        if rel in PUBLIC_FILES or (rel.startswith(PUBLIC_DIRS) and '..' not in rel):
            return super().do_HEAD()
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        self.api_write('POST')

    def do_PUT(self):
        self.api_write('PUT')

    def api_get(self, path, params):
        user = self.current_user()
        if path == '/api/auth/me':
            return self.send_json(200, {'user': public_user(user) if user else None})
        if path == '/api/setup':
            return self.send_json(200, {'needed': active_admins() == 0, 'local': self.is_local()})
        if path == '/api/progress':
            if not user:
                return self.send_json(401, {'error': 'Please sign in.'})
            return self.send_json(200, json.loads(user['progress']) if user['progress'] else {})
        if path.startswith('/api/admin/') or path in ('/api/stats', '/api/stats.csv'):
            if not user or user['role'] != 'admin':
                return self.send_json(403, {'error': 'Admins only.'})
            if path == '/api/admin/users':
                return self.send_json(200, {'users': list_users(params.get('q', [''])[0]), 'me': user['id']})
            period = params.get('period', ['day'])[0]
            period = period if period in PERIODS else 'day'
            if path.endswith('.csv'):
                return self.send_text(200, stats_csv(period), 'text/csv; charset=utf-8',
                                      {'Content-Disposition': f'attachment; filename="usage-{period}.csv"'})
            return self.send_json(200, stats(period))
        return self.send_json(404, {'error': 'Not found'})

    def api_write(self, method):
        path = urlparse(self.path).path
        # A custom header cannot be sent cross-site without a CORS preflight, which this server never grants.
        if self.headers.get('X-Requested-With') != 'fetch':
            return self.send_json(403, {'error': 'Forbidden'})
        user = self.current_user()

        if path == '/api/event' and method == 'POST':
            raw = self.read_json(2048)
            event = clean_event(raw, self.headers.get('User-Agent'), user['id'] if user else None) if raw else None
            if event is None:
                return self.send_json(400, {'error': 'Bad event'})
            execute('INSERT INTO events (ts, uid, sid, type, unit, mode, scope, value, device, user_id) VALUES (?,?,?,?,?,?,?,?,?,?)', event)
            return self.send_json(200, {})

        if path == '/api/progress' and method == 'PUT':
            if not user:
                return self.send_json(401, {'error': 'Please sign in.'})
            data = self.read_json(256 * 1024)
            if data is None:
                return self.send_json(400, {'error': 'Bad progress'})
            fresh = query('SELECT progress FROM users WHERE id = ?', (user['id'],), one=True)
            merged = merge_progress(json.loads(fresh['progress']) if fresh['progress'] else {}, data)
            execute('UPDATE users SET progress = ?, progress_updated = ? WHERE id = ?', (json.dumps(merged), int(time.time()), user['id']))
            return self.send_json(200, merged)

        data = self.read_json()
        if data is None:
            return self.send_json(400, {'error': 'Bad request'})

        if path == '/api/setup':
            if active_admins() or not self.is_local():
                return self.send_json(403, {'error': 'The admin account can only be created once, from the computer running the server.'})
            return self.create_account(data, role='admin')

        if path == '/api/auth/register':
            return self.create_account(data, role='learner')

        if path == '/api/auth/login':
            if self.too_many_failures():
                return self.send_json(429, {'error': 'Too many attempts. Please wait 15 minutes and try again.'})
            row = query('SELECT * FROM users WHERE email = ?', (str(data.get('email', '')).strip(),), one=True)
            if not row or not check_password(str(data.get('password', '')), row['password']):
                failed_logins.setdefault(self.client_ip(), []).append(time.time())
                return self.send_json(401, {'error': 'Email or password is not correct.'})
            if row['status'] != 'active':
                return self.send_json(403, {'error': 'This account has been disabled. Please contact the site admin.'})
            token = new_session(row['id'])
            return self.send_json(200, {'user': public_user(row)}, self.session_cookie(token, SESSION_DAYS * 86400))

        if path == '/api/auth/logout':
            cookie = SimpleCookie(self.headers.get('Cookie') or '')
            if COOKIE in cookie:
                execute('DELETE FROM sessions WHERE token = ?', (hashlib.sha256(cookie[COOKIE].value.encode()).hexdigest(),))
            return self.send_json(200, {}, self.session_cookie('', 0))

        if path == '/api/auth/password':
            if not user:
                return self.send_json(401, {'error': 'Please sign in.'})
            if not check_password(str(data.get('current', '')), user['password']):
                return self.send_json(400, {'error': 'Your current password is not correct.'})
            problem = validate_password(data.get('new'))
            if problem:
                return self.send_json(400, {'error': problem})
            execute('UPDATE users SET password = ? WHERE id = ?', (hash_password(data['new']), user['id']))
            return self.send_json(200, {})

        match = re.fullmatch(r'/api/admin/users/(\d+)', path)
        if match:
            if not user or user['role'] != 'admin':
                return self.send_json(403, {'error': 'Admins only.'})
            return self.admin_action(user, int(match.group(1)), data.get('action'))

        return self.send_json(404, {'error': 'Not found'})

    def create_account(self, data, role):
        email, name, password = data.get('email'), data.get('name'), data.get('password')
        problem = validate_account(email, name, password)
        if problem:
            return self.send_json(400, {'error': problem})
        try:
            cur = execute('INSERT INTO users (email, name, password, role, created) VALUES (?,?,?,?,?)',
                          (email.strip(), name.strip(), hash_password(password), role, int(time.time())))
        except sqlite3.IntegrityError:
            return self.send_json(409, {'error': 'An account with this email already exists. Try signing in.'})
        row = query('SELECT * FROM users WHERE id = ?', (cur.lastrowid,), one=True)
        token = new_session(row['id'])
        return self.send_json(200, {'user': public_user(row)}, self.session_cookie(token, SESSION_DAYS * 86400))

    def admin_action(self, admin, target_id, action):
        target = query('SELECT * FROM users WHERE id = ?', (target_id,), one=True)
        if not target:
            return self.send_json(404, {'error': 'That user no longer exists.'})
        removes_admin = target['role'] == 'admin' and target['status'] == 'active' and action in ('disable', 'make_learner', 'delete')
        if target_id == admin['id'] and action in ('disable', 'make_learner', 'delete'):
            return self.send_json(400, {'error': 'You cannot do that to your own account.'})
        if removes_admin and active_admins() <= 1:
            return self.send_json(400, {'error': 'The site needs at least one active admin.'})

        if action in ('disable', 'enable'):
            execute('UPDATE users SET status = ? WHERE id = ?', ('disabled' if action == 'disable' else 'active', target_id))
            if action == 'disable':
                execute('DELETE FROM sessions WHERE user_id = ?', (target_id,))
        elif action in ('make_admin', 'make_learner'):
            execute('UPDATE users SET role = ? WHERE id = ?', ('admin' if action == 'make_admin' else 'learner', target_id))
        elif action == 'reset_password':
            temporary = secrets.token_urlsafe(9)
            execute('UPDATE users SET password = ? WHERE id = ?', (hash_password(temporary), target_id))
            execute('DELETE FROM sessions WHERE user_id = ?', (target_id,))
            return self.send_json(200, {'temporary_password': temporary})
        elif action == 'delete':
            execute('UPDATE events SET user_id = NULL WHERE user_id = ?', (target_id,))  # usage stays, anonymously
            execute('DELETE FROM sessions WHERE user_id = ?', (target_id,))
            execute('DELETE FROM users WHERE id = ?', (target_id,))
        else:
            return self.send_json(400, {'error': 'Unknown action.'})
        return self.send_json(200, {})

    def log_message(self, fmt, *args):
        pass  # keep the terminal quiet; usage is in usage.db


def set_password_cli(email):
    row = query('SELECT * FROM users WHERE email = ?', (email,), one=True)
    if not row:
        sys.exit(f'No account with the email {email}.')
    password = getpass.getpass(f'New password for {row["name"]} <{row["email"]}>: ')
    problem = validate_password(password)
    if problem:
        sys.exit(problem)
    execute('UPDATE users SET password = ?, status = ? WHERE id = ?', (hash_password(password), 'active', row['id']))
    execute('DELETE FROM sessions WHERE user_id = ?', (row['id'],))
    print('Password changed.')


def create_admin_cli(email, name):
    password = getpass.getpass(f'Password for the admin account {email}: ')
    problem = validate_account(email, name, password)
    if problem:
        sys.exit(problem)
    try:
        execute('INSERT INTO users (email, name, password, role, created) VALUES (?,?,?,?,?)',
                (email.strip(), name.strip(), hash_password(password), 'admin', int(time.time())))
    except sqlite3.IntegrityError:
        execute("UPDATE users SET role = 'admin', status = 'active' WHERE email = ?", (email.strip(),))
        print('That account already existed; it is now an admin. Its password was not changed.')
        return
    print('Admin account created. Sign in at /admin.html')


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == 'set-password':
        set_password_cli(sys.argv[2])
        sys.exit()
    if len(sys.argv) > 3 and sys.argv[1] == 'create-admin':
        create_admin_cli(sys.argv[2], sys.argv[3])
        sys.exit()
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    host = os.environ.get('HOST', '')  # the VPS sets 127.0.0.1 so only nginx can reach it
    server = ThreadingHTTPServer((host, port), partial(Handler, directory=str(ROOT)))
    print(f'Course: http://localhost:{port}/german-a1-course.html · Admin: http://localhost:{port}/admin.html')
    server.serve_forever()
