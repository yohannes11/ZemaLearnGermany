"""Import accounts, progress and usage events from the pre-Django server's usage.db."""

import json
import sqlite3
from datetime import datetime
from datetime import timezone as dt_timezone
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.validators import unique_username
from apps.analytics.models import Event
from apps.course.models import Progress


def aware(ts):
    return datetime.fromtimestamp(ts, tz=dt_timezone.utc) if ts else None


class Command(BaseCommand):
    help = "Import users, progress and usage events from the old server's usage.db into an empty database."

    def add_arguments(self, parser):
        parser.add_argument("path", type=Path, help="Path to the old usage.db")

    @transaction.atomic
    def handle(self, *args, path, **options):
        if not path.exists():
            raise CommandError(f"{path} does not exist.")
        if Event.objects.exists():
            raise CommandError("There are already usage events; importing again would count them twice.")
        source = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        source.row_factory = sqlite3.Row
        tables = {row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}

        User = get_user_model()
        user_ids = {}
        taken = {name.lower() for name in User.objects.values_list("username", flat=True)}
        created = skipped = 0
        if "users" in tables:
            for row in source.execute("SELECT * FROM users ORDER BY id"):
                existing = User.objects.filter(email__iexact=row["email"]).first()
                if existing:
                    user_ids[row["id"]] = existing.pk
                    skipped += 1
                    continue
                username = unique_username(row["email"], taken)
                taken.add(username.lower())
                user = User(
                    username=username,
                    email=row["email"],
                    name=row["name"],
                    # Old hashes keep working through the legacy hasher and are upgraded at next sign-in.
                    password=row["password"].replace("pbkdf2_sha256$", "legacy_pbkdf2_sha256$", 1),
                    is_staff=row["role"] == "admin",
                    is_active=row["status"] == "active",
                    date_joined=aware(row["created"]),
                    last_login=aware(row["last_login"]),
                )
                user.save()
                user_ids[row["id"]] = user.pk
                created += 1
                if row["progress"]:
                    data = json.loads(row["progress"])
                    progress = Progress(user=user)
                    progress.merge(data.get("learned") or [], data.get("grammar") or {})
                    progress.save()

        batch = []
        for row in source.execute("SELECT * FROM events ORDER BY id"):
            batch.append(
                Event(
                    created_at=aware(row["ts"]),
                    visitor_id=row["uid"],
                    session_id=row["sid"],
                    type=row["type"],
                    unit=row["unit"],
                    mode=row["mode"] or "",
                    scope=row["scope"] or "",
                    value=row["value"],
                    device=row["device"] or Event.Device.DESKTOP,
                    # sqlite3.Row: `in row` would search the values, so check the column names.
                    user_id=user_ids.get(row["user_id"]) if "user_id" in row.keys() else None,  # noqa: SIM118
                )
            )
        Event.objects.bulk_create(batch, batch_size=2000)
        source.close()

        self.stdout.write(
            self.style.SUCCESS(f"Imported {created} users ({skipped} already existed) and {len(batch)} usage events.")
        )
