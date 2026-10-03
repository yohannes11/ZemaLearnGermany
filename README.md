# ZemaLearnGermany

A German A1.1 course for beginners: a Start unit (pronunciation, alphabet, numbers) and Units 1–9 with
vocabulary, grammar, reading texts and a unit test each; natural-voice audio, speaking practice with an
animated coach, flashcards, matching, sentence building, dictation and translation exercises. Course
content lives in `tools/course_content.py`. Learners can create an
account to keep their progress; admins get a usage report and user management.

Built with Django 5.2 (LTS).

## Quick start (development)

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser        # your admin account
.venv/bin/python manage.py runserver
```

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
  accounts/             custom User (sign in with username or email), JSON auth API, legacy password hasher
  course/               the course page and each learner's saved progress (Progress model)
  analytics/            usage events, the report, the staff dashboard, user management
  landing/              the public landing page; content.py holds every figure with its source
  core/                 shared helpers, static storage, /healthz/, /ads.txt and /robots.txt
templates/              base, course page, dashboard, login and error pages
static/
  course/               course.css, course.js, course-data.js (generated)
  dashboard/            dashboard.css, dashboard.js
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

## Word pictures

About 60% of the vocabulary has a picture: emoji chosen per word in `tools/word_pictures.py` (compound
words show their parts, e.g. *der Apfelkuchen* = 🍎 + 🍰; words with no honest picture have none). The
artwork is [Twemoji](https://github.com/jdecked/twemoji) (CC BY 4.0, credited under the course page),
stored in `static/course/pics/`. After editing the list, run `python3 tools/course_content.py` and then
`python3 tools/fetch_word_pictures.py` to download any new SVGs.

## Security notes

- People sign in with their username or email address (both matched regardless of capitals).
- Passwords are hashed with Argon2; Django's password validators apply to sign-ups.
- Every write is CSRF-protected; the course page sends Django's token in `X-CSRFToken`.
- Failed logins are throttled per address with django-axes (10 attempts, then 15 minutes).
- Usage events store a random browser id, never an IP address.
- In production (`config.settings.prod`): HTTPS redirect, secure cookies, HSTS, and every secret
  from the environment. `python manage.py check --deploy` passes.

## Deployment

See [DEPLOY.md](DEPLOY.md) for a step-by-step guide to an Ubuntu VPS with nginx, gunicorn and HTTPS.
