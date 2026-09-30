import json
from pathlib import Path
from django.core.management.base import BaseCommand

from learning.data.chapter_2_vocab import CHAPTER_2_VOCABULARY
from learning.data.pdf_vocab import PDF_VOCABULARY
from learning.models import VocabularyCategory, VocabularyEntry


class Command(BaseCommand):
    help = 'Import the A1.1 vocabulary from the PDF into the database.'

    def handle(self, *args, **options):
        combined_vocab = [*PDF_VOCABULARY, *CHAPTER_2_VOCABULARY]
        created = 0
        for item in combined_vocab:
            category, _ = VocabularyCategory.objects.get_or_create(
                slug=item['category'].lower().replace(' ', '-'),
                defaults={'name': item['category'].title(), 'description': 'Imported from the source PDF.'}
            )

            entry, was_created = VocabularyEntry.objects.update_or_create(
                german=item['german'],
                english=item['english'],
                defaults={
                    'article': item.get('article', ''),
                    'plural': item.get('plural', ''),
                    'pronunciation': item.get('pronunciation', ''),
                    'part_of_speech': item.get('part_of_speech', ''),
                    'category': category,
                    'source_section': item.get('source_section', ''),
                    'example_sentence': item.get('example_sentence', ''),
                    'english_example': item.get('english_example', ''),
                    'is_from_pdf': True,
                    'is_active': True,
                }
            )
            if was_created:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'Imported {created} new PDF vocabulary entries.'))
