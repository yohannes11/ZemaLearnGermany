from django.urls import path
from .views import (
    ChallengeChapterView,
    DashboardView,
    VocabularyListView,
    FlashcardView,
    QuizView,
    MatchingQuizView,
    ReviewView,
    SearchView,
    TTSAudioView,
    TTSVoiceOptionsView,
    TranslationsAPIView,
)

urlpatterns = [
    path('', DashboardView.as_view(), name='dashboard'),
    path('vocabulary/', VocabularyListView.as_view(), name='vocabulary-list'),
    path('flashcards/', FlashcardView.as_view(), name='flashcards'),
    path('quiz/', QuizView.as_view(), name='quiz'),
    path('quiz/matching/', MatchingQuizView.as_view(), name='matching-quiz'),
    path('challenge/', ChallengeChapterView.as_view(), name='challenge-chapter'),
    path('review/', ReviewView.as_view(), name='review'),
    path('search/', SearchView.as_view(), name='search'),
    path('tts/', TTSAudioView.as_view(), name='tts-audio'),
    path('tts/voices/', TTSVoiceOptionsView.as_view(), name='tts-voices'),
    path('api/translations/', TranslationsAPIView.as_view(), name='translations-api'),
]
