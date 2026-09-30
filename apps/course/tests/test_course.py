import json

from django.test import TestCase, override_settings
from django.urls import reverse

from apps.accounts.models import User
from apps.course.models import Progress


class CoursePageTests(TestCase):
    def test_renders_with_config_and_csrf_cookie(self):
        response = self.client.get(reverse("course:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="app-config"')
        self.assertContains(response, "course/js/course.js")
        self.assertIn("csrftoken", response.cookies)
        config = response.context["app_config"]
        self.assertEqual(config["api"]["progress"], reverse("course:progress"))
        self.assertTrue(config["audioBase"].endswith("/audio/"))

    def test_old_address_redirects(self):
        response = self.client.get("/german-a1-course.html")
        self.assertRedirects(response, reverse("course:index"), status_code=301)


class ProgressMergeTests(TestCase):
    def test_merge_keeps_both_and_best_scores(self):
        progress = Progress(learned=["Hallo"], grammar={"g2-sein": 7})
        progress.merge(["der Name"], {"g2-sein": 5, "g3-plural": 8})
        self.assertEqual(progress.learned, ["Hallo", "der Name"])
        self.assertEqual(progress.grammar, {"g2-sein": 7, "g3-plural": 8})

    def test_replace_drops_unmarked_words(self):
        progress = Progress(learned=["Hallo", "der Name"], grammar={})
        progress.merge(["der Name"], {}, replace=True)
        self.assertEqual(progress.learned, ["der Name"])

    def test_ignores_malformed_values(self):
        progress = Progress()
        progress.merge(["ok", 5, None], {"g": "high", "h": 999, "i": 3})
        self.assertEqual(progress.learned, ["ok"])
        self.assertEqual(progress.grammar, {"i": 3})


class ProgressApiTests(TestCase):
    url = reverse("course:progress")

    def setUp(self):
        self.user = User.objects.create_user("liya@example.com", "learning-german-26", name="Liya")

    def put(self, data):
        return self.client.put(self.url, json.dumps(data), content_type="application/json")

    def test_requires_sign_in(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.put({"learned": [], "grammar": {}}).status_code, 401)

    def test_sync_round_trip(self):
        self.client.force_login(self.user)
        self.put({"learned": ["Hallo", "Tschüss"], "grammar": {"g2-sein": 7}})
        response = self.put({"learned": ["der Name"], "grammar": {}, "replace": True})
        self.assertEqual(response.json(), {"learned": ["der Name"], "grammar": {"g2-sein": 7}})
        self.assertEqual(self.client.get(self.url).json()["learned"], ["der Name"])

    def test_rejects_wrong_shapes(self):
        self.client.force_login(self.user)
        self.assertEqual(self.put({"learned": "Hallo", "grammar": {}}).status_code, 400)


class CoreTests(TestCase):
    def test_healthz(self):
        self.assertEqual(self.client.get(reverse("core:healthz")).content, b"ok")

    @override_settings(ADSENSE={"enabled": True, "client": "ca-pub-123", "slots": {}})
    def test_ads_txt_from_settings(self):
        response = self.client.get("/ads.txt")
        self.assertEqual(response.content.decode(), "google.com, pub-123, DIRECT, f08c47fec0942fa0\n")
