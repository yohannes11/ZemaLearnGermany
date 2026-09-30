import os
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
from django.test import Client, TestCase

django.setup()

from django.contrib.auth import get_user_model

from learning.challenges import ChallengeChapterService
from learning.models import StudyStatus, UserWordProgress, VocabularyEntry

User = get_user_model()


class QuizSelectableTest(TestCase):
    def setUp(self):
        VocabularyEntry.objects.create(german='Hallo', english='hello', is_active=True)
        VocabularyEntry.objects.create(german='Apfel', english='apple', is_active=True)
        VocabularyEntry.objects.create(german='Danke', english='thank you', is_active=True)
        VocabularyEntry.objects.create(german='Katze', english='cat', is_active=True)
        VocabularyEntry.objects.create(german='Auto', english='car', is_active=True)

    def test_quiz_page_has_selectable_answers(self):
        response = Client(HTTP_HOST='127.0.0.1').get('/quiz/')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'type="radio"')
        self.assertContains(response, 'quiz-answer-')

    def test_quiz_page_includes_matching_quiz_link(self):
        response = Client(HTTP_HOST='127.0.0.1').get('/quiz/')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Try Matching quiz')

    def test_matching_quiz_page_renders_pairs(self):
        response = Client(HTTP_HOST='127.0.0.1').get('/quiz/matching/')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Matching quiz')
        self.assertContains(response, 'matching-pair')
        self.assertContains(response, 'draggable="true"')
        self.assertContains(response, 'data-pair-id="pair-')

    def test_standard_quiz_submission_shows_result_banner(self):
        get_response = Client(HTTP_HOST='127.0.0.1').get('/quiz/')
        self.assertEqual(get_response.status_code, 200)

        field_names = re.findall(r'name="(answer-[^"]+)"', get_response.content.decode('utf-8'))
        post_data = {}
        seen = set()
        for field_name in field_names:
            if field_name in seen:
                continue
            seen.add(field_name)
            word_id = field_name.split('answer-', 1)[1]
            word = VocabularyEntry.objects.filter(id=word_id).first()
            if word:
                post_data[field_name] = word.english

        response = Client(HTTP_HOST='127.0.0.1').post('/quiz/', post_data)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Very good!')
        self.assertContains(response, 'result-banner')

    def test_dashboard_lists_chapter_choices(self):
        response = Client(HTTP_HOST='127.0.0.1').get('/')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'A1.1 Chapter 1')
        self.assertContains(response, 'A1.1 Chapter 2')

    def test_chapter_filter_limits_words_to_selected_chapter(self):
        unique_word = 'Aaaa Großmutter'
        VocabularyEntry.objects.create(german=unique_word, english='grandmother', source_section='2.1', is_active=True)
        response = Client(HTTP_HOST='127.0.0.1').get('/vocabulary/?chapter=2&index=0')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'A1.1 Chapter 2')
        self.assertContains(response, unique_word)

    def test_learn_view_shows_one_word_at_a_time_with_progress(self):
        for index in range(3):
            VocabularyEntry.objects.create(german=f'wort-{index}', english=f'word-{index}', source_section='1.1', is_active=True)

        response = Client(HTTP_HOST='127.0.0.1').get('/vocabulary/?chapter=1&index=1')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Previous')
        self.assertContains(response, 'Next')
        self.assertContains(response, 'Current word')
        self.assertContains(response, 'words learned')

    def test_result_summary_thresholds(self):
        self.assertEqual(ChallengeChapterService.result_summary(96)['title'], 'Very good!')
        self.assertEqual(ChallengeChapterService.result_summary(88)['title'], 'Good job!')
        self.assertEqual(ChallengeChapterService.result_summary(72)['title'], 'Nice work!')
        self.assertEqual(ChallengeChapterService.result_summary(68)['title'], 'Try again!')

    def test_quiz_uses_all_words_in_chapter(self):
        for index in range(12):
            VocabularyEntry.objects.create(german=f'wort-{index}', english=f'word-{index}', source_section='1.1', is_active=True)

        response = Client(HTTP_HOST='127.0.0.1').get('/quiz/?chapter=1')
        self.assertEqual(response.status_code, 200)
        field_names = re.findall(r'name="(answer-[^"]+)"', response.content.decode('utf-8'))
        unique_names = set(field_names)
        self.assertEqual(len(unique_names), VocabularyEntry.objects.filter(is_active=True, source_section__startswith='1.').count())

    def test_matching_quiz_uses_all_words_in_chapter(self):
        for index in range(12):
            VocabularyEntry.objects.create(german=f'match-{index}', english=f'meaning-{index}', source_section='1.1', is_active=True)

        response = Client(HTTP_HOST='127.0.0.1').get('/quiz/matching/?chapter=1')
        self.assertEqual(response.status_code, 200)
        pair_ids = re.findall(r'data-pair-id="([^"]+)"', response.content.decode('utf-8'))
        self.assertEqual(len(set(pair_ids)), VocabularyEntry.objects.filter(is_active=True, source_section__startswith='1.').count())

    def test_challenge_page_shows_result_banner_for_high_score(self):
        client = Client(HTTP_HOST='127.0.0.1')
        session = client.session
        session['challenge_state'] = {
            'word_ids': [str(VocabularyEntry.objects.first().id)],
            'index': 0,
            'direction': 'en_to_de',
            'correct_answers': 19,
            'incorrect_answers': 1,
            'words_with_hints': 0,
            'fully_revealed': 0,
            'total_attempts': 20,
            'hint_level': 0,
            'last_result': 'very_good',
            'last_message': 'You did well.',
            'revealed_answer': False,
        }
        session.save()

        response = client.get('/challenge/')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Very good!')
        self.assertContains(response, 'result-banner')

    def test_learn_view_shows_one_word_at_a_time_with_progress(self):
        for index in range(3):
            VocabularyEntry.objects.create(german=f'wort-{index}', english=f'word-{index}', source_section='1.1', is_active=True)

        response = Client(HTTP_HOST='127.0.0.1').get('/vocabulary/?chapter=1&index=1')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'A1.1 Chapter 1')
        self.assertContains(response, 'Previous')
        self.assertContains(response, 'Next')
        self.assertContains(response, 'Current word')
        self.assertContains(response, 'words learned')

    def test_word_mastery_tracks_correct_and_incorrect_attempts(self):
        user = User.objects.create_user(username='mastery-user', password='pass1234')
        word = VocabularyEntry.objects.create(german='lernen', english='to learn', is_active=True)

        progress = UserWordProgress.record_attempt(user, word, True)
        self.assertEqual(progress.correct_count, 1)
        self.assertEqual(progress.incorrect_count, 0)
        self.assertEqual(progress.status, StudyStatus.LEARNING)

        progress = UserWordProgress.record_attempt(user, word, False)
        self.assertEqual(progress.correct_count, 1)
        self.assertEqual(progress.incorrect_count, 1)
        self.assertEqual(progress.status, StudyStatus.LEARNING)
        self.assertEqual(progress.mastery_label(), 'Learning')

        UserWordProgress.record_attempt(user, word, True)
        UserWordProgress.record_attempt(user, word, True)
        UserWordProgress.record_attempt(user, word, True)
        progress.refresh_from_db()

        self.assertEqual(progress.correct_count, 4)
        self.assertEqual(progress.incorrect_count, 1)
        self.assertEqual(progress.status, StudyStatus.LEARNED)
        self.assertEqual(progress.mastery_label(), 'Know well')
