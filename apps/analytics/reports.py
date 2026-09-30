"""Usage report: visitors, visits, study time and sign-ups per day, week, month or year."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Min, Q
from django.utils import timezone

from .models import Event

# How many buckets each report shows.
PERIODS = {"day": 30, "week": 12, "month": 12, "year": 5}

CSV_FIELDS = [
    "start",
    "label",
    "users",
    "new_users",
    "returning_users",
    "sessions",
    "minutes",
    "grammar_quizzes",
    "signups",
]


def bucket_start(day: date, period: str) -> date:
    if period == "day":
        return day
    if period == "week":
        return day - timedelta(days=day.weekday())  # Monday
    if period == "month":
        return day.replace(day=1)
    return day.replace(month=1, day=1)


def previous_bucket(start: date, period: str) -> date:
    if period == "day":
        return start - timedelta(days=1)
    if period == "week":
        return start - timedelta(days=7)
    if period == "month":
        return (start - timedelta(days=1)).replace(day=1)
    return start.replace(year=start.year - 1)


def bucket_label(start: date, period: str) -> str:
    if period == "day":
        return start.strftime("%a %d %b %Y")
    if period == "week":
        return f"Week of {start.strftime('%d %b %Y')}"
    if period == "month":
        return start.strftime("%B %Y")
    return str(start.year)


def bucket_starts(period: str, today: date | None = None) -> list[date]:
    starts = [bucket_start(today or timezone.localdate(), period)]
    for _ in range(PERIODS[period] - 1):
        starts.append(previous_bucket(starts[-1], period))
    return starts[::-1]


def usage_report(period: str) -> dict:
    starts = bucket_starts(period)
    since = timezone.make_aware(datetime.combine(starts[0], time.min))

    def key(moment: datetime) -> date:
        return bucket_start(timezone.localdate(moment), period)

    buckets = {s: {"users": set(), "sessions": set(), "minutes": 0, "quizzes": 0} for s in starts}
    modes, units, devices = defaultdict(set), defaultdict(set), defaultdict(set)
    events = Event.objects.filter(created_at__gte=since).values_list(
        "created_at", "visitor_id", "session_id", "type", "unit", "mode", "device"
    )
    for created_at, visitor, session, kind, unit, mode, device in events.iterator(chunk_size=5000):
        bucket = buckets.get(key(created_at))
        if bucket is None:
            continue
        bucket["users"].add(visitor)
        bucket["sessions"].add(session)
        if kind == Event.Type.ACTIVE:
            bucket["minutes"] += 1
        elif kind == Event.Type.GRAMMAR:
            bucket["quizzes"] += 1
        elif kind == Event.Type.VIEW:
            if mode:
                modes[mode].add(visitor)
            if unit:
                units[unit].add(visitor)
        devices[device].add(visitor)

    first_seen = Event.objects.values("visitor_id").annotate(first=Min("created_at"))
    new_visitors = defaultdict(int)
    for row in first_seen:
        new_visitors[key(row["first"])] += 1

    User = get_user_model()
    signups = defaultdict(int)
    for joined in User.objects.filter(date_joined__gte=since).values_list("date_joined", flat=True):
        signups[key(joined)] += 1

    series = []
    for start in starts:
        bucket = buckets[start]
        active = len(bucket["users"])
        new = min(new_visitors[start], active)
        series.append(
            {
                "start": start.isoformat(),
                "label": bucket_label(start, period),
                "users": active,
                "new_users": new,
                "returning_users": active - new,
                "sessions": len(bucket["sessions"]),
                "minutes": bucket["minutes"],
                "grammar_quizzes": bucket["quizzes"],
                "signups": signups[start],
            }
        )

    return {
        "period": period,
        "generated": timezone.localtime().isoformat(timespec="seconds"),
        "total_users": first_seen.count(),
        "total_minutes": Event.objects.filter(type=Event.Type.ACTIVE).count(),
        "range_users": len(set().union(*(b["users"] for b in buckets.values()))),
        "accounts": User.objects.count(),
        "series": series,
        "modes": {mode: len(v) for mode, v in modes.items()},
        "units": {str(unit): len(v) for unit, v in sorted(units.items())},
        "devices": {device: len(v) for device, v in devices.items()},
    }


def user_rows(search: str = "", limit: int = 500) -> list[dict]:
    """Accounts for the dashboard's Users tab, newest first."""
    User = get_user_model()
    users = (
        User.objects.select_related("progress")
        .annotate(
            minutes=Count("events", filter=Q(events__type=Event.Type.ACTIVE)),
            last_event=Max("events__created_at"),
        )
        .order_by("-date_joined")
    )
    if search:
        users = users.filter(Q(username__icontains=search) | Q(email__icontains=search) | Q(name__icontains=search))

    def stamp(moment):
        return int(moment.timestamp()) if moment else None

    rows = []
    for user in users[:limit]:
        progress = getattr(user, "progress", None)
        last_active = max(filter(None, [user.last_event, user.last_login]), default=None)
        rows.append(
            {
                "id": user.pk,
                "username": user.username,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "status": "active" if user.is_active else "disabled",
                "created": stamp(user.date_joined),
                "last_login": stamp(user.last_login),
                "last_active": stamp(last_active),
                "minutes": user.minutes,
                "words": progress.words_learned if progress else 0,
                "lessons": progress.lessons_passed if progress else 0,
            }
        )
    return rows
