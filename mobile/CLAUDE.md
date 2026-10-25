This is the Flutter app for the Zema German course. Its backend and the website are in `../web/` (Django). See
README.md for the structure.

- Run `flutter analyze && flutter test` before declaring a change done.
- The app mirrors the website. When the website changes a rule, change the app with it: sync rules
  (`lib/core/sync/rules.dart` ↔ `web/apps/course/sync.py`, cases in `web/apps/course/tests/sync_cases.json`),
  the streak tally (`lib/features/gamification/tally.dart` ↔ `web/static/core/js/tally.js`), answer checking
  (`lib/features/lessons/answer_check.dart` ↔ `course.js` `localCheck`), XP and pass marks.
- Colours and Amharic interface text come from the website: run `dart run tool/sync_shared.dart`; never edit
  `lib/ui/tokens.dart` or `assets/locale/am.json` by hand.
- Interface strings go through `T()`, with the website's English wording where one exists, so `am.json` translates them.
- The API is `/api/v1/`; published app builds stay in use for months, so the app must keep working with it.
