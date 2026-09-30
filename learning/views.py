import random
from django.db.models import Q, Sum
from django.http import FileResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views import View
from django.views.generic import TemplateView, ListView

from .challenges import ChallengeChapterService, ChallengeDirection
from .models import DailyStudyLog, QuizResult, StudyStatus, UserWordProgress, VocabularyEntry, VocabularyCategory
from .tts import GermanTTSService


CHAPTER_CHOICES = [
    ('1', 'A1.1 Chapter 1'),
    ('2', 'A1.1 Chapter 2'),
]

FLOW_STAGES = [
    ('learn', 'Learn'),
    ('quiz', 'Quiz'),
    ('matching', 'Matching'),
    ('flashcards', 'Flashcards'),
    ('challenge', 'Challenge'),
]


def get_selected_chapter(request):
    chapter = request.GET.get('chapter') or request.POST.get('chapter') or request.session.get('selected_chapter') or '1'
    if chapter not in {'1', '2'}:
        chapter = '1'
    request.session['selected_chapter'] = chapter
    request.session.modified = True
    return chapter


def chapter_words_queryset(request, queryset=None):
    qs = queryset or VocabularyEntry.objects.filter(is_active=True)
    chapter = get_selected_chapter(request)
    if chapter == '2':
        return qs.filter(source_section__startswith='2.')
    return qs.filter(source_section__startswith='1.')


def get_learning_flow_state(request):
    chapter = get_selected_chapter(request)
    flow_key = f'learning_flow_{chapter}'
    flow_state = request.session.get(flow_key, {})
    for stage_key, _ in FLOW_STAGES:
        flow_state.setdefault(stage_key, False)
    flow_state.setdefault('learn', chapter_words_queryset(request, VocabularyEntry.objects.filter(is_active=True)).exists())
    request.session[flow_key] = flow_state
    request.session.modified = True
    return flow_state


def mark_stage_complete(request, stage_name):
    chapter = get_selected_chapter(request)
    flow_key = f'learning_flow_{chapter}'
    flow_state = request.session.get(flow_key, {})
    flow_state[stage_name] = True
    request.session[flow_key] = flow_state
    request.session.modified = True
    return flow_state


def is_stage_available(request, stage_name):
    flow_state = get_learning_flow_state(request)
    stage_index = {key: idx for idx, (key, _) in enumerate(FLOW_STAGES)}
    current_index = stage_index.get(stage_name, 0)
    for previous_key, _ in FLOW_STAGES[:current_index]:
        if not flow_state.get(previous_key, False):
            return False
    return True


class DashboardView(TemplateView):
    template_name = 'learning/dashboard.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user if self.request.user.is_authenticated else None
        chapter = get_selected_chapter(self.request)
        words = chapter_words_queryset(self.request, VocabularyEntry.objects.filter(is_active=True))
        progress = UserWordProgress.objects.filter(user=user) if user else UserWordProgress.objects.none()
        learned = progress.filter(status=StudyStatus.LEARNED).count()
        learning = progress.filter(status=StudyStatus.LEARNING).count()
        difficult = progress.filter(status=StudyStatus.DIFFICULT).count()
        today_minutes = DailyStudyLog.objects.filter(user=user, date=timezone.now().date()).aggregate(total_minutes=Sum('study_minutes'))['total_minutes'] if user else 0

        flow_state = get_learning_flow_state(self.request)
        context.update({
            'selected_chapter': chapter,
            'chapter_choices': CHAPTER_CHOICES,
            'total_words': words.count(),
            'learned_words': learned,
            'learning_words': learning,
            'difficult_words': difficult,
            'quiz_results': QuizResult.objects.filter(user=user).order_by('-created_at')[:5] if user else [],
            'today_minutes': today_minutes,
            'learning_flow': flow_state,
            'learning_flow_stages': FLOW_STAGES,
        })
        return context


