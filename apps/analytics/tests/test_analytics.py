import io
import json
import sqlite3
import tempfile
from datetime import timedelta
from pathlib import Path

from django.core.management import CommandError, call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.accounts.hashers import LegacyPBKDF2PasswordHasher
from apps.accounts.models import User
from apps.analytics.models import Event
from apps.analytics.reports import bucket_start, usage_report

PASSWORD = "learning-german-26"


def post_json(client, url, data, **extra):
    return client.post(url, json.dumps(data), content_type="application/json", **extra)


def event(**fields):
    defaults = {"visitor_id": "visitor-0001", "session_id": "session-0001", "type": Event.Type.VIEW}
    return Event.objects.create(**{**defaults, **fields})


class EventApiTests(TestCase):
    url = reverse("analytics:events")

    def test_records_valid_event(self):
        response = post_json(
            self.client,
            self.url,
            {
                "uid": "abcdef12-3456",
                "sid": "sess1234-5678",
                "type": "view",
                "unit": 3,
                "mode": "speak",
                "scope": "3.1",
            },
            HTTP_USER_AGENT="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
        )
        self.assertEqual(response.status_code, 204)
        recorded = Event.objects.get()
        self.assertEqual((recorded.unit, recorded.mode, recorded.device), (3, "speak", "phone"))
        self.assertIsNone(recorded.user)

    def test_links_signed_in_user(self):
        user = User.objects.create_user("liya", "liya@example.com", PASSWORD, name="Liya")
        self.client.force_login(user)
        post_json(self.client, self.url, {"uid": "abcdef12-3456", "sid": "sess1234-5678", "type": "active"})
        self.assertEqual(Event.objects.get().user, user)

    def test_rejects_invalid_events(self):
        for bad in (
            {"uid": "<script>", "sid": "sess1234-5678", "type": "view"},
            {"uid": "abcdef12-3456", "sid": "sess1234-5678", "type": "hack"},
            {"uid": "abcdef12-3456", "sid": "sess1234-5678", "type": "view", "unit": 99},
        ):
            self.assertEqual(post_json(self.client, self.url, bad).status_code, 400)
        self.assertFalse(Event.objects.exists())


class ReportTests(TestCase):
    def test_counts_per_day(self):
        now = timezone.now()
        event(type=Event.Type.SESSION)
        event(type=Event.Type.VIEW, mode="learn", unit=2)
        event(type=Event.Type.ACTIVE)
        event(type=Event.Type.ACTIVE)
        event(visitor_id="visitor-0002", session_id="session-0002", created_at=now - timedelta(days=1))
        event(visitor_id="visitor-0002", session_id="session-0003", type=Event.Type.GRAMMAR, value=7)
        User.objects.create_user("liya", "liya@example.com", PASSWORD, name="Liya")

        report = usage_report("day")
        today, yesterday = report["series"][-1], report["series"][-2]
        self.assertEqual(len(report["series"]), 30)
        self.assertEqual((today["users"], today["new_users"], today["returning_users"]), (2, 1, 1))
        self.assertEqual(
            (today["sessions"], today["minutes"], today["grammar_quizzes"], today["signups"]), (2, 2, 1, 1)
        )
        self.assertEqual((yesterday["users"], yesterday["new_users"]), (1, 1))
        self.assertEqual(report["modes"], {"learn": 1})
        self.assertEqual(report["units"], {"2": 1})
        self.assertEqual(report["total_users"], 2)

    def test_bucket_starts(self):
        day = timezone.localdate().replace(year=2026, month=9, day=30)  # a Wednesday
        self.assertEqual(bucket_start(day, "week").isoformat(), "2026-09-28")
        self.assertEqual(bucket_start(day, "month").isoformat(), "2026-09-01")
        self.assertEqual(bucket_start(day, "year").isoformat(), "2026-01-01")


class DashboardAccessTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", "admin@example.com", PASSWORD, name="Jo Admin", is_staff=True)
        self.learner = User.objects.create_user("liya", "liya@example.com", PASSWORD, name="Liya")

    def test_page_redirects_signed_out_visitors_to_login(self):
        response = self.client.get(reverse("analytics:dashboard"))
        self.assertRedirects(response, f"{reverse('login')}?next={reverse('analytics:dashboard')}")

    def test_page_forbidden_for_learners(self):
        self.client.force_login(self.learner)
        self.assertEqual(self.client.get(reverse("analytics:dashboard")).status_code, 403)

    def test_page_and_api_for_admins(self):
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(reverse("analytics:dashboard")).status_code, 200)
        self.assertEqual(self.client.get(reverse("analytics:stats"), {"period": "week"}).json()["period"], "week")
        csv_response = self.client.get(reverse("analytics:stats-csv"), {"period": "month"})
        self.assertTrue(csv_response.content.decode().startswith("start,label,users"))
        emails = [u["email"] for u in self.client.get(reverse("analytics:users")).json()["users"]]
        self.assertCountEqual(emails, ["admin@example.com", "liya@example.com"])

    def test_api_refuses_non_admins(self):
        self.assertEqual(self.client.get(reverse("analytics:stats")).status_code, 401)
        self.client.force_login(self.learner)
        self.assertEqual(self.client.get(reverse("analytics:stats")).status_code, 403)
        self.assertEqual(self.client.get(reverse("analytics:users")).status_code, 403)

    def test_login_page_signs_admin_in(self):
        response = self.client.post(reverse("login"), {"username": "admin@example.com", "password": PASSWORD})
        self.assertRedirects(response, reverse("analytics:dashboard"))


class UserActionTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", "admin@example.com", PASSWORD, name="Jo Admin", is_staff=True)
        self.learner = User.objects.create_user("liya", "liya@example.com", PASSWORD, name="Liya")
        self.client.force_login(self.admin)

    def act(self, user, action):
        return post_json(self.client, reverse("analytics:user-action", args=[user.pk]), {"action": action})

    def test_cannot_remove_own_admin_rights(self):
        for action in ("delete", "disable", "make_learner"):
            self.assertEqual(self.act(self.admin, action).status_code, 400)

    def test_keeps_at_least_one_admin(self):
        other = User.objects.create_user("boss", "boss@example.com", PASSWORD, name="Boss", is_staff=True)
        self.assertEqual(self.act(other, "make_learner").status_code, 200)
        self.client.force_login(other)  # other is no longer staff
        self.assertEqual(self.act(self.admin, "disable").status_code, 403)

    def test_disable_and_enable(self):
        self.act(self.learner, "disable")
        self.learner.refresh_from_db()
        self.assertFalse(self.learner.is_active)
        self.act(self.learner, "enable")
        self.learner.refresh_from_db()
        self.assertTrue(self.learner.is_active)

    def test_reset_password_returns_working_temporary_password(self):
        temporary = self.act(self.learner, "reset_password").json()["temporary_password"]
        self.learner.refresh_from_db()
        self.assertTrue(self.learner.check_password(temporary))

    def test_delete_keeps_usage_anonymously(self):
        event(user=self.learner)
        self.act(self.learner, "delete")
        self.assertFalse(User.objects.filter(pk=self.learner.pk).exists())
        self.assertIsNone(Event.objects.get().user)

    def test_unknown_action(self):
        self.assertEqual(self.act(self.learner, "explode").status_code, 400)


class ImportLegacyUsageTests(TestCase):
    def make_legacy_db(self, folder):
        path = Path(folder) / "usage.db"
        db = sqlite3.connect(path)
        db.executescript("""
            CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT, password TEXT, role TEXT, status TEXT,
                                created INTEGER, last_login INTEGER, progress TEXT, progress_updated INTEGER);
            CREATE TABLE events (id INTEGER PRIMARY KEY, ts INTEGER, uid TEXT, sid TEXT, type TEXT, unit INTEGER,
                                 mode TEXT, scope TEXT, value INTEGER, device TEXT, user_id INTEGER);
        """)
        salt = "00112233445566778899aabbccddeeff"
        legacy = (
            LegacyPBKDF2PasswordHasher().encode(PASSWORD, salt, 1000).replace("legacy_pbkdf2_sha256", "pbkdf2_sha256")
        )
        db.execute(
            "INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)",
            (
                1,
                "old@example.com",
                "Old Admin",
                legacy,
                "admin",
                "active",
                1759000000,
                json.dumps({"learned": ["Hallo"], "grammar": {"g2-sein": 7}}),
            ),
        )
        db.execute(
            "INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
            (1, 1759000000, "visitor-0001", "session-0001", "view", 2, "learn", "2.1", "phone", 1),
        )
        db.commit()
        db.close()
        return path

    def test_imports_users_progress_and_events(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.make_legacy_db(folder)
            call_command("import_legacy_usage", path, stdout=io.StringIO())
            user = User.objects.get(email="old@example.com")
            self.assertEqual(user.username, "old")
            self.assertTrue(user.is_staff)
            self.assertTrue(user.check_password(PASSWORD))
            self.assertEqual(user.progress.learned, ["Hallo"])
            self.assertEqual(Event.objects.get().user, user)
            with self.assertRaises(CommandError):
                call_command("import_legacy_usage", path)  # a second import would count events twice
