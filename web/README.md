# Zema German: the website and the backend

A German A1.1 course for beginners: a Start unit (pronunciation, alphabet, numbers) and Units 1–9 with
vocabulary, grammar, reading texts and a unit test each; natural-voice audio, speaking practice with an
animated coach, flashcards, matching, sentence building, dictation and translation exercises. Course
content lives in `tools/course_content.py`. Learners can create an
account to keep their progress; admins get a usage report and user management.

Built with Django 5.2 (LTS). This Django project is also the backend of the mobile app in `../mobile/`: both
use the same accounts, progress and course content through the API in `apps/api/` (see *The API* below).

## Quick start (development)

Run every command in this README from the `web/` folder.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser        # your admin account
.venv/bin/python manage.py runserver
```

For live updates between open pages and apps (WebSockets), run the site under uvicorn instead:
`.venv/bin/uvicorn config.asgi:application --reload --reload-include '*.html' --reload-include '*.json'` (without Redis,
updates reach connections on that one process; the includes reload templates and translations too).

| Address | What |
|---|---|
| http://localhost:8000/ | Landing page (signed-in learners go straight to the course) |
| http://localhost:8000/learn/ | The course |
| http://localhost:8000/dashboard/ | Usage report and user management (staff only) |
| http://localhost:8000/admin/ | Django admin (address set by `DJANGO_ADMIN_URL`) |

Settings come from environment variables or a `.env` file; `.env.example` lists them all.
Development works without any.

## Project layout

```
config/                 project package
  settings/base.py      shared settings        dev.py / prod.py / test.py per environment
  urls.py  wsgi.py  asgi.py
apps/
  accounts/             custom User (sign in with username or email), JSON auth API, app tokens, legacy password hasher
  course/               the course page and each learner's saved progress (Progress model)
  analytics/            usage events, the report, the staff dashboard, user management
  api/                  /api/v1/: the API the mobile app uses (course content, token sign-in, sync)
  realtime/             /ws/v1/: live updates over WebSockets (Django Channels)
  landing/              the public landing page; content.py holds every figure with its source
  content/              text changes admins make on the page (TextOverride model, publish API)
  core/                 shared helpers, static storage, /healthz/, /ads.txt and /robots.txt
