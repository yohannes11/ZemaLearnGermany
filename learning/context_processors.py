"""
Context processors for templates.
"""
from .translations import get_all_translations


def language_context(request):
    """Add language and translations to template context."""
    language = getattr(request, 'language', 'en')
    translations = get_all_translations(language)

    return {
        'current_language': language,
        'translations': translations,
        't': translations,  # Shorthand for templates
        'is_rtl': language == 'am',
    }
