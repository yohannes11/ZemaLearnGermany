from django import template
from learning.translations import get_translation

register = template.Library()


@register.filter
def get_item(dictionary, key):
    if not isinstance(dictionary, dict):
        return False
    return dictionary.get(key, False)


@register.simple_tag
def translate(key, language='en', **kwargs):
    """Translate a key to the specified language."""
    return get_translation(key, language, **kwargs)
