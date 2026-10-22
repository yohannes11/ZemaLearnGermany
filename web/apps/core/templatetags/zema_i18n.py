"""{% t "English text" %} and {% t_html "Text with <em>markup</em>" %}: see apps/core/i18n.py.

Values passed as keywords fill {placeholders}: {% t "{count} words" count=facts.words %}. They are
escaped; t_html only trusts the translation file itself, so text an admin changed (apps/content) is escaped too.
"""

from django import template
from django.utils.html import conditional_escape
from django.utils.safestring import mark_safe

from apps.core.i18n import DEFAULT_LANGUAGE, fill, overridden, translate

register = template.Library()


def _lang(context) -> str:
    request = context.get("request")
    return context.get("lang") or getattr(request, "LANG", DEFAULT_LANGUAGE)


@register.simple_tag(takes_context=True)
def t(context, text, **values):
    return fill(translate(text, _lang(context)), values)


@register.simple_tag(takes_context=True)
def t_html(context, text, **values):
    found = translate(text, _lang(context), overrides=False)
    changed = overridden(found)
    html = conditional_escape(changed) if changed else found
    return mark_safe(fill(html, {k: conditional_escape(v) for k, v in values.items()}))  # noqa: S308
