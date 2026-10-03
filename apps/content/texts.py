"""Text changes on every page: applied while rendering, and handed to the page's script with the editor's
settings. See apps/core/i18n.py for how {% t %} applies them and static/core/js/zema-text.js for the rest."""

from functools import cache

from django.conf import settings
from django.middleware.csrf import get_token
from django.urls import reverse

from apps.core.i18n import DEFAULT_LANGUAGE, placeholder_texts, text_overrides

from .models import published_texts


def can_edit_text(user) -> bool:
    """Admins; everyone while settings.TEXT_EDITING_FOR_EVERYONE is on."""
    if settings.TEXT_EDITING_FOR_EVERYONE:
        return True
    return bool(user and user.is_authenticated and user.is_staff)


class TextOverridesMiddleware:
    """Makes the published text changes available to `translate` for this request, read at most once."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = text_overrides.set(cache(published_texts))
        try:
            return self.get_response(request)
        finally:
            text_overrides.reset(token)


def text_context(request):
    """`zema_text` for base.html: the page's text changes and, for admins, the editor's settings. None when
    there is nothing to change and nobody to edit, so visitors then load no extra script."""
    load = text_overrides.get()
    texts = load() if load else published_texts()
    can_edit = can_edit_text(getattr(request, "user", None))
    if not texts and not can_edit:
        return {"zema_text": None}
    if can_edit:
        get_token(request)  # publishing needs the CSRF cookie, which not every page sets
    lang = getattr(request, "LANG", DEFAULT_LANGUAGE)
    return {
        "zema_text": {
            "texts": texts,
            "templates": placeholder_texts(lang),
            "canEdit": can_edit,
            "api": reverse("content:texts") if can_edit else None,
        }
    }