templates/              base, course page, dashboard, login and error pages
static/
  course/               course.css, course.js, course-data.js (generated)
  dashboard/            dashboard.css, dashboard.js
  core/                 zema.css: the shared design system (brand colours, type, 8px spacing, motion) every page uses
  core/                 zema-text.js (text store + page binding), zema-text-editor.js/.css (admins' editor)
                        hover-read.js/.css + hover-words.json: point at German on any page to hear it with its meaning
  audio/                recorded clips + manifest.json (generated)
tools/                  course content source and audio generator
deploy/                 gunicorn systemd service and nginx site
```

## Common tasks

```bash
.venv/bin/python manage.py test                 # run the tests
.venv/bin/ruff check . && .venv/bin/ruff format --check apps config
```

**Change the course content:** edit `tools/course_content.py`, then
```bash
.venv/bin/python tools/course_content.py        # writes static/course/js/course-data.js
.venv/bin/python tools/gen_course_audio.py      # records audio for any new phrases
```

**Import data from the pre-Django server** (its `usage.db`), into an empty database:
```bash
.venv/bin/python manage.py import_legacy_usage path/to/usage.db
```
Imported passwords keep working and are upgraded to Argon2 the next time each person signs in.

## Landing page content and images

Every statistic on the landing page lives in `apps/landing/content.py` next to the official source it
comes from (DAAD, Make it in Germany, KOFA/IW, the Federal Foreign Office, the IMF), with the date it was
checked. Update the figure and its source together.

The photos in `static/landing/img/` come from Wikimedia Commons. Their authors and licenses (public
domain, CC BY and CC BY-SA) are listed in `content.py` and credited in the page footer; the files were
only resized.

## Interface languages (English / Amharic)

Every page can be shown in English or Amharic. The language comes from `?lang=am` / `?lang=en` (remembered in
a cookie), else the browser's language, else English; the switch sits in the course's top bar and the landing
page's navigation.

English text is the key: `locale/am.json` maps each English string to its Amharic translation, in a `site`
section (pages Django renders: `{% t "…" %}` in templates, the landing content in `apps/landing/content.py`) and
a `course` section (`T('…')` in `course.js`, the unit, section and lesson titles, and the server's account
messages; sent to the browser with the course page). `{placeholders}` are filled in after translating. A string
without a translation stays English. After changing interface text, run `python manage.py i18n_missing` (add
`--json` for a skeleton to fill in); the tests fail while anything is untranslated or unused.

The course content is in Amharic too. German stays German (it is what the course teaches); everything that
explains it switches: word meanings (`tools/course_am/words*.txt`, by German word) and every English lesson text,
example meaning, rule, hint and exercise prompt (`tools/course_am/u*.txt`, `English ||| Amharic`). Clock times
give the Ethiopian-clock reading with the European time in brackets (9 Uhr = ሦስት ሰዓት (9:00)), and pronunciation
guides use Fidel instead of English sounds. `python3 tools/course_content.py` compiles them into
`static/course/js/course-am.js`, which only Amharic visitors load, and reports anything still missing;
`tools/course_am_strings.py` decides which lesson texts are English, and the tests fail while one has no Amharic.
In Amharic, "what does it mean in English?" exercises become a choice between Amharic meanings, and Practice
checks typed Amharic answers locally (the AI checker grades English only). The admin dashboard stays English.

## Editing text on the page

Admins (staff users) can change any text on any page right where it is shown. For testing, `TEXT_EDITING_FOR_EVERYONE` (on by default; set it to `false` in `.env`) gives every visitor the editor, including publishing, so turn it off before real use. Every page has an **Edit text**
button at the bottom left for them. In edit mode, clicking a piece of text edits it in place. Alt-click uses the
page as usual, and so does a click anywhere that isn't text. Clicks work the same way for headings, lesson
text, words and meanings, buttons and labels, and text inside dialogs.

While the admin types, every place showing the same text previews the change. The editor has three buttons:

- **Save** keeps the change as a draft in that browser (localStorage).
- **Cancel** drops it.
- **Reset to default** brings back the original wording.

**All text** lists every text on the page, including tooltips, input placeholders and the page title. From
there, admins can:

- **Publish** the drafts to the server, so every visitor sees them.
- **Export** the changes as JSON.
- **Import** JSON as drafts, for example to move changes from a test site to the live one.

Published changes are also in the Django admin under *Site text*.

Each text is keyed by its default wording as shown, with whitespace collapsed. This is the same convention as
`locale/am.json`, so the same words anywhere on the site share one value.

- **Templates:** strings with `{placeholders}` are keyed by their template. Editing "12 words learned" changes
  `{count} words learned` everywhere and keeps each number. An edit that drops a placeholder is refused.
- **Markup:** text with markup is edited per text node, so the markup stays as it is.
- **Display only:** a change affects only what is shown. Answers are still checked against the course data.
  Lasting fixes to course content therefore belong in `tools/` or `locale/`. A published change keeps working
  only while the default text it is keyed by stays the same.

How it is built:

- **Server:** `{% t %}` applies published changes as it renders (`apps/core/i18n.py`, `apps/content/`).
- **Browser:** `static/core/js/zema-text.js` applies changes to everything else, including whatever the course
  script renders later, using a MutationObserver. Visitors only load it once at least one change has been
  published.

## Word pictures

About 60% of the vocabulary has a picture: emoji chosen per word in `tools/word_pictures.py` (compound
words show their parts, e.g. *der Apfelkuchen* = 🍎 + 🍰; words with no honest picture have none). The
artwork is [Twemoji](https://github.com/jdecked/twemoji) (CC BY 4.0, credited under the course page),
stored in `static/course/pics/`. After editing the list, run `python3 tools/course_content.py` and then
`python3 tools/fetch_word_pictures.py` to download any new SVGs.

## The API (`/api/v1/`)

The mobile app reads everything through these addresses; the website's own pages use the same views. Published
app builds stay in use for months, so these addresses stay as they are, and a breaking change becomes `/api/v2/`.

| Address | What |
|---|---|
| `GET /api/v1/` | Where the audio and pictures are, and `minAppVersion` (`MOBILE_MIN_APP_VERSION`) |
| `GET /api/v1/course/?lang=en\|am` | The whole course, the Amharic meanings and every published text change, with a `version` |
| `GET /api/v1/why-german/?lang=en\|am` | The landing page's figures and reasons with their sources, for the app's introduction |
| `POST /api/v1/auth/token/` | `{login, password, device}` → `{user, token}`; `DELETE` signs this device out |
| `POST /api/v1/auth/register/` | Create an account → `{user, token}` |
| `GET /api/v1/auth/me/`, `POST /api/v1/auth/password/` | The signed-in user; change password (signs out other devices) |
| `GET/POST /api/v1/sync/` | The learner's state; POST sends operations and answers with the merged state (see [SYNC.md](../SYNC.md)) |
| `POST /api/v1/auth/web-session/` | A one-time link (two minutes) that opens the website signed in, for the app's single sign-on |
| `/ws/v1/` (WebSocket) | Live updates: `progress` for the learner's other devices, `content` when an admin publishes text |
| `GET/PUT /api/v1/progress/` | The older whole-progress format, still accepted from pages opened before operations |

- **Sign-in:** the app sends `Authorization: Bearer <token>`. Only a hash of each token is stored. Admins see each
  user's signed-in devices in the Django admin, and deleting one signs that device out.
- **Content updates:** `version` changes whenever the course files or a published text change do, and doubles as
  the ETag. The app sends it back and gets `304 Not Modified` while its offline copy is current, so text an admin
  publishes reaches the website and the app together.
- **Audio:** the app reads `static/audio/manifest.json` and downloads clips from `static/audio/<voice>/<speed>/`,
  the same files the website plays.

## Security notes

- People sign in with their username or email address (both matched regardless of capitals).
- Passwords are hashed with Argon2; Django's password validators apply to sign-ups.
- Every write from the website is CSRF-protected; the course page sends Django's token in `X-CSRFToken`. Requests
  signed with an app token skip that check: browsers never add that header by themselves.
- Failed logins are throttled per address with django-axes (10 attempts, then 15 minutes).
- Usage events store a random browser id, never an IP address.
- In production (`config.settings.prod`): HTTPS redirect, secure cookies, HSTS, and every secret
  from the environment. `python manage.py check --deploy` passes.

## Deployment

See [DEPLOY.md](DEPLOY.md) for a step-by-step guide to an Ubuntu VPS with nginx, gunicorn and HTTPS.
