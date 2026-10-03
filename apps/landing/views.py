import json
import math

from django.conf import settings
from django.shortcuts import redirect, render
from django.templatetags.static import static
from django.urls import reverse
from django.views.decorators.http import require_GET

from apps.core.i18n import localize, translate

from . import content

AUDIO_SAMPLES = [
    # Clips from the course's own recordings (see static/audio/manifest.json).
    {"german": "Hallo!", "english": "Hello!", "clip": "f02a27e2f102fa75"},
    {"german": "Guten Tag!", "english": "Good day!", "clip": "a5b81f9cf47b4f7b"},
]


def _notes(keys, numbers):
    return [{"n": numbers[key], "url": content.SOURCES[key]["url"]} for key in keys]


def _image(key):
    meta = content.IMAGES[key]
    small, large = static(f"landing/img/{key}-720.jpg"), static(f"landing/img/{key}-1400.jpg")
    return {**meta, "key": key, "src": large, "srcset": f"{small} 720w, {large} {meta['width']}w"}


def _structured_data(request):
    """schema.org data for search engines: the organisation, the free course and the FAQ."""
    home = request.build_absolute_uri(reverse("landing:index"))
    data = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "Organization", "@id": f"{home}#org", "name": "ZemaLearn", "url": home},
            {
                "@type": "Course",
                "name": "German A1.1 for learners in Ethiopia",
                "description": (
                    f"{content.COURSE_FACTS['units']} units, {content.COURSE_FACTS['words']} words and "
                    f"{content.COURSE_FACTS['lessons']} lessons with audio, exercises and speaking practice."
                ),
                "inLanguage": "de",
                "educationalLevel": "A1",
                "isAccessibleForFree": True,
                "provider": {"@id": f"{home}#org"},
                "url": request.build_absolute_uri(reverse("course:index")),
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {"@type": "Question", "name": item["q"], "acceptedAnswer": {"@type": "Answer", "text": item["a"]}}
                    for item in content.FAQ
                ],
            },
        ],
    }
    # Escape "<" so the JSON can never close the <script> element it is embedded in.
    return json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")


@require_GET
def index(request):
    """The public front page. Signed-in learners go straight to their course."""
    if request.user.is_authenticated:
        return redirect("course:index")

    lang = request.LANG
    numbers = {key: i for i, key in enumerate(content.SOURCE_ORDER, start=1)}
    stats = [
        {**s, "notes": _notes([s["source"]], numbers)}
        for s in localize(content.STATS, lang, ("display", "label", "detail"))
    ]
    paths = [
        {**p, "notes": _notes(p["sources"], numbers), "img": _image(p["image"]) if p.get("image") else None}
        for p in localize(content.PATHS, lang, ("title", "alt", "body", "needs"))
    ]
    reasons = [
        {**r, "notes": _notes(r["sources"], numbers)} for r in localize(content.REASONS_NOW, lang, ("title", "body"))
    ]
    levels = [
        {**lv, "notes": _notes(lv["sources"], numbers)}
        for lv in localize(content.LEVELS, lang, ("name", "can", "opens", "status_label"))
    ]
    sources = [{**content.SOURCES[key], "n": numbers[key]} for key in content.SOURCE_ORDER]
    samples = [
        {**s, "meaning": translate(s["english"], lang), "src": f"{settings.AUDIO_URL}katja/normal/{s['clip']}.mp3"}
        for s in AUDIO_SAMPLES
    ]

    context = {
        "stats": stats,
        "paths": paths,
        "reasons": reasons,
        "levels": levels,
        "features": localize(content.FEATURES, lang, ("title", "body")),
        "faq": localize(content.FAQ, lang, ("q", "a")),
        # The pace calculator's first answer (10 words a day), before the page's script takes over.
        "calc_weeks": round(math.ceil(content.COURSE_FACTS["words"] / 10) / 7),
        "sources": sources,
        "facts": content.COURSE_FACTS,
        "samples": samples,
        "img": {key: _image(key) for key in content.IMAGES},
        "credits": [_image(key) for key in content.IMAGES],
        "canonical_url": request.build_absolute_uri(reverse("landing:index")),
        "structured_data": _structured_data(request),
        "learn_url": reverse("course:index"),
    }
    return render(request, "landing/index.html", context)
