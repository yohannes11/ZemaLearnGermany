"""Progress sync: devices send operations, the server applies each once and resolves conflicts per field.

An operation is one thing a learner did, with an id the device made up, when it happened (`at`, milliseconds)
and the learner's calendar day (`day`):

    {"id": "…", "kind": "word",    "at": 1760000000000, "day": "2026-10-10", "german": "Hallo!", "learned": true}
    {"id": "…", "kind": "review",  …, "german": "Hallo!", "box": 2, "due": "2026-10-12"}
    {"id": "…", "kind": "score",   …, "lesson": "g1-sein", "score": 7}
    {"id": "…", "kind": "xp",      …, "amount": 10}
    {"id": "…", "kind": "session", …, "session": {…} or null}
    {"id": "…", "kind": "goal",    …, "xp": 50}

How conflicts resolve, so any order of arrival gives the same result:
- word, review, session: the latest change wins (by `at`, then by id), so an offline phone's old change can't
  undo a newer one made on the website.
- score: the best score is kept.
- xp: every operation adds its points once (operations are deduplicated by id), so XP from several devices adds up
  exactly and a retried request never counts twice.
- days practised: every word, review, score and xp operation marks its `day`.
- goal: every change is kept (by id) with its day; the goal in force on a day is the latest change made on or
  before it, so whether a day reached its goal (the streak tally's strikeout) never depends on arrival order.

The same rules run in the app (mobile/src/core/sync/rules.ts); both are checked against sync_cases.json.
"""

import re
import uuid
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import Progress, ProgressEvent

MAX_OPS = 500
MAX_LEARNED_WORDS = 5000
MAX_LESSONS = 500
MAX_DAYS = 400
MAX_REVIEWS = 5000
MAX_XP_PER_OP = 500
MAX_SESSION_ITEMS = 60
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
KINDS = {"word", "review", "score", "xp", "session", "goal"}
MIN_GOAL, MAX_GOAL = 10, 1000
MAX_GOAL_CHANGES = 200
PRACTICE = {"word", "review", "score", "xp"}
SESSION_KINDS = {"quiz", "cards", "listening"}
# A device clock may run fast; changes stamped far in the future would win every conflict, so they are clamped.
MAX_CLOCK_AHEAD = timedelta(minutes=5)


class BadOperation(ValueError):
    pass


def _text(value, limit):
    return isinstance(value, str) and 0 < len(value) <= limit


def _int(value, low, high):
    return isinstance(value, int) and not isinstance(value, bool) and low <= value <= high


def _clean_session(session):
    """A resumable exercise, or None to clear it. Unknown fields are dropped."""
    if session is None:
        return None
    if not isinstance(session, dict) or session.get("kind") not in SESSION_KINDS or not _text(session.get("ref"), 60):
        raise BadOperation("A session needs a kind (quiz, cards or listening) and a ref.")
    items, answers = session.get("items", []), session.get("answers", [])
    if (
        not (isinstance(items, list) and isinstance(answers, list))
        or len(items) > MAX_SESSION_ITEMS
        or len(answers) > MAX_SESSION_ITEMS
    ):
        raise BadOperation("A session has at most 60 items and answers.")
    if not all(isinstance(i, int | str) and not isinstance(i, bool) for i in items):
        raise BadOperation("Session items are numbers or words.")
    if not all(isinstance(a, bool) for a in answers):
        raise BadOperation("Session answers are true or false.")
    position = session.get("position", 0)
    if not _int(position, 0, MAX_SESSION_ITEMS):
        raise BadOperation("The session position is a number.")
    return {
        "kind": session["kind"],
        "ref": session["ref"],
        "items": items,
        "answers": answers,
        "position": position,
        "done": bool(session.get("done", False)),
        "platform": session["platform"] if session.get("platform") in {"web", "ios", "android"} else "web",
        # Which browser or phone it is on, so that one doesn't offer itself its own exercise to continue.
        "device": session["device"] if _text(session.get("device"), 64) else "",
    }


def clean(op, now_ms):
    """The operation with its fields checked, or BadOperation."""
    if not isinstance(op, dict) or op.get("kind") not in KINDS or not _text(op.get("id"), 64):
        raise BadOperation("Each operation needs an id and a known kind.")
    at, day = op.get("at"), op.get("day")
    if not _int(at, 1_577_836_800_000, 10**14) or not (isinstance(day, str) and DAY.match(day)):
        raise BadOperation("Each operation needs `at` (milliseconds) and `day` (YYYY-MM-DD).")
    out = {
        "id": op["id"],
        "kind": op["kind"],
        "at": min(at, now_ms + int(MAX_CLOCK_AHEAD.total_seconds() * 1000)),
        "day": day,
    }
    kind = op["kind"]
    if kind == "word":
        if not _text(op.get("german"), 200) or not isinstance(op.get("learned"), bool):
            raise BadOperation("A word operation needs `german` and `learned`.")
        out.update(german=op["german"], learned=op["learned"])
    elif kind == "review":
        if (
            not _text(op.get("german"), 200)
            or not _int(op.get("box"), 0, 20)
            or not (isinstance(op.get("due"), str) and DAY.match(op["due"]))
        ):
            raise BadOperation("A review operation needs `german`, `box` and `due`.")
        out.update(german=op["german"], box=op["box"], due=op["due"])
    elif kind == "score":
        if not _text(op.get("lesson"), 60) or not _int(op.get("score"), 0, 100):
            raise BadOperation("A score operation needs `lesson` and `score` (0-100).")
        out.update(lesson=op["lesson"], score=op["score"])
    elif kind == "xp":
        if not _int(op.get("amount"), 1, MAX_XP_PER_OP):
            raise BadOperation(f"An xp operation adds 1 to {MAX_XP_PER_OP} points.")
        out.update(amount=op["amount"])
    elif kind == "goal":
        if not _int(op.get("xp"), MIN_GOAL, MAX_GOAL):
            raise BadOperation(f"A daily goal is {MIN_GOAL} to {MAX_GOAL} XP.")
        out.update(xp=op["xp"])
    else:
        out.update(session=_clean_session(op.get("session")))
    return out


