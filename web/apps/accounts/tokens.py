"""Sign-in for the mobile app: bearer tokens instead of session cookies.

The app sends `Authorization: Bearer <token>` with every request. The middleware turns a valid token into
request.user, so every JSON view works for both the web (session + CSRF) and the app (token). Bearer requests
skip the CSRF check: a browser never adds that header on its own, so another site can't forge one.
"""

import hashlib
import secrets
from datetime import timedelta

from django.utils import timezone

from apps.core.utils import json_error

from .models import ApiToken

LAST_USED_GRANULARITY = timedelta(hours=1)


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def issue_token(user, device: str = "") -> str:
    """A new token for `user`; the plain key is only ever returned here."""
    key = secrets.token_urlsafe(32)
    ApiToken.objects.create(user=user, key_hash=hash_key(key), device=device.strip()[:80])
    return key


def bearer_key(request) -> str | None:
    scheme, _, key = request.META.get("HTTP_AUTHORIZATION", "").partition(" ")
    return key.strip() if scheme.lower() == "bearer" and key.strip() else None


class BearerTokenMiddleware:
    """After AuthenticationMiddleware: a request with a bearer token is that token's user, or a 401."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        key = bearer_key(request)
        if key is None:
            return self.get_response(request)
        token = ApiToken.objects.select_related("user").filter(key_hash=hash_key(key)).first()
        if token is None or not token.user.is_active:
            return json_error("Your sign-in has expired. Please sign in again.", 401)
        now = timezone.now()
        if token.last_used is None or now - token.last_used > LAST_USED_GRANULARITY:
            ApiToken.objects.filter(pk=token.pk).update(last_used=now)
        request.user = token.user
        request.api_token = token
        request._dont_enforce_csrf_checks = True
        return self.get_response(request)
