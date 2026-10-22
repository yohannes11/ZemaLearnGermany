"""Version 1 of the API the apps use. The web's own pages call the same views under their older addresses
(see config/urls.py); everything here answers in JSON, and signed-in requests carry a bearer token."""

import hashlib
import json

from django.conf import settings
from django.http import HttpResponseNotModified, JsonResponse
from django.templatetags.static import static
from django.utils.cache import patch_cache_control, patch_vary_headers
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.decorators import api_login_required
from apps.content.models import published_texts
from apps.core.i18n import DEFAULT_LANGUAGE, LANGUAGES, localize
from apps.core.utils import BadJSON, json_error, read_json
from apps.course import content, sync
from apps.course.models import Progress
from apps.landing import content as landing
from apps.realtime import notify

VOICES = ["katja", "conrad"]
SPEEDS = ["slow", "normal", "natural"]


@require_GET
@never_cache
def index(request):
    """What an app needs before anything else: where the media is, and which app versions still work."""
    absolute = request.build_absolute_uri
    return JsonResponse(
        {
            "api": 1,
            "minAppVersion": settings.MOBILE_MIN_APP_VERSION,
            "languages": LANGUAGES,
            "audio": {
                "base": absolute(settings.AUDIO_URL),
                "manifest": absolute(f"{settings.AUDIO_URL}manifest.json"),
                "voices": VOICES,
                "speeds": SPEEDS,
            },
            "pictureBase": absolute(static("course/pics/")),
        }
    )


@require_GET
def course(request):
    """The whole course, with the Amharic meanings for ?lang=am and every text change admins published.

    `version` changes whenever any of them does, and is also the ETag: an app sends it back in If-None-Match
    and gets a 304 while its offline copy is current, so checking for updates costs almost nothing.
    """
    lang = request.GET.get("lang", DEFAULT_LANGUAGE)
    if lang not in LANGUAGES:
        lang = DEFAULT_LANGUAGE
    data, course_hash = content.course()
    amharic, amharic_hash = content.amharic() if lang == "am" else (None, "")
    texts = published_texts()
    texts_hash = hashlib.sha256(json.dumps(texts, sort_keys=True).encode()).hexdigest()
    version = hashlib.sha256(f"{lang}:{course_hash}:{amharic_hash}:{texts_hash}".encode()).hexdigest()[:20]

    etag = f'"{version}"'
    if etag in [tag.strip() for tag in request.headers.get("If-None-Match", "").split(",")]:
        response = HttpResponseNotModified()
    else:
        response = JsonResponse(
            {"version": version, "lang": lang, "course": data, "amharic": amharic, "texts": texts},
            json_dumps_params={"ensure_ascii": False},
        )
    response["ETag"] = etag
    # Always ask again, but a 304 lets the app keep using what it already has.
    patch_cache_control(response, no_cache=True, public=True)
    patch_vary_headers(response, ["Accept-Encoding"])
    return response


def _lang(request):
    lang = request.GET.get("lang", DEFAULT_LANGUAGE)
    return lang if lang in LANGUAGES else DEFAULT_LANGUAGE


# Which figures back which reason, by their sources' keys (apps/landing/content.py).
PATH_STATS = {
    "study": ["daad-students", "daad-costs"],
    "career": ["kofa", "imf"],
    "life": ["aa-language", "aa-learners"],
}


def _source(key):
    source = landing.SOURCES[key]
    return {"publisher": source["publisher"], "title": source["title"], "date": source["date"], "url": source["url"]}


@require_GET
def why_german(request):
    """Why learn German, for the app's first screens: the landing page's figures and reasons, each with its
    official source, in the chosen language. One copy (apps/landing/content.py) for the website and the app."""
    lang = _lang(request)
    stats = [
        {"display": s["display"], "label": s["label"], "detail": s["detail"], "source": _source(s["source"])}
        for s in localize(landing.STATS, lang, ("display", "label", "detail"))
    ]
    paths = []
    for path in localize(landing.PATHS, lang, ("title", "body", "needs")):
        image = landing.IMAGES.get(path.get("image", ""))
        paths.append(
            {
                "key": path["key"],
                "title": path["title"],
                "body": path["body"],
                "needs": path.get("needs"),
                "image": image
                and {
                    "url": request.build_absolute_uri(static(f"landing/img/{path['image']}-720.jpg")),
                    "credit": f"{image['author']}, {image['license']}",
                    "width": image["width"],
                    "height": image["height"],
                },
                "sources": [_source(key) for key in path["sources"]],
                "stats": [
                    i for i, stat in enumerate(landing.STATS) if stat["source"] in PATH_STATS.get(path["key"], [])
                ],
            }
        )
    response = JsonResponse({"lang": lang, "stats": stats, "paths": paths}, json_dumps_params={"ensure_ascii": False})
    patch_cache_control(response, public=True, max_age=3600)
    return response


@require_http_methods(["GET", "POST"])
@never_cache
@api_login_required
def sync_view(request):
    """GET: the learner's whole state. POST {"ops": [...], "device": "…"}: apply this device's operations (each
    once, see apps/course/sync.py) and answer with the state they produced, which already includes every other
    device's changes. Other open devices are told to fetch it over /ws/v1/."""
    if request.method == "GET":
        record = Progress.objects.filter(user=request.user).first() or Progress()
        return JsonResponse(record.snapshot())
    try:
        data = read_json(request, max_bytes=512 * 1024)
    except BadJSON as error:
        return json_error(str(error), 400)
    try:
        record, changed = sync.sync(request.user, data.get("ops", []))
    except sync.BadOperation as error:
        return json_error(str(error), 400)
    if changed:
        device = data.get("device") if isinstance(data.get("device"), str) else ""
        notify.progress_changed(request.user.pk, record.revision, origin=device[:64])
    return JsonResponse(record.snapshot())
