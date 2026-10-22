import re

from django.core.validators import RegexValidator

USERNAME_MIN, USERNAME_MAX = 3, 30

# Letters, digits, dots, underscores and hyphens, starting with a letter or digit. No "@", so a sign-in
# name can always be told apart from an email address.
username_validator = RegexValidator(
    regex=rf"^[A-Za-z0-9][A-Za-z0-9._-]{{{USERNAME_MIN - 1},{USERNAME_MAX - 1}}}$",
    message=(
        f"Usernames are {USERNAME_MIN}–{USERNAME_MAX} characters: letters, numbers, dots, "  # noqa: RUF001
        "underscores or hyphens, starting with a letter or number."
    ),
)


def username_base(email: str) -> str:
    """A username suggestion from an email address: "Marta.B+de@x.com" -> "Marta.Bde"."""
    local = email.split("@", 1)[0]
    base = re.sub(r"[^A-Za-z0-9._-]", "", local).lstrip("._-")[:USERNAME_MAX]
    return base if len(base) >= USERNAME_MIN else (base + "user")[:USERNAME_MAX]


def unique_username(email: str, taken: set[str]) -> str:
    """username_base(email), with a number added if needed so it is not in `taken` (lower-cased names)."""
    base = username_base(email)
    candidate, number = base, 1
    while candidate.lower() in taken:
        number += 1
        suffix = str(number)
        candidate = base[: USERNAME_MAX - len(suffix)] + suffix
    return candidate
