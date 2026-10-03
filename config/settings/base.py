"""Settings shared by every environment. Environment-specific values come from environment variables
(or a local `.env` file); see `.env.example` for the full list."""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
env.read_env(BASE_DIR / ".env")

# --------------------------------------------------------------------------- core

# SECRET_KEY is set per environment: required from the environment in prod, a fixed value in dev/test.
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "whitenoise.runserver_nostatic",
    "django.contrib.staticfiles",
    "django.contrib.sitemaps",
    "axes",
    "apps.core",
    "apps.accounts",
    "apps.course",
    "apps.analytics",
    "apps.landing",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "apps.core.i18n.LanguageMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Axes must be last so it can turn lockouts raised by the other layers into responses.
    "axes.middleware.AxesMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.core.i18n.language_context",
            ],
        },
    },
]

# --------------------------------------------------------------------------- database

DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DATABASE_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --------------------------------------------------------------------------- authentication

AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = [
    # Axes first: it refuses to authenticate while an address is locked out.
    "axes.backends.AxesStandaloneBackend",
    # Username or email address, plus Django's usual permission checks.
    "apps.accounts.backends.UsernameOrEmailBackend",
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
    # Passwords imported from the pre-Django server; upgraded to Argon2 on the next sign-in.
    "apps.accounts.hashers.LegacyPBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "analytics:dashboard"
LOGOUT_REDIRECT_URL = "landing:index"

SESSION_COOKIE_AGE = timedelta(days=30).total_seconds()
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"

# Login throttling (django-axes): 10 failed attempts per address, then a 15 minute pause.
AXES_FAILURE_LIMIT = 10
AXES_COOLOFF_TIME = timedelta(minutes=15)
AXES_LOCKOUT_PARAMETERS = ["ip_address"]
AXES_RESET_ON_SUCCESS = True
AXES_CLIENT_IP_CALLABLE = "apps.core.utils.client_ip"
AXES_USERNAME_FORM_FIELD = "username"

# Only trust X-Real-IP when a reverse proxy (nginx) that sets it sits in front of Django.
TRUST_PROXY_IP_HEADER = env.bool("DJANGO_TRUST_PROXY_IP_HEADER", default=False)

# --------------------------------------------------------------------------- i18n / time

LANGUAGE_CODE = "en"
TIME_ZONE = env("DJANGO_TIME_ZONE", default="Africa/Addis_Ababa")
USE_I18N = True
USE_TZ = True

# --------------------------------------------------------------------------- static files

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "apps.core.storage.StaticStorage"},
}

# The course builds audio URLs in the browser, so the clips keep their plain names under this prefix.
AUDIO_URL = f"{STATIC_URL}audio/"

# --------------------------------------------------------------------------- site settings

ADMIN_URL = env("DJANGO_ADMIN_URL", default="admin/")

# Google AdSense. Leave ADSENSE_CLIENT empty to show placeholders where the ads will go.
ADSENSE = {
    "enabled": env.bool("ADSENSE_ENABLED", default=True),
    "client": env("ADSENSE_CLIENT", default=""),
    "slots": {
        "top": env("ADSENSE_SLOT_TOP", default=""),
        "sidebar": env("ADSENSE_SLOT_SIDEBAR", default=""),
        "bottom": env("ADSENSE_SLOT_BOTTOM", default=""),
    },
}

# --------------------------------------------------------------------------- logging

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "{asctime} {levelname} {name}: {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": env("DJANGO_LOG_LEVEL", default="INFO"), "propagate": False},
        "axes": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}
