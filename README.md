# Zema German

A German A1.1 course for Amharic and English speakers, on the web and on phones.

| Folder | What | Start here |
|---|---|---|
| [`web/`](web/) | The website and the backend: Django 5.2, the course, accounts, admin, and the API | [web/README.md](web/README.md) |
| [`mobile/`](mobile/) | The iOS and Android app: Expo (React Native, TypeScript) | [mobile/README.md](mobile/README.md) |

Both are one product with one source of truth. How progress syncs between them in real time, offline included,
and how an exercise left on one device continues on another: [SYNC.md](SYNC.md). The Django backend in `web/` holds the accounts, every learner's
progress, the course content and the recordings. The website uses them directly. The app uses them through
`/api/v1/`. A live connection (`/ws/v1/`) carries every change to the learner's other open devices within a
moment, and a text change an admin publishes to everyone.

Shared pieces:

- **Course content:** `web/tools/course_content.py` produces the course data. The website loads it as a script,
  and the app gets it from `/api/v1/course/`.
- **API contract:** `web/apps/api/` serves it (tested in `web/apps/api/tests/`), and `mobile/src/api/types.ts`
  describes it for the app.
- **Design tokens:** `web/static/core/css/zema.css`. `npm run sync-tokens` in `mobile/` copies the palette.
- **Audio:** `web/static/audio/`, streamed or downloaded by the app.

Deployment of the site and the API: [web/DEPLOY.md](web/DEPLOY.md).
