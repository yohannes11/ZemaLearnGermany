from django.conf import settings
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.decorators import api_login_required
from apps.core.utils import BadJSON, json_error, read_json

from .models import Progress


@require_GET
@ensure_csrf_cookie
def index(request):
    """The course: one page; everything after loading happens in the browser."""
    app_config = {
        "audioBase": settings.AUDIO_URL,
        "ads": settings.ADSENSE,
        "dashboardUrl": reverse("analytics:dashboard"),
        "api": {
            "me": reverse("accounts:me"),
            "register": reverse("accounts:register"),
            "login": reverse("accounts:login"),
            "logout": reverse("accounts:logout"),
            "password": reverse("accounts:password"),
            "progress": reverse("course:progress"),
            "events": reverse("analytics:events"),
        },
    }
    return render(request, "course/index.html", {"app_config": app_config})


@require_http_methods(["GET", "PUT"])
@never_cache
@api_login_required
def progress(request):
    if request.method == "GET":
        record = Progress.objects.filter(user=request.user).first()
        return JsonResponse(record.as_dict() if record else {"learned": [], "grammar": {}})

    try:
        data = read_json(request, max_bytes=256 * 1024)
    except BadJSON as error:
        return json_error(str(error), 400)
    learned, grammar = data.get("learned", []), data.get("grammar", {})
    if not isinstance(learned, list) or not isinstance(grammar, dict):
        return json_error("Progress must have a list of words and a dict of grammar scores.", 400)

    # Lock the row so two devices saving at the same moment cannot overwrite each other's merge.
    with transaction.atomic():
        record, _ = Progress.objects.select_for_update().get_or_create(user=request.user)
        record.merge(learned, grammar, replace=bool(data.get("replace")))
        record.save()
    return JsonResponse(record.as_dict())
