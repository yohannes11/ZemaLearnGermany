"""Test run: `python manage.py test` (picked automatically by manage.py)."""

from .base import *  # noqa: F403

SECRET_KEY = "test-only-secret-key"  # noqa: S105
DEBUG = False
ALLOWED_HOSTS = ["testserver"]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}

# A fast hasher keeps the test run quick; production uses Argon2.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
    "apps.accounts.hashers.LegacyPBKDF2PasswordHasher",
]

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

AXES_ENABLED = True

# Tests trigger 4xx responses on purpose; don't print a warning for each one.
LOGGING = {"version": 1, "disable_existing_loggers": False, "root": {"level": "CRITICAL"}}
