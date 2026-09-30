from django.conf import settings
from django.db import models

MAX_LEARNED_WORDS = 5000
MAX_GRAMMAR_LESSONS = 500
GRAMMAR_PASS_MARK = 6


class Progress(models.Model):
    """A signed-in learner's course progress, so it follows them to any device."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="progress")
    learned = models.JSONField("learned words", default=list, blank=True)
    grammar = models.JSONField("best grammar scores", default=dict, blank=True)
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

    def merge(self, learned, grammar, *, replace=False):
        """Combine what a device sends with what is stored.

        On sign-in the two are merged so nothing learned on any device is lost. Afterwards the device
        sends replace=True: it is up to date, so words it un-marked stay un-marked. Grammar keeps the
        best score either way.
        """
        words = [w for w in learned if isinstance(w, str) and len(w) <= 200]
        kept = [] if replace else list(self.learned)
        self.learned = list(dict.fromkeys([*kept, *words]))[:MAX_LEARNED_WORDS]

        scores = dict(self.grammar)
        for key, score in grammar.items():
            if isinstance(key, str) and len(key) <= 60 and isinstance(score, int) and 0 <= score <= 100:
                scores[key] = max(score, scores.get(key, 0))
        self.grammar = dict(list(scores.items())[:MAX_GRAMMAR_LESSONS])

    def as_dict(self):
        return {"learned": self.learned, "grammar": self.grammar}
