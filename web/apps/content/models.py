import hashlib

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.i18n import PLACEHOLDER, normalize

MAX_TEXT_LENGTH = 5000


def text_key(source: str) -> str:
    """The database key of a text: its hash, because the text itself can be too long to index."""
    return hashlib.sha256(normalize(source).encode()).hexdigest()


def check_text(source: str, text: str) -> str | None:
    """Why `text` can't replace `source`, or None when it can."""
    if not normalize(source) or not normalize(text):
        return "Text can't be empty."
    if len(source) > MAX_TEXT_LENGTH or len(text) > MAX_TEXT_LENGTH:
        return f"Text can be at most {MAX_TEXT_LENGTH} characters."
    if set(PLACEHOLDER.findall(source)) != set(PLACEHOLDER.findall(text)):
        return "Keep the {placeholders} of the original text: the site fills them in."
    return None


class TextOverride(models.Model):
    """Text an admin changed on the page: wherever the site would show `source`, it shows `text` instead.

    `source` is the text as shown in its language (an English or Amharic interface string, a word, a line of
    a lesson), so every place showing the same text changes together. See static/core/js/zema-text.js.
    """

    key = models.CharField(max_length=64, unique=True, editable=False)
    source = models.TextField("default text")
    text = models.TextField("shown instead")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, editable=False
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "text change"
        ordering = ("source",)

    def __str__(self):
        return self.source[:80]

    def save(self, *args, **kwargs):
        self.source, self.text = normalize(self.source), normalize(self.text)
        self.key = text_key(self.source)
        super().save(*args, **kwargs)

    def clean(self):
        error = check_text(self.source, self.text)
        if error:
            raise ValidationError(error)


def published_texts() -> dict[str, str]:
    return dict(TextOverride.objects.values_list("source", "text"))
