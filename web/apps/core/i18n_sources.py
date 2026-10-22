"""Every English string the interface can show, by section of locale/<lang>.json.

Used by `manage.py i18n_missing` and the tests, so a new button label can't ship untranslated.
"""

import json
import re
from pathlib import Path

from django.conf import settings

from apps.landing import content
from apps.landing.views import AUDIO_SAMPLES

BASE = Path(settings.BASE_DIR)
TEMPLATE_TAG = re.compile(r"""\{%\s*t(?:_html)?\s+(["'])((?:\\.|(?!\1).)*?)\1""")
JS_CALL = re.compile(r"""\bT\((['"`])((?:\\.|(?!\1).)*?)\1""")

# Landing content fields shown on the page (sources and image credits are citations and stay as written).
LANDING_FIELDS = {
    "STATS": ("display", "label", "detail"),
    "PATHS": ("title", "alt", "body", "needs"),
    "REASONS_NOW": ("title", "body"),
    "FEATURES": ("title", "body"),
    "LEVELS": ("name", "can", "opens", "status_label"),
    "FAQ": ("q", "a"),
}

# Messages the server sends to the course page; the course shows them through T().
SERVER_MESSAGES = [
    "Something went wrong. Please try again.",
    "Please sign in.",
    "Please check your input.",
    "Username, email or password is not correct.",
    "Too many attempts. Please wait 15 minutes and try again.",
    "This account has been disabled. Please contact the site admin.",
    "This username is taken. Please choose another.",
    "An account with this email already exists. Try signing in.",
    "Usernames are 3–30 characters: letters, numbers, dots, underscores or hyphens, starting with a letter or number.",  # noqa: RUF001
    "Enter a valid email address.",
    "This field is required.",
    "This password is too short. It must contain at least 8 characters.",
    "This password is too common.",
    "This password is entirely numeric.",
    "The password is too similar to the username.",
    "The password is too similar to the email address.",
    "The password is too similar to the name.",
    "Your old password was entered incorrectly. Please enter it again.",
]


def _unescape(text: str) -> str:
    return re.sub(r"\\(.)", r"\1", text)


def site_strings() -> set[str]:
    found = set()
    for path in (BASE / "templates").rglob("*.html"):
        found.update(_unescape(text) for _, text in TEMPLATE_TAG.findall(path.read_text(encoding="utf-8")))
    for name, fields in LANDING_FIELDS.items():
        for item in getattr(content, name):
            found.update(item[f] for f in fields if isinstance(item.get(f), str))
    found.update(sample["english"] for sample in AUDIO_SAMPLES)
    return found


def course_strings() -> set[str]:
    source = (BASE / "static" / "course" / "js" / "course.js").read_text(encoding="utf-8")
    found = {_unescape(text) for quote, text in JS_CALL.findall(source) if not (quote == "`" and "${" in text)}
    data = (BASE / "static" / "course" / "js" / "course-data.js").read_text(encoding="utf-8")
    course = json.loads(data[data.index("{") : data.rindex("}") + 1])
    for unit in course["units"]:
        found.update(unit[k] for k in ("title", "label", "lessonsLabel") if unit.get(k))
        found.update(section["title"] for section in unit["sections"])
        found.update(lesson["title"] for lesson in unit["grammar"])
    found.update(SERVER_MESSAGES)
    return found


def all_strings() -> dict[str, set[str]]:
    return {"site": site_strings(), "course": course_strings()}
