import unittest

from learning.challenges import ChallengeDirection, ChallengeChapterService


class ChallengeChapterServiceTests(unittest.TestCase):
    def test_hint_reveals_letters_progressively(self):
        self.assertEqual(
            ChallengeChapterService.build_hint('Apfel', 1),
            'A _ _ _ _',
        )
        self.assertEqual(
            ChallengeChapterService.build_hint('Apfel', 2),
            'A p _ _ _',
        )
        self.assertEqual(
            ChallengeChapterService.build_hint('Apfel', 3),
            'A p f _ _',
        )

    def test_direction_uses_existing_vocabulary_fields(self):
        word = type('Word', (), {'german': 'Apfel', 'english': 'apple'})()
        prompt, answer = ChallengeChapterService.get_prompt_and_answer(word, ChallengeDirection.EN_TO_DE.value)
        self.assertEqual(prompt, 'apple')
        self.assertEqual(answer, 'Apfel')

        prompt, answer = ChallengeChapterService.get_prompt_and_answer(word, ChallengeDirection.DE_TO_EN.value)
        self.assertEqual(prompt, 'Apfel')
        self.assertEqual(answer, 'apple')
