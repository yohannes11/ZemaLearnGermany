import json

from django.test import Client, TestCase, override_settings
from django.urls import reverse

from apps.accounts.models import ApiToken, User
from apps.content.models import TextOverride
from apps.course.models import Progress

PASSWORD = "learning-german-26"


class AppClient(Client):
    """The mobile app: JSON bodies, CSRF checked like a real browser would, and an optional bearer token."""

    def __init__(self, token=None):
        super().__init__(enforce_csrf_checks=True)
        self.token = token

    def call(self, method, url, data=None, **extra):
        if self.token:
            extra["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"
        body = json.dumps(data) if data is not None else ""
        return getattr(self, method)(url, body, content_type="application/json", **extra)


class TokenSignInTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("liya", "liya@example.com", PASSWORD, name="Liya")

    def sign_in(self, password=PASSWORD):
        return AppClient().call(
            "post", reverse("api:token"), {"login": "Liya@Example.com", "password": password, "device": "Pixel 8"}
        )

    def test_sign_in_returns_token_without_csrf_or_session(self):
        response = self.sign_in()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["username"], "liya")
        self.assertNotIn("sessionid", response.cookies)
        token = ApiToken.objects.get()
        self.assertEqual(token.device, "Pixel 8")
        self.assertNotEqual(token.key_hash, response.json()["token"])  # only the hash is stored

    def test_wrong_password(self):
        response = self.sign_in("not-the-password")
        self.assertEqual(response.status_code, 401)
        self.assertFalse(ApiToken.objects.exists())

    def test_token_signs_requests_in_and_skips_csrf(self):
        app = AppClient(self.sign_in().json()["token"])
        self.assertEqual(app.call("get", reverse("api:me")).json()["user"]["username"], "liya")
        response = app.call(
            "put", reverse("api:progress"), {"learned": ["Hallo"], "grammar": {}, "days": ["2026-10-10"]}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Progress.objects.get(user=self.user).days, ["2026-10-10"])

    def test_without_token_writes_need_csrf(self):
        self.assertEqual(AppClient().call("put", reverse("api:progress"), {"learned": []}).status_code, 403)

    def test_unknown_or_disabled_token_is_refused(self):
        self.assertEqual(AppClient("made-up").call("get", reverse("api:me")).status_code, 401)
        token = self.sign_in().json()["token"]
        User.objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(AppClient(token).call("get", reverse("api:me")).status_code, 401)

    def test_sign_out_deletes_only_this_device(self):
        first, second = self.sign_in().json()["token"], self.sign_in().json()["token"]
        self.assertEqual(AppClient(first).call("delete", reverse("api:token")).status_code, 200)
        self.assertEqual(AppClient(first).call("get", reverse("api:me")).status_code, 401)
        self.assertEqual(AppClient(second).call("get", reverse("api:me")).status_code, 200)

    def test_password_change_signs_out_other_devices(self):
        first, second = self.sign_in().json()["token"], self.sign_in().json()["token"]
        response = AppClient(first).call(
            "post", reverse("api:password"), {"current": PASSWORD, "new": "a-new-passphrase-26"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AppClient(first).call("get", reverse("api:me")).status_code, 200)
        self.assertEqual(AppClient(second).call("get", reverse("api:me")).status_code, 401)

    def test_register_returns_token(self):
        data = {"username": "dawit", "name": "Dawit", "email": "dawit@example.com", "password": PASSWORD}
        response = AppClient().call("post", reverse("api:register"), data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            AppClient(response.json()["token"]).call("get", reverse("api:me")).json()["user"]["name"], "Dawit"
        )


class IndexTests(TestCase):
    def test_tells_the_app_where_media_is(self):
        data = self.client.get(reverse("api:index")).json()
        self.assertEqual(data["api"], 1)
        self.assertTrue(data["audio"]["manifest"].startswith("http://testserver/"))
        self.assertIn("katja", data["audio"]["voices"])


@override_settings(TEXT_EDITING_FOR_EVERYONE=False)
class CourseContentTests(TestCase):
    url = reverse("api:course")

    def test_whole_course_with_version_etag(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(len(data["course"]["units"]), 5)
        self.assertIsNone(data["amharic"])
        self.assertEqual(response["ETag"], f'"{data["version"]}"')

    def test_amharic_adds_meanings(self):
        data = self.client.get(self.url, {"lang": "am"}).json()
        self.assertEqual(data["lang"], "am")
        self.assertIn("Hallo!", data["amharic"]["words"])

    def test_not_modified_until_an_admin_publishes(self):
        etag = self.client.get(self.url)["ETag"]
        self.assertEqual(self.client.get(self.url, HTTP_IF_NONE_MATCH=etag).status_code, 304)

        TextOverride.objects.create(source="Hello!", text="Hi there!")
        response = self.client.get(self.url, HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["texts"], {"Hello!": "Hi there!"})
        self.assertNotEqual(response["ETag"], etag)


class WhyGermanTests(TestCase):
    def test_figures_with_sources_and_pictures(self):
        data = self.client.get(reverse("api:why-german")).json()
        self.assertTrue(all(stat["source"]["url"].startswith("https://") for stat in data["stats"]))
        study = next(path for path in data["paths"] if path["key"] == "study")
        self.assertTrue(study["image"]["url"].endswith("library-720.jpg"))
        self.assertIn("CC BY", study["image"]["credit"])
        self.assertEqual([data["stats"][i]["display"] for i in study["stats"]], ["402,000", "€0"])

    def test_amharic(self):
        self.assertEqual(self.client.get(reverse("api:why-german"), {"lang": "am"}).json()["lang"], "am")
