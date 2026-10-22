# Zema German: the mobile app

The iOS and Android app for the Zema German course. It teaches the same course as the website, with the same
accounts and progress, from the same Django backend in `../web/`.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Expo SDK 57 (React Native 0.86, TypeScript) | One codebase for iOS and Android, cloud builds with EAS, over-the-air fixes |
| Navigation | Expo Router (`src/app/`), native tabs | Screens are files; real platform tab bars |
| Animation and gestures | Reanimated 4, Gesture Handler | Swipe cards, pager and celebrations on the UI thread at full frame rate |
| Type | Plus Jakarta Sans (`@expo-google-fonts`) | The website's typeface |
| Icons and graphics | `@expo/vector-icons`, `react-native-svg`, `expo-image` | Tab and UI icons, the goal ring, cached word pictures and photos |
| Offline data | `expo-file-system` (course JSON, audio clips), AsyncStorage (progress, settings) | The course opens and plays without a connection |
| Sign-in | Bearer token in `expo-secure-store` (Keychain / Keystore) | No cookies or CSRF in a native app |
| Audio | `expo-audio` | Plays downloaded clips, or streams them from the site |
| Reminders | `expo-notifications`, scheduled on the device | Daily streak reminders work offline and need no push server |

## Running it

```bash
cd mobile
npm install
cp .env.example .env.local      # point EXPO_PUBLIC_API_URL at your computer, see below
npx expo start                  # then press i (iOS simulator) or a (Android), or scan the QR code
```

For the backend, run the dev server in `web/` so phones can reach it:
`DJANGO_ALLOWED_HOSTS='*' ../.venv/bin/uvicorn config.asgi:application --host 0.0.0.0 --reload`.
Without `EXPO_PUBLIC_API_URL` the app talks to the live site.

**Test builds and a changing address.** A build pointed at `http://…` (your computer) is a test build. When the
computer's Wi-Fi address changes (another network, a router restart), the app can't reach it: nothing new loads and
recordings stay silent. Open **Me › Test server**, enter the new address (`ipconfig getifaddr en0` on a Mac) and
tap **Save and connect**; no new build needed. In the Android emulator, `http://10.0.2.2:8000` always reaches the
computer it runs on.

Before committing: `npm run typecheck && npm run lint`.

Release builds use EAS: `npx eas-cli@latest build --platform all` (it asks to create the project the first time).

## How it fits together

```
src/
  app/                      routes only (Expo Router); each file is a thin screen over features/
    _layout.tsx             fonts, saved state, providers; onboarding guard (Stack.Protected)
    onboarding.tsx          first run only
    (tabs)/                 Home · Words · Lessons · Me (native tab bar)
      index.tsx             Home: today's goal, streak week, level, "continue" cards
      words/                Vocabulary training: review, sections by unit, word lists     (own stack)
      lessons/              Learning modules: grammar, reading, unit tests, listening     (own stack)
      me.tsx                account, stats, daily goal, language, voice, reminder, offline
    session/                full-screen practice: cards, quiz, listening (no tab bar, close to leave)
    sign-in.tsx
  core/                     the app's plumbing, no screens
    api/                    types.ts (mirrors web/apps/api), client.ts (every request, the token)
    offline/                the course and recordings saved on the phone
    course.tsx session.tsx  the course (English/Amharic, admins' text changes) and the signed-in user
    settings.ts store.ts    persisted settings, and the small store they are built on
  features/                 one folder per product area
    onboarding/             slides, pager, the website's sourced reasons to learn German
    vocabulary/             spaced repetition (srs.ts), the swipe card, card sessions, word rows
    lessons/                lesson kinds, questions, the question view and quiz sessions, lesson content
    gamification/           XP rules and levels (xp.ts), celebration, confetti, goal ring, chips, week strip
    progress/               progress and its sync rules, streaks, what to do next
    reminders/              daily streak reminders
  ui/                       design system: theme/ (tokens from zema.css, type scale, motion), primitives
```

**Separation.** Words (vocabulary training) and Lessons (learning modules) are separate tabs with separate
stacks, separate feature folders and their own accent colours: gold for words, emerald for lessons. Home
only links into them. Practice always opens as a full-screen session above the tabs, with one way out, so
there are no dead ends.

**The game.** The rules live in `features/gamification/xp.ts`: XP for new words, reviews and right answers,
bonuses for passing a lesson and for perfect scores, a level curve, and daily goals. XP is stored per day in
the learner's progress and synced: the server keeps each day's highest count, so two devices never count the
same XP twice. Every session ends with a celebration (confetti only for a real success, a level-up banner,
the streak and the daily goal). Animations run on the UI thread with Reanimated and switch off with the
phone's reduce-motion setting.

**Spaced repetition.** Learned words come back for review on a Leitner schedule (1, 2, 4, 8, 16 and 32 days);
a miss brings a word back the same day. Schedules sync with the account (the latest review of a word wins).

**Onboarding.** On first start: a welcome (with the choice of English or Amharic explanations), three reasons
with photos and figures served by `/api/v1/why-german/` (the website's landing page content, each with its
official source), how the app works, and a daily goal. Skip jumps to the goal. Offline, the reasons are left
out. *Me › Watch the introduction again* shows it again.

**Sync and resume.** `src/core/sync/` holds the sync engine: operations, an offline outbox, conflict rules shared with
the server, and a live connection. Exercises continue on any device at the same question. See [SYNC.md](../SYNC.md).
`npm run test:sync` checks the rules against the server's cases, and the answer checking against the website's.

**Offline first.** The course, the clip list, settings, progress and review data load from the phone before the
first screen; the server is only asked whether anything changed. Recordings stream, or are saved per unit.

**Same rules as the website.** A lesson exercise is 8 items drawn from the same list as the website's, and 6 right completes it. Every item
type runs in the app (multiple choice, listening, gaps, word order, typed answers), checked like on the website.
`npm run sync-tokens` copies the colours from `web/static/core/css/zema.css`.

## Next steps

1. **Unit tests and the present-tense trainer**, which the website builds itself, so every exercise also runs in
   the app (they open the website for now; their scores sync back).
2. **Amharic interface text.** Course content already switches to Amharic. Buttons and labels are English for now;
   reuse `web/locale/am.json` by adding its `course` section to the API.
3. **Speaking practice** with `expo-audio` recording, like the website's coach.
4. **Server push** (Expo push tokens and a daily job on the server) only if reminders must know about practice done
   on other devices. The on-device reminders cover the streak already.
5. **Content in the database.** The course is written in `web/tools/course_content.py`. Moving units, words and
   quizzes into Django models would let admins edit them in the admin site; the API's shape can stay the same, so
   neither the website nor the app has to change.
6. **App icons and splash** in the brand (the files in `assets/images/` are placeholders).
