from django.conf import settings
from django.db import models

GRAMMAR_PASS_MARK = 6


class Progress(models.Model):
    """A learner's progress: the result of every change any of their devices made, so it follows them anywhere.

    Devices don't send this state; they send small changes ("operations", see sync.py), and this is what applying
    them produced. `revision` goes up with every change, so a device can tell in one number whether it is current.
    """

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="progress")
    revision = models.PositiveIntegerField(default=0)
    learned = models.JSONField("learned words", default=list, blank=True)
    # When each word was last marked or un-marked ({german: [learned, at_ms]}): the latest change wins.
    word_log = models.JSONField("word changes", default=dict, blank=True)
    grammar = models.JSONField("best grammar scores", default=dict, blank=True)
    # The learner's own calendar days (YYYY-MM-DD) with practice, for the daily streak. Most recent last.
    days = models.JSONField("days practised", default=list, blank=True)
    # Experience points per day ({"YYYY-MM-DD": points}): the sum of every XP operation, each counted once.
    xp = models.JSONField("XP per day", default=dict, blank=True)
    # Spaced repetition per word ({german: {"box": n, "due": day, "at": ms}}): the latest review wins.
    srs = models.JSONField("review schedule", default=dict, blank=True)
    # Daily goal changes ([[day, at_ms, xp, op_id], ...]): a day counts as "goal reached" when its XP reaches the goal
    # in force that day (the latest change made on or before it), so every device agrees whatever the order of sync.
    goals = models.JSONField("daily goal changes", default=list, blank=True)
    # Where the learner is in an exercise, to continue on any device ({} when nothing is open).
    session = models.JSONField("open exercise", default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "progress"
        verbose_name_plural = "progress"

    def __str__(self):
        return f"Progress of {self.user}"

    @property
    def words_learned(self):
        return len(self.learned)

    @property
    def lessons_passed(self):
        return sum(1 for score in self.grammar.values() if isinstance(score, int) and score >= GRAMMAR_PASS_MARK)

    @property
    def total_xp(self):
        return sum(points for points in self.xp.values() if isinstance(points, int))

    def as_dict(self):
        """The progress as the website's course page reads it (/api/progress/)."""
        return {"learned": self.learned, "grammar": self.grammar, "days": self.days, "xp": self.xp}

    def snapshot(self):
        """Everything a device needs to show the learner's state (/api/v1/sync/)."""
        open_session = self.session if self.session and not self.session.get("cleared") else None
        return {
            **self.as_dict(),
            "revision": self.revision,
            "srs": self.srs,
            "session": open_session,
            "goals": self.goals,
        }

    def state(self):
        """The learner-visible state, without the revision: to tell whether operations changed anything."""
        return (self.learned, self.grammar, self.days, self.xp, self.srs, self.session, self.goals)


class ProgressEvent(models.Model):
    """An operation a device sent, kept by its id so that sending it again (after a lost connection, or from an
    offline queue days later) never applies it twice."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="progress_events")
    op_id = models.CharField(max_length=64)
    kind = models.CharField(max_length=16)
    at = models.DateTimeField("when it happened on the device")
    received_at = models.DateTimeField(auto_now_add=True)
    data = models.JSONField(default=dict)

    class Meta:
        verbose_name = "progress change"
        constraints = [models.UniqueConstraint(fields=["user", "op_id"], name="course_progressevent_unique_op")]
        indexes = [models.Index(fields=["user", "-received_at"])]

    def __str__(self):
        return f"{self.kind} by {self.user_id} at {self.at:%Y-%m-%d %H:%M}"
