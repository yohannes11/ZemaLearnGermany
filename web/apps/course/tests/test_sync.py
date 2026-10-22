import json
from pathlib import Path
from unittest import mock

from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.accounts.tokens import issue_token
from apps.course import sync
from apps.course.models import Progress, ProgressEvent

CASES = json.loads((Path(__file__).parent / "sync_cases.json").read_text())["cases"]
NOW_MS = 1_760_000_000_000


def op(op_id, kind, at=NOW_MS, day="2026-10-10", **fields):
    return {"id": op_id, "kind": kind, "at": at, "day": day, **fields}


class SharedCasesTests(TestCase):
    """The conflict rules, from the cases the app's implementation is checked against too."""

    def test_cases(self):
        for number, case in enumerate(CASES):
            with self.subTest(case["name"]):
                user = User.objects.create_user(
                    f"case{number}", f"case{number}@example.com", "x-password-26", name="Case"
                )
                for batch in case["arrivals"]:
                    sync.sync(user, [{**o, "at": o["at"] + NOW_MS} for o in batch])
                progress = Progress.objects.get(user=user)
                snapshot = progress.snapshot()
                for field, expected in case["expect"].items():
                    actual = snapshot[field]
                    if field == "learned":
                        actual, expected = sorted(actual), sorted(expected)
                    elif field == "goals":
                        actual = [[day, xp] for day, _at, xp, _id in actual]
                    elif field == "srs":
                        actual = {w: {"box": e["box"], "due": e["due"]} for w, e in actual.items()}
                    elif field == "session" and actual is not None:
                        actual = {k: v for k, v in actual.items() if k not in {"at", "id"}}
                    self.assertEqual(actual, expected)


class SyncRulesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("liya", "liya@example.com", "learning-german-26", name="Liya")

    def test_a_bad_operation_applies_nothing(self):
        good = op("1", "xp", amount=10)
        for bad in (
            op("2", "xp", amount=0),
            op("3", "nonsense"),
            {"kind": "xp"},
            op("4", "word", german="", learned=True),
        ):
            with self.subTest(bad=bad), self.assertRaises(sync.BadOperation):
                sync.sync(self.user, [good, bad])
        self.assertFalse(ProgressEvent.objects.exists())

    def test_revision_only_moves_on_a_real_change(self):
        progress, changed = sync.sync(self.user, [op("1", "word", german="Hallo!", learned=True)])
        self.assertTrue(changed)
        self.assertEqual(progress.revision, 1)
        # The same operation again (a retry), and a word already in that state: nothing changes.
        progress, changed = sync.sync(self.user, [op("1", "word", german="Hallo!", learned=True)])
        self.assertFalse(changed)
        progress, changed = sync.sync(self.user, [op("0", "word", at=NOW_MS - 5, german="Hallo!", learned=False)])
        self.assertFalse(changed)
        self.assertEqual((progress.revision, progress.learned), (1, ["Hallo!"]))

    def test_a_fast_device_clock_cant_win_forever(self):
        far_future = 10**13 * 9
        sync.sync(self.user, [op("1", "word", at=far_future, german="Hallo!", learned=True)])
        stored_at = Progress.objects.get(user=self.user).word_log["Hallo!"][1]
        self.assertLess(stored_at, far_future)

    def test_session_fields_are_checked(self):
        with self.assertRaises(sync.BadOperation):
            sync.sync(self.user, [op("1", "session", session={"kind": "game", "ref": "x"})])
        with self.assertRaises(sync.BadOperation):
            sync.sync(self.user, [op("1", "session", session={"kind": "quiz", "ref": "g1", "items": list(range(61))})])


class SyncEndpointTests(TestCase):
    url = reverse("api:sync")

    def setUp(self):
        self.user = User.objects.create_user("liya", "liya@example.com", "learning-german-26", name="Liya")
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {issue_token(self.user)}"}

    def post(self, data, **extra):
        return self.client.post(self.url, json.dumps(data), content_type="application/json", **{**self.auth, **extra})

    def test_requires_sign_in(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_applies_and_answers_with_the_whole_state(self):
        with mock.patch("apps.realtime.notify._send") as send, self.captureOnCommitCallbacks(execute=True):
            response = self.post(
                {"ops": [op("1", "word", german="Hallo!", learned=True), op("2", "xp", amount=10)], "device": "phone-1"}
            )
        data = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            (data["learned"], data["xp"], data["revision"], data["session"]), (["Hallo!"], {"2026-10-10": 10}, 1, None)
        )
        send.assert_called_once_with(f"user-{self.user.pk}", {"type": "progress", "revision": 1, "origin": "phone-1"})

    def test_nothing_new_tells_nobody(self):
        self.post({"ops": [op("1", "xp", amount=10)]})
        with mock.patch("apps.realtime.notify._send") as send, self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.post({"ops": [op("1", "xp", amount=10)]}).json()["xp"], {"2026-10-10": 10})
        send.assert_not_called()

    def test_bad_operation_is_a_400(self):
        response = self.post({"ops": [op("1", "xp", amount=-3)]})
        self.assertEqual(response.status_code, 400)
        self.assertIn("xp", response.json()["error"])

    def test_website_session_works_too_with_csrf(self):
        client = self.client_class(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(client.post(self.url, "{}", content_type="application/json").status_code, 403)
        self.assertEqual(client.get(self.url).status_code, 200)

    def test_website_upload_and_app_operations_meet_in_one_state(self):
        self.client.force_login(self.user)
        self.client.put(
            reverse("course:progress"),
            json.dumps({"learned": ["Hallo!"], "grammar": {"g1": 5}}),
            content_type="application/json",
        )
        data = self.post(
            {"ops": [op("1", "score", lesson="g1", score=7), op("2", "word", german="Danke", learned=True)]}
        ).json()
        self.assertEqual((sorted(data["learned"]), data["grammar"]), (["Danke", "Hallo!"], {"g1": 7}))
