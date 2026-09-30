import json

from django.test import Client, TestCase
from django.urls import reverse

from apps.accounts.hashers import LegacyPBKDF2PasswordHasher
from apps.accounts.models import User

PASSWORD = "learning-german-26"


def post_json(client, url, data):
    return client.post(url, json.dumps(data), content_type="application/json")


class RegistrationTests(TestCase):
    url = reverse("accounts:register")

    def test_creates_account_and_signs_in(self):
        response = post_json(
            self.client, self.url, {"name": "Liya Tesfaye", "email": "Liya@Example.com", "password": PASSWORD}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["role"], "learner")
        user = User.objects.get()
        self.assertEqual(user.email, "Liya@example.com")
        self.assertEqual(int(self.client.session["_auth_user_id"]), user.pk)

    def test_rejects_duplicate_email_in_any_case(self):
        User.objects.create_user("liya@example.com", PASSWORD, name="Liya")
        response = post_json(self.client, self.url, {"name": "L", "email": "LIYA@example.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 400)
        self.assertIn("already exists", response.json()["error"])

    def test_rejects_weak_password(self):
        response = post_json(
            self.client, self.url, {"name": "Liya", "email": "liya@example.com", "password": "12345678"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.exists())

    def test_rejects_bad_json(self):
        response = self.client.post(self.url, "not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_requires_csrf_token(self):
        client = Client(enforce_csrf_checks=True)
        response = post_json(client, self.url, {"name": "Liya", "email": "liya@example.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 403)


class LoginTests(TestCase):
    url = reverse("accounts:login")

    def setUp(self):
        self.user = User.objects.create_user("marta@example.com", PASSWORD, name="Marta Bekele")

    def test_signs_in_with_email_in_any_case(self):
        response = post_json(self.client, self.url, {"email": "MARTA@example.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["email"], "marta@example.com")

    def test_wrong_password(self):
        response = post_json(self.client, self.url, {"email": "marta@example.com", "password": "wrong-password"})
        self.assertEqual(response.status_code, 401)

    def test_disabled_account_gets_explanation(self):
        self.user.is_active = False
        self.user.save()
        response = post_json(self.client, self.url, {"email": "marta@example.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 403)
        self.assertIn("disabled", response.json()["error"])

    def test_locks_out_after_ten_failures(self):
        for _ in range(10):
            post_json(self.client, self.url, {"email": "marta@example.com", "password": "wrong-password"})
        response = post_json(self.client, self.url, {"email": "marta@example.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 429)

    def test_me_and_logout(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse("accounts:me")).json()["user"]["name"], "Marta Bekele")
        self.assertEqual(post_json(self.client, reverse("accounts:logout"), {}).status_code, 200)
        self.assertIsNone(self.client.get(reverse("accounts:me")).json()["user"])


class PasswordChangeTests(TestCase):
    url = reverse("accounts:password")

    def setUp(self):
        self.user = User.objects.create_user("marta@example.com", PASSWORD, name="Marta")

    def test_requires_sign_in(self):
        self.assertEqual(
            post_json(self.client, self.url, {"current": PASSWORD, "new": "another-pass-99"}).status_code, 401
        )

    def test_changes_password_and_keeps_session(self):
        self.client.force_login(self.user)
        response = post_json(self.client, self.url, {"current": PASSWORD, "new": "another-pass-99"})
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("another-pass-99"))
        self.assertIsNotNone(self.client.get(reverse("accounts:me")).json()["user"])

    def test_wrong_current_password(self):
        self.client.force_login(self.user)
        response = post_json(self.client, self.url, {"current": "nope-nope", "new": "another-pass-99"})
        self.assertEqual(response.status_code, 400)


class LegacyHasherTests(TestCase):
    def test_old_server_hash_verifies_and_upgrades(self):
        encoded = LegacyPBKDF2PasswordHasher().encode(PASSWORD, "00112233445566778899aabbccddeeff", 1000)
        user = User.objects.create(email="old@example.com", name="Old", password=encoded)
        response = post_json(self.client, reverse("accounts:login"), {"email": "old@example.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertFalse(user.password.startswith("legacy_"), "the password should be re-hashed on sign-in")