class VocabularyListView(ListView):
    model = VocabularyEntry
    template_name = 'learning/vocabulary.html'
    context_object_name = 'words'
    paginate_by = 30

    def get_queryset(self):
        queryset = chapter_words_queryset(self.request, VocabularyEntry.objects.select_related('category').filter(is_active=True))
        q = self.request.GET.get('q')
        category = self.request.GET.get('category')
        status = self.request.GET.get('status')

        if q:
            queryset = queryset.filter(Q(german__icontains=q) | Q(english__icontains=q))
        if category:
            queryset = queryset.filter(category__slug=category)
        if status and self.request.user.is_authenticated:
            queryset = queryset.filter(user_progress__user=self.request.user, user_progress__status=status)
        return queryset.distinct()

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        chapter_words = list(chapter_words_queryset(self.request, VocabularyEntry.objects.select_related('category').filter(is_active=True).order_by('german')))
        total_words = len(chapter_words)

        try:
            current_index = int(self.request.GET.get('index', '0'))
        except (TypeError, ValueError):
            current_index = 0
        current_index = max(0, min(current_index, total_words - 1)) if total_words else 0

        current_word = chapter_words[current_index] if chapter_words else None
        progress_map = {}
        if self.request.user.is_authenticated and chapter_words:
            progress_map = {
                entry.word_id: entry
                for entry in UserWordProgress.objects.filter(
                    user=self.request.user,
                    word__in=[word.id for word in chapter_words],
                )
            }

        flow_state = get_learning_flow_state(self.request)
        flow_state['learn'] = True
        mark_stage_complete(self.request, 'learn')

        selected_chapter = get_selected_chapter(self.request)
        chapter_label = 'A1.1 Chapter 2' if selected_chapter == '2' else 'A1.1 Chapter 1'

        context['categories'] = VocabularyCategory.objects.all()
        context['status_choices'] = StudyStatus.choices
        context['selected_chapter'] = selected_chapter
        context['chapter_label'] = chapter_label
        context['chapter_choices'] = CHAPTER_CHOICES
        context['current_word'] = current_word
        context['current_progress'] = progress_map.get(current_word.id) if current_word else None
        context['current_index'] = current_index
        context['total_words'] = total_words
        context['progress_label'] = f'{current_index + 1} / {total_words} words learned' if total_words else '0 / 0 words learned'
        context['previous_index'] = max(0, current_index - 1) if total_words else 0
        context['next_index'] = min(total_words - 1, current_index + 1) if total_words else 0
        context['word_rows'] = []
        context['learning_flow'] = flow_state
        context['learning_flow_stages'] = FLOW_STAGES
        context['next_stage_available'] = is_stage_available(self.request, 'quiz')
        return context


class FlashcardView(TemplateView):
    template_name = 'learning/flashcards.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        words = list(chapter_words_queryset(self.request, VocabularyEntry.objects.filter(is_active=True)))
        random.shuffle(words)
        context['selected_chapter'] = get_selected_chapter(self.request)
        context['chapter_choices'] = CHAPTER_CHOICES
        context['words'] = words
        context['stage_name'] = 'Flashcards'
        context['stage_progress'] = {
            'completed': len(words),
            'total': len(words),
        }
        return context


