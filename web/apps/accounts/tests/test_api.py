import json

from django.test import Client, TestCase
from django.urls import reverse

from apps.accounts.hashers import LegacyPBKDF2PasswordHasher
from apps.accounts.models import User
from apps.accounts.validators import unique_username, username_base

PASSWORD = "learning-german-26"


def post_json(client, url, data):
    return client.post(url, json.dumps(data), content_type="application/json")


class RegistrationTests(TestCase):
    url = reverse("accounts:register")

    def register(self, **fields):
        data = {"username": "liya_t", "name": "Liya Tesfaye", "email": "liya@example.com", "password": PASSWORD}
        return post_json(self.client, self.url, {**data, **fields})

    def test_creates_account_and_signs_in(self):
        response = self.register(email="Liya@Example.com")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["username"], "liya_t")
        self.assertEqual(response.json()["user"]["role"], "learner")
        user = User.objects.get()
        self.assertEqual(user.email, "Liya@example.com")
        self.assertEqual(int(self.client.session["_auth_user_id"]), user.pk)

    def test_rejects_taken_username_in_any_case(self):
        User.objects.create_user("Liya_T", "other@example.com", PASSWORD, name="Other")
        response = self.register()
        self.assertEqual(response.status_code, 400)
        self.assertIn("username is taken", response.json()["error"])

    def test_rejects_invalid_usernames(self):
        for username in ("ab", "liya@home", "-liya", "liya tesfaye", "x" * 31):
            response = self.register(username=username)
            self.assertEqual(response.status_code, 400, username)
        self.assertFalse(User.objects.exists())

    def test_rejects_duplicate_email_in_any_case(self):
        User.objects.create_user("liya", "liya@example.com", PASSWORD, name="Liya")
        response = self.register(username="liya2", email="LIYA@example.com")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already exists", response.json()["error"])

    def test_rejects_weak_password(self):
        self.assertEqual(self.register(password="12345678").status_code, 400)
        self.assertFalse(User.objects.exists())

    def test_rejects_bad_json(self):
        response = self.client.post(self.url, "not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_requires_csrf_token(self):
        client = Client(enforce_csrf_checks=True)
        response = post_json(client, self.url, {"username": "liya", "name": "Liya", "email": "l@example.com"})
        self.assertEqual(response.status_code, 403)


class LoginTests(TestCase):
    url = reverse("accounts:login")

    def setUp(self):
        self.user = User.objects.create_user("marta_b", "marta@example.com", PASSWORD, name="Marta Bekele")

    def sign_in(self, login, password=PASSWORD):
        return post_json(self.client, self.url, {"login": login, "password": password})

    def test_signs_in_with_username_in_any_case(self):
        response = self.sign_in("Marta_B")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["username"], "marta_b")

    def test_signs_in_with_email_in_any_case(self):
        response = self.sign_in("MARTA@example.com")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["email"], "marta@example.com")

    def test_wrong_password_or_unknown_name(self):
        self.assertEqual(self.sign_in("marta_b", "wrong-password").status_code, 401)
        self.assertEqual(self.sign_in("nobody").status_code, 401)
        self.assertEqual(self.sign_in("nobody@example.com").status_code, 401)

    def test_disabled_account_gets_explanation(self):
        self.user.is_active = False
        self.user.save()
        response = self.sign_in("marta_b")
        self.assertEqual(response.status_code, 403)
        self.assertIn("disabled", response.json()["error"])

    def test_locks_out_after_ten_failures(self):
        for _ in range(10):
            self.sign_in("marta_b", "wrong-password")
        self.assertEqual(self.sign_in("marta_b").status_code, 429)

    def test_me_and_logout(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse("accounts:me")).json()["user"]["name"], "Marta Bekele")
        self.assertEqual(post_json(self.client, reverse("accounts:logout"), {}).status_code, 200)
        self.assertIsNone(self.client.get(reverse("accounts:me")).json()["user"])

    def test_login_page_accepts_username_and_email(self):
        for login in ("marta_b", "marta@example.com"):
            client = Client()
            response = client.post(reverse("login"), {"username": login, "password": PASSWORD})
            self.assertEqual(response.status_code, 302, login)


class PasswordChangeTests(TestCase):
    url = reverse("accounts:password")

    def setUp(self):
        self.user = User.objects.create_user("marta", "marta@example.com", PASSWORD, name="Marta")

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
        user = User.objects.create(username="old", email="old@example.com", name="Old", password=encoded)
        response = post_json(self.client, reverse("accounts:login"), {"login": "old", "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertFalse(user.password.startswith("legacy_"), "the password should be re-hashed on sign-in")


class UsernameSuggestionTests(TestCase):
    def test_base_from_email(self):
        self.assertEqual(username_base("Marta.B+de@example.com"), "Marta.Bde")
        self.assertEqual(username_base("jo@example.com"), "jouser")
        self.assertEqual(username_base("_x@example.com"), "xuser")

    def test_unique_adds_a_number(self):
        self.assertEqual(unique_username("marta@example.com", {"marta", "marta2"}), "marta3")
