"""The interface in English or Amharic.

English text is the key: locale/am.json maps each English string to its Amharic translation, in two
sections. "site" holds the pages Django renders (landing page, sign-in, errors); "course" holds what the
course app's JavaScript shows, and is sent to the browser with the course page. A string without a
translation falls back to English, and `manage.py i18n_missing` lists what still needs translating.
Placeholders such as {count} are filled in after translation, so they must appear in both languages.
"""

import json
import re
from pathlib import Path

from django.conf import settings
from django.utils.cache import patch_vary_headers

LANGUAGES = {"en": "English", "am": "አማርኛ"}
DEFAULT_LANGUAGE = "en"
COOKIE = "zema_lang"
LOCALE_DIR = Path(settings.BASE_DIR) / "locale"
PLACEHOLDER = re.compile(r"\{(\w+)\}")

_catalogs: dict[str, tuple[float, dict]] = {}


def catalog(lang: str) -> dict:
    """{"site": {...}, "course": {...}} for a language; re-read when the file changes."""
    path = LOCALE_DIR / f"{lang}.json"
    if lang == DEFAULT_LANGUAGE or not path.exists():
        return {"site": {}, "course": {}}
    mtime = path.stat().st_mtime
    cached = _catalogs.get(lang)
    if not cached or cached[0] != mtime:
        cached = (mtime, json.loads(path.read_text(encoding="utf-8")))
        _catalogs[lang] = cached
    return cached[1]


def fill(text: str, values: dict) -> str:
    return PLACEHOLDER.sub(lambda m: str(values[m[1]]) if m[1] in values else m[0], text)


def translate(text: str, lang: str, **values) -> str:
    messages = catalog(lang)
    found = messages["site"].get(text) or messages["course"].get(text) or text
    return fill(found, values) if values else found


def localize(items: list[dict], lang: str, fields: tuple[str, ...]) -> list[dict]:
    """Copies of content dicts (see apps/landing/content.py) with their text fields translated."""
    return [{**item, **{f: translate(item[f], lang) for f in fields if isinstance(item.get(f), str)}} for item in items]


class LanguageMiddleware:
    """Sets request.LANG: ?lang=am|en (remembered in a cookie), else the cookie, else the browser's
    preferred language when it is Amharic, else English."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        chosen = request.GET.get("lang")
        lang = chosen if chosen in LANGUAGES else request.COOKIES.get(COOKIE)
        if lang not in LANGUAGES:
            lang = "am" if request.headers.get("Accept-Language", "").lower().startswith("am") else DEFAULT_LANGUAGE
        request.LANG = lang
        response = self.get_response(request)
        if chosen in LANGUAGES and request.COOKIES.get(COOKIE) != chosen:
            response.set_cookie(COOKIE, chosen, max_age=365 * 24 * 3600, samesite="Lax", secure=request.is_secure())
        patch_vary_headers(response, ("Cookie", "Accept-Language"))
        return response


def language_context(request):
    """Template context: the current language and a link that switches to the other one."""
    lang = getattr(request, "LANG", DEFAULT_LANGUAGE)
    other = "en" if lang == "am" else "am"
    return {
        "lang": lang,
        "lang_switch": {
            "code": other,
            "label": LANGUAGES[other],
            "short": {"en": "EN", "am": "አማ"}[other],
            "url": f"{request.path}?lang={other}",
        },
    }
