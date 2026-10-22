from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.templatetags.static import static
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.decorators import api_login_required
from apps.core.i18n import catalog
from apps.core.utils import BadJSON, json_error, read_json
from apps.realtime import notify

from . import sync
from .models import Progress


@require_GET
@ensure_csrf_cookie
def index(request):
    """The course: one page; everything after loading happens in the browser."""
    app_config = {
        # The interface language and its strings for the course's script (English needs none).
        "lang": request.LANG,
        "messages": catalog(request.LANG)["course"],
        "audioBase": settings.AUDIO_URL,
        "picBase": static("course/pics/"),
        "ads": settings.ADSENSE,
        "dashboardUrl": reverse("analytics:dashboard"),
        "api": {
            "me": reverse("accounts:me"),
            "register": reverse("accounts:register"),
            "login": reverse("accounts:login"),
            "logout": reverse("accounts:logout"),
            "password": reverse("accounts:password"),
            "progress": reverse("course:progress"),
            "sync": reverse("api:sync"),
            "live": "/ws/v1/",
            "events": reverse("analytics:events"),
        },
    }
    return render(request, "course/index.html", {"app_config": app_config})


@require_http_methods(["GET", "PUT"])
@never_cache
@api_login_required
def progress(request):
    """The course page's progress: GET it, or PUT the whole of it. Kept for pages opened before operations
    (sync.py); a PUT becomes operations, so it follows the same rules as every other device."""
    if request.method == "GET":
        record = Progress.objects.filter(user=request.user).first()
        return JsonResponse(record.as_dict() if record else Progress().as_dict())

    try:
        data = read_json(request, max_bytes=256 * 1024)
    except BadJSON as error:
        return json_error(str(error), 400)
    learned, grammar = data.get("learned", []), data.get("grammar", {})
    if not isinstance(learned, list) or not isinstance(grammar, dict):
        return json_error("Progress must have a list of words and a dict of grammar scores.", 400)
    current = Progress.objects.filter(user=request.user).first()
    today = timezone.localdate().isoformat()
    ops = sync.legacy_ops(current, learned, grammar, replace=bool(data.get("replace")), day=today)
    try:
        record, changed = sync.sync(request.user, ops)
    except sync.BadOperation as error:
        return json_error(str(error), 400)
    if changed:
        notify.progress_changed(request.user.pk, record.revision)
    return JsonResponse(record.as_dict())
