from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

User = get_user_model()


class VocabularyCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class VocabularyEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    german = models.CharField(max_length=200)
    english = models.CharField(max_length=200)
    amharic = models.CharField(max_length=200, blank=True, default='')
    article = models.CharField(max_length=20, blank=True)
    plural = models.CharField(max_length=200, blank=True)
    pronunciation = models.CharField(max_length=200, blank=True)
    part_of_speech = models.CharField(max_length=50, blank=True)
    category = models.ForeignKey(VocabularyCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='entries')
    source_section = models.CharField(max_length=50, blank=True)
    example_sentence = models.TextField(blank=True)
    english_example = models.TextField(blank=True)
    is_from_pdf = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['german']
        unique_together = ('german', 'english')

    def __str__(self):
        return f"{self.german} - {self.english}"


class StudyStatus(models.TextChoices):
    LEARNED = 'learned', 'Learned'
    LEARNING = 'learning', 'Learning'
    DIFFICULT = 'difficult', 'Difficult'


class UserWordProgress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='word_progress')
    word = models.ForeignKey(VocabularyEntry, on_delete=models.CASCADE, related_name='user_progress')
    status = models.CharField(max_length=20, choices=StudyStatus.choices, default=StudyStatus.LEARNING)
    review_count = models.PositiveIntegerField(default=0)
    correct_count = models.PositiveIntegerField(default=0)
    incorrect_count = models.PositiveIntegerField(default=0)
    due_at = models.DateTimeField(null=True, blank=True)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'word')

    @staticmethod
    def record_attempt(user, word, was_correct):
        progress, _ = UserWordProgress.objects.get_or_create(user=user, word=word)
        progress.review_count += 1
        if was_correct:
            progress.correct_count += 1
        else:
            progress.incorrect_count += 1
        progress.last_reviewed_at = timezone.now()
        progress.status = progress.calculate_status()
        progress.due_at = timezone.now() + timezone.timedelta(days=1)
        progress.save(update_fields=['review_count', 'correct_count', 'incorrect_count', 'last_reviewed_at', 'status', 'due_at', 'updated_at'])
        return progress

    def calculate_status(self):
        if self.correct_count >= 4 and self.incorrect_count <= 1:
            return StudyStatus.LEARNED
        if self.correct_count >= 1 or self.incorrect_count == 0:
            return StudyStatus.LEARNING
        return StudyStatus.DIFFICULT

    def mastery_label(self):
        if self.calculate_status() == StudyStatus.LEARNED:
            return 'Know well'
        if self.incorrect_count > self.correct_count and self.incorrect_count >= 2:
            return "Didn't know well"
        return 'Learning'

    def mastery_tone(self):
        if self.calculate_status() == StudyStatus.LEARNED:
            return 'good'
        if self.incorrect_count > self.correct_count and self.incorrect_count >= 2:
            return 'try-again'
        return 'neutral'

    def __str__(self):
        return f"{self.user} - {self.word} - {self.status}"


class QuizResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quiz_results')
    total_questions = models.PositiveIntegerField(default=0)
    correct_answers = models.PositiveIntegerField(default=0)
    score_percent = models.FloatField(default=0.0)
    quiz_type = models.CharField(max_length=50, default='mixed')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.quiz_type} - {self.score_percent}%"


class DailyStudyLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_logs')
    date = models.DateField()
    study_minutes = models.PositiveIntegerField(default=0)
    words_reviewed = models.PositiveIntegerField(default=0)
    correct_answers = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('user', 'date')

    def __str__(self):
        return f"{self.user} - {self.date}"