def _newer(at, op_id, current):
    """Whether a change stamped (at, op_id) wins over the stored one, given as (at, op_id) or None."""
    return current is None or (at, op_id) > tuple(current)


def apply(progress, op):
    """Applies one cleaned operation to `progress` (in memory)."""
    kind, at, op_id = op["kind"], op["at"], op["id"]
    if kind in PRACTICE and op["day"] not in progress.days:
        progress.days = sorted([*progress.days, op["day"]])[-MAX_DAYS:]

    if kind == "word":
        current = progress.word_log.get(op["german"])
        if _newer(at, op_id, current and (current[1], current[2] if len(current) > 2 else "")):
            progress.word_log[op["german"]] = [op["learned"], at, op_id]
            words = [w for w in progress.learned if w != op["german"]]
            progress.learned = ([*words, op["german"]] if op["learned"] else words)[-MAX_LEARNED_WORDS:]
    elif kind == "review":
        current = progress.srs.get(op["german"])
        room = current is not None or len(progress.srs) < MAX_REVIEWS
        if room and _newer(at, op_id, current and (current["at"], current.get("id", ""))):
            progress.srs[op["german"]] = {"box": op["box"], "due": op["due"], "at": at, "id": op_id}
    elif kind == "score":
        best = progress.grammar.get(op["lesson"])
        if (best is None and len(progress.grammar) < MAX_LESSONS) or (best is not None and op["score"] > best):
            progress.grammar[op["lesson"]] = op["score"]
    elif kind == "xp":
        progress.xp[op["day"]] = progress.xp.get(op["day"], 0) + op["amount"]
        progress.xp = dict(sorted(progress.xp.items())[-MAX_DAYS:])
    elif kind == "goal":
        changes = sorted([*progress.goals, [op["day"], at, op["xp"], op_id]], key=lambda g: (g[1], g[3]))
        progress.goals = changes[-MAX_GOAL_CHANGES:]
    else:
        current = progress.session or None
        if _newer(at, op_id, current and (current["at"], current["id"])):
            progress.session = (
                {**op["session"], "at": at, "id": op_id} if op["session"] else {"at": at, "id": op_id, "cleared": True}
            )


def sync(user, ops):
    """Applies a device's operations for `user`, each at most once; returns (progress, whether the state changed).
    The revision only goes up when it did, so devices are only told about real changes.

    Raises BadOperation (nothing applied) when any operation is malformed, so a device never half-syncs."""
    if not isinstance(ops, list) or len(ops) > MAX_OPS:
        raise BadOperation(f"Send a list of at most {MAX_OPS} operations.")
    now_ms = int(timezone.now().timestamp() * 1000)
    cleaned = [clean(op, now_ms) for op in ops]
    with transaction.atomic():
        # Lock the row: two devices syncing at the same moment apply one after the other.
        progress, _ = Progress.objects.select_for_update().get_or_create(user=user)
        if not cleaned:
            return progress, False
        seen = set(
            ProgressEvent.objects.filter(user=user, op_id__in=[op["id"] for op in cleaned]).values_list(
                "op_id", flat=True
            )
        )
        fresh = []
        for op in cleaned:
            if op["id"] not in seen:
                seen.add(op["id"])  # the same id twice in one batch counts once
                fresh.append(op)
        if not fresh:
            return progress, False
        before = repr(progress.state())
        # Older changes first, so the stored order of learned words follows when they were learned.
        for op in sorted(fresh, key=lambda op: (op["at"], op["id"])):
            apply(progress, op)
        try:
            ProgressEvent.objects.bulk_create(
                ProgressEvent(
                    user=user,
                    op_id=op["id"],
                    kind=op["kind"],
                    at=datetime.fromtimestamp(op["at"] / 1000, tz=dt_timezone.utc),
                    data={k: v for k, v in op.items() if k not in {"id", "kind", "at"}},
                )
                for op in fresh
            )
        except IntegrityError as error:  # pragma: no cover - the row lock makes this a race we never lose
            raise BadOperation("These changes were just applied by another request; sync again.") from error
        changed = repr(progress.state()) != before
        if changed:
            progress.revision += 1
        progress.save()
    return progress, changed


def legacy_ops(progress, learned, grammar, *, replace, day):
    """Turns a whole-progress upload from an older course page into operations, stamped now.

    A replace upload means "my words are exactly these": words it lacks are un-marked. Pages from before this
    change still send it, so it keeps working, but the course page now sends operations itself."""
    now = int(timezone.now().timestamp() * 1000)
    stamp = lambda: {"id": f"legacy-{uuid.uuid4().hex}", "at": now, "day": day}  # noqa: E731
    have = set(progress.learned) if progress else set()
    words = [w for w in learned if isinstance(w, str) and 0 < len(w) <= 200]
    ops = [{**stamp(), "kind": "word", "german": w, "learned": True} for w in dict.fromkeys(words) if w not in have]
    if replace:
        ops += [{**stamp(), "kind": "word", "german": w, "learned": False} for w in have - set(words)]
    best = progress.grammar if progress else {}
    for lesson, score in grammar.items():
        if _text(lesson, 60) and _int(score, 0, 100) and score > best.get(lesson, -1):
            ops.append({**stamp(), "kind": "score", "lesson": lesson, "score": score})
    return ops
