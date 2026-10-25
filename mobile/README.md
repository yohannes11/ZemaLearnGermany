# Zema German: the mobile app

The iOS and Android app for the Zema German course, built with Flutter. It teaches the same course as the
website, with the same accounts and progress, from the same Django backend in `../web/`.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Flutter 3.47 (Dart 3.13) | One codebase for iOS and Android, drawn by Flutter itself, so both look the same |
| Navigation | `go_router` with a `StatefulShellRoute` | Four tabs, each with its own back stack; practice sessions cover the tabs |
| State | `ChangeNotifier` stores (`core/`), redrawn with `ListenableBuilder` | Small, explicit and testable; no framework to learn |
| Drawing | Custom painters (`path_drawing` for SVG path data), `flutter_svg` for word pictures | The course map, emblems, streak tally and goal ring are drawn like the website's SVG |
| Type | Newsreader (bundled in `assets/fonts`), system font for controls | The website's serif for titles and German words |
| Offline data | Files in the app's documents folder (course JSON, recordings, pictures), `shared_preferences` (progress, settings) | The course opens and plays without a connection |
| Sign-in | Bearer token in `flutter_secure_storage` (Keychain / Keystore) | No cookies or CSRF in a native app |
| Audio | `just_audio` with `audio_session` | Plays saved clips, or streams them from the site |
| Speaking | `speech_to_text` (German) | The speaking coach hears the learner; a tap stands in where recognition is missing |
| Reminders | `flutter_local_notifications`, scheduled on the phone | Daily streak reminders work offline and need no push server |

## Running it

```bash
cd mobile
flutter pub get
# Start the backend so the emulator or phone can reach it, with live updates (from web/; runserver has no WebSockets):
#   DJANGO_SETTINGS_MODULE=config.settings.dev DJANGO_ALLOWED_HOSTS='*' ../.venv/bin/uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --reload
flutter run --dart-define=API_URL=http://10.0.2.2:8000     # Android emulator: 10.0.2.2 is this computer
flutter run --profile --dart-define=API_URL=http://10.0.2.2:8000  # the same at full speed (debug builds are slow)
flutter run --dart-define=API_URL=http://192.168.1.4:8000  # a phone on the same Wi-Fi (ipconfig getifaddr en0)
flutter run                                                # without API_URL: the live site
```

A build pointed at `http://…` is a test build: when the computer's address changes, open **Me › Test server**,
enter the new one and tap **Save and connect**. Debug builds allow plain http; release builds need https.

Android builds need Java 17 (`JAVA_HOME`, or `flutter config --jdk-dir`). iOS builds need Xcode and CocoaPods.

Before committing: `flutter analyze && flutter test`.

Release builds: `flutter build appbundle` (Google Play) and `flutter build ipa` (App Store). Both keep the app id
`com.zemalearn.german` of the earlier Expo app, so they replace it in the stores. Add the release signing config
in `android/app/build.gradle.kts` before the first upload.

## How it fits together

```
lib/
  main.dart                 loads what is saved on the phone, then starts the app
  router.dart               tabs, their stacks, full-screen sessions, the onboarding guard
  core/                     the app's plumbing, no screens
    api/                    models.dart (mirrors web/apps/api), client.dart (every request, the token)
    sync/                   rules.dart (the server's conflict rules), engine.dart (outbox, retries), live.dart (/ws/v1/)
    offline/                recordings (per unit, voice and speed) and word pictures saved on the phone
    course.dart session.dart settings.dart storage.dart i18n.dart config.dart
  features/                 one folder per product area
    gamification/           XP and levels (game.dart), the streak tally (port of tally.js), milestones, celebration
    progress/               progress changes, what to do next, the course map and its emblems
    lessons/                questions (incl. the unit test, verb endings, countries), the question view, quiz sessions,
                            lesson content, answer checking (port of the website's checker)
    vocabulary/             spaced repetition, flashcards, match, practice, word-by-word learning, the speaking coach
    onboarding/ reminders/
  screens/                  Home, Words, Lessons, Me, unit, section, lesson, sign-in
  ui/                       design system: tokens.dart (from zema.css), theme, primitives, rich text
tool/sync_shared.dart       copies zema.css colours and web/locale/am.json into the app
test/                       sync rules (the server's sync_cases.json), tally and answer checking (the website's cases)
```

## The same as the website

| Website | App |
|---|---|
| Course map with topic emblems, solid road travelled, dashed ahead, pennant for a passed unit test | Home, scrolls sideways, tap a place to open its unit |
| Progress column: today's ring, streak, up next with minutes, milestones, the whole course | Home |
| Streak dialog: full tally, legend, daily goal, freezes | Tap the tally (Home, Words, Lessons, Me) |
| Learn: word grid with "Reveal all", word by word | Section page (word list), Learn mode |
| Flashcards (DE→EN, EN→DE, mixed) | Swipe cards, direction under Me; graded for spaced review too |
| Match (10 pairs) | Match |
| Practice (type the translation) | Practice, with the same forgiving check (the website's local AI checker runs only on its own Mac) |
| Speak with Selam or Dawit | Speaking coach: listen three times, say it three times |
| Lessons, reading texts, exercises of every item type | Lessons tab and lesson pages; reading text stays in view during its exercise |
| Unit test (12 questions, 9 to pass), verb endings, countries | Built in the app the same way |
| English or Amharic | Explanations and interface (the website's `am.json`) |
| Voice, speaking speed, light or dark | Me |
| Sync, live updates, resume on any device, single sign-on | Same API, same rules |

App only: today's review (spaced repetition), listening practice per unit, saving a unit's recordings for
offline use, daily reminders.

## Next steps

1. **Push reminders** from the server, if reminders must know about practice done on other devices.
2. **A lip-synced coach** like the website's illustrated one (the app shows the coach's face and when they talk).
3. **App icons and splash** in the brand (`assets/brand/` holds the earlier app's files).
