"""Small helpers shared by the apps."""

import json

from django.conf import settings
from django.http import HttpRequest, JsonResponse


def client_ip(request: HttpRequest) -> str:
    """The visitor's address. Behind nginx every request comes from 127.0.0.1, so the proxy's
    X-Real-IP header is used, but only when settings say a trusted proxy sets it."""
    if settings.TRUST_PROXY_IP_HEADER:
        forwarded = request.META.get("HTTP_X_REAL_IP", "").strip()
        if forwarded:
            return forwarded
    return request.META.get("REMOTE_ADDR", "")


class BadJSON(ValueError):
    """The request body is not a JSON object."""


def read_json(request: HttpRequest, max_bytes: int = 4096) -> dict:
    if len(request.body) > max_bytes:
        raise BadJSON("Request body too large.")
    try:
        data = json.loads(request.body or b"{}")
    except ValueError as exc:
        raise BadJSON("Request body is not valid JSON.") from exc
    if not isinstance(data, dict):
        raise BadJSON("Request body must be a JSON object.")
    return data


def json_error(message: str, status: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def form_error(form) -> JsonResponse:
    """The first validation message of a bound, invalid form, as a 400 response."""
    for errors in form.errors.values():
        return json_error(errors[0], 400)
    return json_error("Please check your input.", 400)
