from django.conf import settings
from django.db import models
from django.utils import timezone


class Event(models.Model):
    """One anonymous usage event from the course page.

    visitor_id is a random id kept in the learner's browser; it identifies a browser, not a person.
    No IP address is stored. For signed-in learners the account is linked as well.
    """

    class Type(models.TextChoices):
        SESSION = "session", "Visit started"
        VIEW = "view", "Page view"
        ACTIVE = "active", "Active study minute"
        GRAMMAR = "grammar", "Grammar quiz finished"

    class Mode(models.TextChoices):
        LEARN = "learn", "Learn"
        SPEAK = "speak", "Speak"
        PRACTICE = "practice", "Practice"
        FLASHCARDS = "flashcards", "Flashcards"
        MATCH = "match", "Match"
        GRAMMAR = "grammar", "Grammar"

    class Device(models.TextChoices):
        PHONE = "phone", "Phone / tablet"
        DESKTOP = "desktop", "Computer"

    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    visitor_id = models.CharField(max_length=64)
    session_id = models.CharField(max_length=64, help_text="A visit; a new one starts after 30 idle minutes.")
    type = models.CharField(max_length=10, choices=Type.choices)
    unit = models.PositiveSmallIntegerField(null=True, blank=True)
    mode = models.CharField(max_length=12, choices=Mode.choices, blank=True)
    scope = models.CharField(max_length=60, blank=True, help_text="Section or grammar lesson key.")
    value = models.PositiveIntegerField(null=True, blank=True, help_text="Grammar quiz score.")
    device = models.CharField(max_length=8, choices=Device.choices, default=Device.DESKTOP)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="events"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["visitor_id", "created_at"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"{self.get_type_display()} · {self.created_at:%Y-%m-%d %H:%M}"