class QuizView(View):
    template_name = 'learning/quiz.html'

    def _selected_chapter(self, request):
        return get_selected_chapter(request)

    def _generate_quiz_items(self, request):
        words = list(chapter_words_queryset(request, VocabularyEntry.objects.filter(is_active=True)))
        random.shuffle(words)
        ordered_words = words

        quiz_items = []
        for word in ordered_words:
            options = [word.english]
            distractors = list(VocabularyEntry.objects.filter(is_active=True).exclude(id=word.id).values_list('english', flat=True))
            random.shuffle(distractors)
            for candidate in distractors:
                if candidate not in options and candidate:
                    options.append(candidate)
                if len(options) >= 4:
                    break
            random.shuffle(options)
            quiz_items.append({'word': word, 'options': options[:4]})

        return quiz_items

    def _get_quiz_items(self, request):
        chapter_key = f"quiz_items_{self._selected_chapter(request)}"
        saved = request.session.get(chapter_key)
        if saved:
            words_by_id = {str(word.id): word for word in chapter_words_queryset(request, VocabularyEntry.objects.filter(is_active=True))}
            quiz_items = []
            for item in saved:
                word = words_by_id.get(str(item['word_id']))
                if word:
                    quiz_items.append({'word': word, 'options': item['options']})
            if quiz_items:
                return quiz_items

        quiz_items = self._generate_quiz_items(request)
        request.session[chapter_key] = [
            {'word_id': str(item['word'].id), 'options': item['options']}
            for item in quiz_items
        ]
        request.session.modified = True
        return quiz_items

    def _render(self, request, context_overrides=None):
        chapter = self._selected_chapter(request)
        flow_state = get_learning_flow_state(request)
        context = {
            'selected_chapter': chapter,
            'chapter_choices': CHAPTER_CHOICES,
            'quiz_words': self._get_quiz_items(request),
            'matching_words': [
                {'german': word.german, 'english': word.english}
                for word in chapter_words_queryset(request, VocabularyEntry.objects.filter(is_active=True))
            ],
            'stage_name': 'Multiple-choice quiz',
            'all_words_completed': len(self._get_quiz_items(request)) == len(chapter_words_queryset(request, VocabularyEntry.objects.filter(is_active=True))),
            'learning_flow': flow_state,
            'learning_flow_stages': FLOW_STAGES,
            'quiz_stage_available': is_stage_available(request, 'quiz'),
            'next_stage_available': is_stage_available(request, 'matching'),
        }
        if context_overrides:
            context.update(context_overrides)
        return render(request, self.template_name, context)

    def get(self, request, *args, **kwargs):
        get_selected_chapter(request)
        return self._render(request)

    def post(self, request, *args, **kwargs):
        chapter = get_selected_chapter(request)
        quiz_items = self._get_quiz_items(request)
        total_questions = len(quiz_items)
        correct_answers = 0
        answer_rows = []

        for item in quiz_items:
            word = item['word']
            submitted = request.POST.get(f'answer-{word.id}')
            selected = (submitted or '').strip()
            is_correct = ChallengeChapterService.normalize(selected) == ChallengeChapterService.normalize(word.english)
            if is_correct:
                correct_answers += 1
            if request.user.is_authenticated:
                UserWordProgress.record_attempt(request.user, word, is_correct)
            answer_rows.append({
                'word': word,
                'selected': selected,
                'correct': word.english,
                'is_correct': is_correct,
            })

        score_percent = round((correct_answers / total_questions) * 100, 1) if total_questions else 0
        result_summary = ChallengeChapterService.result_summary(score_percent)

        quiz_payload = []
        for item in quiz_items:
            word = item['word']
            result = next((row for row in answer_rows if str(row['word'].id) == str(word.id)), None)
            quiz_payload.append({
                'word': word,
                'options': item['options'],
                'result': result,
            })

        if total_questions and len(answer_rows) == total_questions:
            mark_stage_complete(request, 'quiz')

        return self._render(request, {
            'quiz_words': quiz_payload,
            'quiz_results': answer_rows,
            'correct_answers': correct_answers,
            'total_questions': total_questions,
            'score_percent': score_percent,
            'result_summary': result_summary,
            'result_banner': True,
        })


MATCHING_QUIZ_SIZE = 10


