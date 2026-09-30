import random
import unicodedata
from enum import Enum


class ChallengeDirection(str, Enum):
    EN_TO_DE = 'en_to_de'
    DE_TO_EN = 'de_to_en'

    @property
    def label(self):
        return {
            self.EN_TO_DE: 'English → German',
            self.DE_TO_EN: 'German → English',
        }[self]

    @classmethod
    def values(cls):
        return [choice.value for choice in cls]


class ChallengeChapterService:
    @staticmethod
    def normalize(value):
        normalized = unicodedata.normalize('NFKC', (value or '')).strip().lower()
        replacements = {
            '’': "'",
            '‘': "'",
            '“': '"',
            '”': '"',
            '–': '-',
            '—': '-',
            '…': '...',
        }
        for source, target in replacements.items():
            normalized = normalized.replace(source, target)
        return ' '.join(normalized.split())

    @staticmethod
    def build_hint(correct_answer, hint_level):
        answer = (correct_answer or '').strip()
        if not answer:
            return ''

        reveal_count = max(1, min(len(answer), max(1, hint_level)))
        revealed = []
        for index, char in enumerate(answer):
            if index < reveal_count:
                revealed.append(char)
            else:
                revealed.append('_')
        return ' '.join(revealed)

    @staticmethod
    def shuffled_words(words):
        ordered = list(words)
        random.shuffle(ordered)
        return ordered

    @staticmethod
    def get_prompt_and_answer(word, direction):
        if direction == ChallengeDirection.EN_TO_DE.value or direction == ChallengeDirection.EN_TO_DE:
            return word.english, word.german
        return word.german, word.english

    @staticmethod
    def get_total_hints(correct_answer):
        answer = (correct_answer or '').strip()
        return max(1, len(answer))

    @staticmethod
    def default_stats():
        return {
            'correct_answers': 0,
            'incorrect_answers': 0,
            'words_with_hints': 0,
            'fully_revealed': 0,
            'total_attempts': 0,
        }

    @staticmethod
    def score_percent(stats):
        attempts = stats.get('total_attempts', 0) or 1
        return round((stats.get('correct_answers', 0) / attempts) * 100, 1)

    @staticmethod
    def result_summary(score):
        score_value = float(score or 0)
        if score_value >= 95:
            return {
                'title': 'Very good!',
                'message': 'Excellent work — you really know your vocabulary.',
                'tone': 'very-good',
                'emoji': '🏆',
                'threshold': 'above 95',
            }
        if score_value >= 85:
            return {
                'title': 'Good job!',
                'message': 'Great effort — you are building strong German vocabulary.',
                'tone': 'good',
                'emoji': '✨',
                'threshold': 'above 85',
            }
        if score_value >= 70:
            return {
                'title': 'Nice work!',
                'message': 'Solid progress — keep going and you will improve fast.',
                'tone': 'decent',
                'emoji': '👍',
                'threshold': 'above 70',
            }
        return {
            'title': 'Try again!',
            'message': 'Keep practising — every round makes you stronger.',
            'tone': 'try-again',
            'emoji': '💪',
            'threshold': 'below 70',
        }
