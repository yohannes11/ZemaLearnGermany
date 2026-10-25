# Progress sync: one learner, every device

The website (`web/`) and the app (`mobile/`) share one account and one progress. A learner can stop on one
device and carry on on another at the same question. Each device works offline and catches up afterwards,
with no lost or double-counted progress. This page describes how that works.

## The idea in one paragraph

Devices never upload "my progress". They upload **operations**: small records of one thing the learner
did, each with an id the device makes up and the time it happened. The server applies each operation once
(`ProgressEvent` keeps every id), resolves conflicts **per field** by fixed rules, and answers with the whole
resulting state. A live connection tells every other open device that the state changed, and each device
then fetches it. Because operations are idempotent and the rules don't depend on arrival order, retrying,
queueing offline for days, or receiving changes in any order all lead to the same result.

## Data model (`web/apps/course/models.py`)

| Model | Holds |
|---|---|
| `Progress` (one per learner) | `revision` (goes up on every real change), `learned` words, `word_log` (when each word last changed), `grammar` (best scores), `days` practised, `xp` per day, `srs` (review schedule per word), `session` (the open exercise) |
| `ProgressEvent` | Every operation applied, unique per (learner, `op_id`): the deduplication record |

## Operations and conflict rules (`web/apps/course/sync.py`, `mobile/lib/core/sync/rules.dart`)

Every operation has `id`, `kind`, `at` (milliseconds since 1970, from the device's clock) and `day` (the
learner's own calendar day, `YYYY-MM-DD`).

| kind | fields | when two devices disagree |
|---|---|---|
| `word` | `german`, `learned` | the latest change wins (`at`, then `id`) |
| `review` | `german`, `box`, `due` | the latest review wins |
| `score` | `lesson`, `score` | the best score is kept |
| `xp` | `amount` (1–500) | added once per operation: exact across devices |
| `session` | `session` (or `null` to close it) | the latest position wins |
| `goal` | `xp` (10–1000) | every change is kept; a day is judged by the goal in force that day |

`word`, `review`, `score` and `xp` also mark their `day` as practised, which drives the streak. A clock
running more than 5 minutes fast is clamped, so it can't win every conflict.

Both implementations are tested against the same cases, `web/apps/course/tests/sync_cases.json`. One such case
is an offline phone's old un-mark arriving after a newer mark on the website. Change the rules only together
with those cases.

## API (`/api/v1/`)

| Call | Body | Answer |
|---|---|---|
| `GET /api/v1/sync/` | | the state (below) |
| `POST /api/v1/sync/` | `{"ops": [...], "device": "android-…"}` (at most 500) | the state after applying them. One bad operation rejects the batch with `400 {"error": …}` and applies nothing |

```json
{
  "revision": 12,
  "learned": ["Hallo!", "Danke"],
  "grammar": {"g1-sein": 7},
  "days": ["2026-10-09", "2026-10-10"],
  "xp": {"2026-10-10": 140},
  "srs": {"Hallo!": {"box": 3, "due": "2026-10-14", "at": 1760000000000, "id": "…"}},
  "goals": [["2026-10-01", 1759300000000, 50, "…"]],
  "session": {"kind": "quiz", "ref": "g1-sein", "items": [3, 0, 5, 1, 2, 4, 6, 7], "answers": [true, false],
              "position": 2, "done": false, "platform": "web", "device": "web-…", "at": 1760000000000, "id": "…"}
}
```

The website signs in with its session cookie and CSRF token; the app uses a bearer token. Pages opened before
this change still `PUT /api/progress/` their whole progress, and the server turns that into operations too.

## Live updates (`/ws/v1/`, `web/apps/realtime/`)

One WebSocket per open page or app. The website connects with its cookie and must come from the site's own
domain. The app has no cookie and sends `{"type": "auth", "token": "…"}` as its first message.

| Server sends | Meaning |
|---|---|
| `{"type": "progress", "revision": 13, "origin": "web-…"}` | this learner's state changed (`origin`: which device did it, so it doesn't fetch its own change) |
| `{"type": "content"}` | an admin published text; fetch the course again (its `version` says whether it changed) |

Messages only say *that* something changed. The device then fetches it over HTTP, so a message missed while
reconnecting costs a moment's delay, never data. Between server processes, messages travel through Redis
(`REDIS_URL`). Devices also catch up when they come back to the foreground or online, so they never depend
on the socket alone.