class MatchingQuizView(TemplateView):
    template_name = 'learning/matching_quiz.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        chapter = get_selected_chapter(self.request)
        words = list(chapter_words_queryset(self.request, VocabularyEntry.objects.filter(is_active=True)))
        random.shuffle(words)

        # One quiz is 10 pairs; skip repeated meanings so every German word has exactly one right answer.
        selected_words = []
        seen_english = set()
        for word in words:
            if word.english.lower() in seen_english:
                continue
            seen_english.add(word.english.lower())
            selected_words.append(word)
            if len(selected_words) == MATCHING_QUIZ_SIZE:
                break
        german_column = []
        english_column = []

        for index, word in enumerate(selected_words):
            pair_id = f'pair-{index}'
            german_column.append({
                'pair_id': pair_id,
                'german': word.german,
                'english': word.english,
            })
            english_column.append({
                'pair_id': pair_id,
                'english': word.english,
                'german': word.german,
            })

        random.shuffle(german_column)
        random.shuffle(english_column)

        flow_state = get_learning_flow_state(self.request)
        context['selected_chapter'] = chapter
        context['chapter_choices'] = CHAPTER_CHOICES
        context['pairs'] = german_column
        context['english_pairs'] = english_column
        context['stage_name'] = 'Matching quiz'
        context['all_words_completed'] = len(selected_words) == len(words)
        context['learning_flow'] = flow_state
        context['learning_flow_stages'] = FLOW_STAGES
        context['matching_stage_available'] = is_stage_available(self.request, 'matching')
        context['next_stage_available'] = is_stage_available(self.request, 'flashcards')
        return context


class ReviewView(TemplateView):
    template_name = 'learning/review.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        chapter_qs = chapter_words_queryset(self.request, VocabularyEntry.objects.filter(is_active=True))
        if self.request.user.is_authenticated:
            due_words = list(chapter_qs.filter(
                user_progress__user=self.request.user,
                user_progress__due_at__lte=timezone.now(),
            ).select_related('category')[:20])
        else:
            due_words = []
        if not due_words:
            due_words = list(chapter_qs.select_related('category')[:20])
        random.shuffle(due_words)
        flow_state = get_learning_flow_state(self.request)
        context['selected_chapter'] = get_selected_chapter(self.request)
        context['chapter_choices'] = CHAPTER_CHOICES
        context['words'] = due_words
        context['learning_flow'] = flow_state
        context['learning_flow_stages'] = FLOW_STAGES
        return context


class SearchView(ListView):
    model = VocabularyEntry
    template_name = 'learning/search.html'
    context_object_name = 'words'

    def get_queryset(self):
        query = self.request.GET.get('q', '').strip()
        if not query:
            return VocabularyEntry.objects.none()
        queryset = chapter_words_queryset(self.request, VocabularyEntry.objects.filter(
            Q(german__icontains=query) | Q(english__icontains=query) | Q(example_sentence__icontains=query)
        ))
        return queryset[:20]

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['selected_chapter'] = get_selected_chapter(self.request)
        context['chapter_choices'] = CHAPTER_CHOICES
        context['learning_flow'] = get_learning_flow_state(self.request)
        context['learning_flow_stages'] = FLOW_STAGES
        return context


