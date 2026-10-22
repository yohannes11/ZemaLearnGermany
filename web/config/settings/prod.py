"""Production behind nginx with HTTPS. Every secret and host name comes from the environment."""

from .base import *  # noqa: F403
from .base import env

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = False

# nginx terminates TLS and forwards the original scheme and client address.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
TRUST_PROXY_IP_HEADER = env.bool("DJANGO_TRUST_PROXY_IP_HEADER", default=True)

SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Start with a short HSTS time and raise it (e.g. to 31536000) once HTTPS is confirmed working.
SECURE_HSTS_SECONDS = env.int("DJANGO_SECURE_HSTS_SECONDS", default=3600)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", default=False)
SECURE_HSTS_PRELOAD = env.bool("DJANGO_SECURE_HSTS_PRELOAD", default=False)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

SILENCED_SYSTEM_CHECKS = env.list(
    "DJANGO_SILENCED_SYSTEM_CHECKS",
    # W005/W021: subdomains and preload are opt-in because they are hard to undo for a domain.
    default=["security.W005", "security.W021"],
)
