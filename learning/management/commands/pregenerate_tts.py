from django.core.management.base import BaseCommand

from learning.models import VocabularyEntry
from learning.tts import DEFAULT_NEURAL_VOICE, NEURAL_VOICES, SPEEDS, GermanTTSService


class Command(BaseCommand):
    help = 'Generate and cache German audio for every active vocabulary entry.'

    def add_arguments(self, parser):
        parser.add_argument('--voice', action='append', choices=list(NEURAL_VOICES), help='Repeatable. Defaults to Katja.')
        parser.add_argument('--speed', action='append', choices=list(SPEEDS), help='Repeatable. Defaults to all speeds.')

    def handle(self, *args, **options):
        voices = options['voice'] or [DEFAULT_NEURAL_VOICE]
        speeds = options['speed'] or list(SPEEDS)
        texts = sorted(set(VocabularyEntry.objects.filter(is_active=True).values_list('german', flat=True)))
        failed = 0
        for voice in voices:
            for speed in speeds:
                service = GermanTTSService(voice=voice, speed=speed)
                for text in texts:
                    if not service.synthesize(text):
                        failed += 1
                        self.stderr.write(f'Failed: {text} ({voice}, {speed})')
        total = len(texts) * len(voices) * len(speeds)
        self.stdout.write(self.style.SUCCESS(f'Cached {total - failed}/{total} clips.'))