class ChallengeChapterView(View):
    template_name = 'learning/challenge.html'

    def _initial_state(self, request):
        chapter = get_selected_chapter(request)
        words = list(chapter_words_queryset(request, VocabularyEntry.objects.filter(is_active=True)))
        if not words:
            return None
        random.shuffle(words)
        state = {
            'word_ids': [str(word.id) for word in words],
            'index': 0,
            'direction': ChallengeDirection.EN_TO_DE.value,
            'chapter': chapter,
            'correct_answers': 0,
            'incorrect_answers': 0,
            'words_with_hints': 0,
            'fully_revealed': 0,
            'total_attempts': 0,
            'hint_level': 0,
            'last_result': '',
            'last_message': '',
            'revealed_answer': False,
            'all_words_seen': False,
        }
        request.session['challenge_state'] = state
        request.session.modified = True
        return state

    def _get_state(self, request):
        state = request.session.get('challenge_state')
        if state is None:
            return self._initial_state(request)
        return state

    def _current_word(self, state):
        if not state or not state.get('word_ids'):
            return None
        try:
            word_id = state['word_ids'][state.get('index', 0)]
            return VocabularyEntry.objects.get(pk=word_id)
        except (IndexError, VocabularyEntry.DoesNotExist):
            return None

    def _render(self, request, state):
        if not state or not state.get('word_ids'):
            return render(request, self.template_name, {
                'no_words': True,
                'direction_choices': [(choice.value, choice.label) for choice in ChallengeDirection],
            })

        word = self._current_word(state)
        if word is None:
            return render(request, self.template_name, {
                'no_words': True,
                'direction_choices': [(choice.value, choice.label) for choice in ChallengeDirection],
            })

        direction = state.get('direction', ChallengeDirection.EN_TO_DE.value)
        direction_label = ChallengeDirection(direction).label if direction in ChallengeDirection.values() else ChallengeDirection.EN_TO_DE.label
        prompt, answer = ChallengeChapterService.get_prompt_and_answer(word, direction)
        max_hints = ChallengeChapterService.get_total_hints(answer)
        hint_level = max(0, int(state.get('hint_level', 0)))
        hint = ChallengeChapterService.build_hint(answer, hint_level) if hint_level else ''
        total_words = len(state['word_ids'])
        progress = round(((state.get('index', 0) + 1) / total_words) * 100, 1) if total_words else 0
        stats = {
            'correct_answers': state.get('correct_answers', 0),
            'incorrect_answers': state.get('incorrect_answers', 0),
            'words_with_hints': state.get('words_with_hints', 0),
            'fully_revealed': state.get('fully_revealed', 0),
            'total_attempts': state.get('total_attempts', 0),
        }
        score_percent = ChallengeChapterService.score_percent(stats)
        result_summary = ChallengeChapterService.result_summary(score_percent)
        context = {
            'word': word,
            'prompt': prompt,
            'answer': answer,
            'hint': hint,
            'hint_level': hint_level,
            'max_hints': max_hints,
            'direction': direction,
            'direction_label': direction_label,
            'direction_choices': [(choice.value, choice.label) for choice in ChallengeDirection],
            'progress': progress,
            'current_index': state.get('index', 0) + 1,
            'total_words': total_words,
            'stats': stats,
            'score_percent': score_percent,
            'result_summary': result_summary,
            'last_result': state.get('last_result', ''),
            'last_message': state.get('last_message', ''),
            'revealed_answer': state.get('revealed_answer', False),
            'no_words': False,
            'stage_name': 'Challenge',
            'all_words_ready': state.get('index', 0) + 1 >= total_words,
        }
        return render(request, self.template_name, context)

    def get(self, request, *args, **kwargs):
        state = self._get_state(request)
        return self._render(request, state)

    def post(self, request, *args, **kwargs):
        state = self._get_state(request)
        if not state:
            return self._render(request, None)

        action = request.POST.get('action')
        if action == 'reset':
            request.session.pop('challenge_state', None)
            return self.get(request)

        if action == 'change_direction':
            direction = request.POST.get('direction', ChallengeDirection.EN_TO_DE.value)
            chapter = get_selected_chapter(request)
            state['chapter'] = chapter
            word_ids = state.get('word_ids') or []
            if not word_ids:
                state = self._initial_state(request)
            else:
                state['direction'] = direction
                state['index'] = 0
                state['hint_level'] = 0
                state['last_result'] = ''
                state['last_message'] = ''
                state['revealed_answer'] = False
                request.session['challenge_state'] = state
                request.session.modified = True
            return self._render(request, state)

        word = self._current_word(state)
        if word is None:
            request.session.pop('challenge_state', None)
            return self._render(request, None)

        direction = state.get('direction', ChallengeDirection.EN_TO_DE.value)
        prompt, answer = ChallengeChapterService.get_prompt_and_answer(word, direction)
        max_hints = ChallengeChapterService.get_total_hints(answer)

        if action == 'hint':
            state['hint_level'] = min(max_hints, state.get('hint_level', 0) + 1)
            if state['hint_level'] == 1:
                state['words_with_hints'] = state.get('words_with_hints', 0) + 1
            if state['hint_level'] >= max_hints:
                state['fully_revealed'] = state.get('fully_revealed', 0) + 1
                state['revealed_answer'] = True
                state['last_result'] = 'reveal'
                state['last_message'] = f"The answer is revealed: {answer}"
            else:
                state['last_result'] = 'hint'
                state['last_message'] = f"Hint {state['hint_level']}: {ChallengeChapterService.build_hint(answer, state['hint_level'])}"
            request.session['challenge_state'] = state
            request.session.modified = True
            return self._render(request, state)

        if action == 'submit':
            submitted = ChallengeChapterService.normalize(request.POST.get('answer', ''))
            expected = ChallengeChapterService.normalize(answer)
            state['total_attempts'] = state.get('total_attempts', 0) + 1

            if submitted == expected:
                state['correct_answers'] = state.get('correct_answers', 0) + 1
                state['last_result'] = 'correct'
                state['last_message'] = f"Correct! {answer} is right."
                state['revealed_answer'] = False
                if request.user.is_authenticated:
                    UserWordProgress.record_attempt(request.user, word, True)
            else:
                state['incorrect_answers'] = state.get('incorrect_answers', 0) + 1
                next_hint = min(max_hints, state.get('hint_level', 0) + 1)
                state['hint_level'] = next_hint
                if state['hint_level'] == 1:
                    state['words_with_hints'] = state.get('words_with_hints', 0) + 1
                if next_hint >= max_hints:
                    state['fully_revealed'] = state.get('fully_revealed', 0) + 1
                    state['revealed_answer'] = True
                    state['last_result'] = 'reveal'
                    state['last_message'] = f"Not quite. The correct answer is: {answer}"
                else:
                    state['last_result'] = 'incorrect'
                    state['last_message'] = f"Not quite. Hint {next_hint}: {ChallengeChapterService.build_hint(answer, next_hint)}"
                if request.user.is_authenticated:
                    UserWordProgress.record_attempt(request.user, word, False)
            request.session['challenge_state'] = state
            request.session.modified = True
            return self._render(request, state)

        if action == 'next_word':
            total_words = len(state.get('word_ids', []))
            next_index = state.get('index', 0) + 1
            if next_index >= total_words:
                words = list(VocabularyEntry.objects.filter(is_active=True))
                random.shuffle(words)
                state['word_ids'] = [str(word.id) for word in words]
                state['index'] = 0
            else:
                state['index'] = next_index
            state['hint_level'] = 0
            state['last_result'] = ''
            state['last_message'] = ''
            state['revealed_answer'] = False
            request.session['challenge_state'] = state
            request.session.modified = True
            return self._render(request, state)

        return self._render(request, state)