## On each device

**App (`mobile/lib/core/sync/engine.dart`).** The app shows the server's last state with its unconfirmed
operations applied on top, using the same rules, so every tap shows at once, offline too.
- **Outbox:** operations wait in a persisted outbox. It is sent about 0.8 s after a change, when the app
  returns to the foreground, when the network comes back (tested: within 2 s) and when the live connection
  reports a change. Failures retry after 5, 15, 30 and 60 s.
- **Guests:** what a guest does is kept as operations and joins the account at sign-in.
- **Signing out:** a deliberate sign-out sends what is waiting, then clears the phone. An expired sign-in
  keeps it for next time.

**Website (`web/static/course/js/course.js`, "Progress sync").** Every change to learned words or scores
becomes an operation as it happens, waits in `localStorage` while offline, and goes to the same endpoint.
Changes from other devices are applied live, with waiting operations replayed on top.

## Resume anywhere

An open exercise is the `session` field. For a lesson exercise, `items` are the quiz item **numbers** in the
order drawn, so any device rebuilds the very same questions. Answers are checked the same way on both
platforms: the app's `answer_check.dart` is a line-for-line port of the website's checker.
- **Saving:** both clients save the position after every question and clear it when the exercise ends.
- **App:** Home shows "Continue where you stopped on the website / your other phone", and the lesson screen
  shows "Continue · question n of 8".
- **Website:** a banner offers to continue an exercise left open on another device. It opens the right
  unit and goes straight to that question.
- **Flashcard decks:** these resume between phones. The website has no matching deck to resume.

## The streak tally (stick-strikeout)

One stick per day of the current streak. A day you practised keeps the streak; a day you reached your daily
goal gets a bold diagonal strikeout. Sticks are bundled in fives, and a bundle of five goal days is bound with
a gold band. The website's top bar, streak dialog, lesson results and profile show it, and so do the app's
chips, Home, celebration screen and Me tab.

| State | Drawn as | When |
|---|---|---|
| `met` | stick struck out in the flame colour | the day's XP reached the goal in force that day |
| `kept` | plain stick | practised, goal not reached |
| `today` | stick glowing gold | today, until its goal is reached (counted in the streak once practised) |
| `frozen` | icy blue stick | a missed day covered by a streak freeze |
| `missed` | dotted grey stick, before the new streak | the day the last streak broke (shown for 2 days) |

**Freezes.** Every 5 goal days in a streak earn a freeze, and you can hold at most 2. A freeze covers one
missed day by itself.

**Nothing extra is stored.** The tally is computed from synced facts: `days`, `xp` and `goals` (above). Days
are the learner's own calendar days, so the day resets at their local midnight. Every device computes the
same tally from the same facts.

**Two copies of one implementation.** Rules, layout, colour roles and timing are in `web/static/core/js/tally.js`,
which the website loads as a script. The Flutter app can't run that file, so `mobile/lib/features/gamification/tally.dart`
is a line-for-line port of it, checked by the website's own cases (`mobile/test/tally_test.dart`). Change both
together. Each platform only draws: `web/static/core/js/tally-view.js` as SVG, and
`mobile/lib/features/gamification/tally_view.dart` with a custom painter. Colours come from `zema.css` (`--flame`,
`--freeze`), which the app copies with `dart run tool/sync_shared.dart`. Tests: `flutter test` in `mobile/`.

**Animation, and offline.** A strike draws itself (420 ms, eased like the rest of the design, 90 ms apart) the
first time a device shows that day struck, with a success haptic on phones.
- Each device remembers which days it has drawn: `localStorage` on the website, settings in the app.
- A goal reached offline strikes the stick at once on that device, then syncs.
- A goal reached on another device strikes here when the change arrives.
- With reduce-motion on, strikes appear without the animation and today's stick doesn't pulse.

## Single sign-on

Both clients use the same accounts. **Me › Open the website, signed in** asks for a link
(`POST /api/v1/auth/web-session/`) that is valid for two minutes and works once. The browser shows
"Continue as …" and signs in only on that button press, so a link preview can't use the link up.

## Not done yet

- **Streak reminders** are still scheduled on the phone, not pushed by the server.
- **The tally in the streak reminders:** they mention the streak length, not yet the tally or freezes.
- **The website awards XP** for new words and lesson exercises only. Its other practice modes (matching,
  speaking) record words learned but no XP.