class TTSAudioView(View):
    def get(self, request, *args, **kwargs):
        text = request.GET.get('text', '').strip()
        if not text:
            return HttpResponseBadRequest('Missing text to pronounce.')

        if len(text) > 500:
            return HttpResponseBadRequest('Text is too long to pronounce.')

        service = GermanTTSService(
            voice=request.GET.get('voice'),
            speed=request.GET.get('speed'),
            style=request.GET.get('style', 'clear'),
        )
        audio_path = service.synthesize(text)
        if not audio_path:
            return HttpResponseBadRequest(
                'No German voice is available. Check the internet connection, or install piper-tts for offline audio.'
            )

        content_type = 'audio/mpeg' if audio_path.suffix == '.mp3' else 'audio/wav'
        response = FileResponse(open(audio_path, 'rb'), content_type=content_type)
        response['Cache-Control'] = 'private, max-age=604800'
        return response


class TTSVoiceOptionsView(View):
    def get(self, request, *args, **kwargs):
        from .tts import DEFAULT_NEURAL_VOICE, DEFAULT_SPEED
        return JsonResponse({
            'voices': GermanTTSService.neural_voices(),
            'default': DEFAULT_NEURAL_VOICE,
            'speeds': GermanTTSService.speeds(),
            'default_speed': DEFAULT_SPEED,
            'offline_voices': GermanTTSService.available_characters(),
        })


class TranslationsAPIView(View):
    def get(self, request, *args, **kwargs):
        from .translations import get_all_translations
        language = getattr(request, 'language', 'en')
        return JsonResponse({
            'language': language,
            'translations': get_all_translations(language),
        })
