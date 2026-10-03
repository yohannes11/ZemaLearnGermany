from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods

from apps.core.i18n import normalize
from apps.core.utils import BadJSON, json_error, read_json

from .models import TextOverride, check_text, published_texts, text_key
from .texts import can_edit_text

MAX_CHANGES = 2000


@require_http_methods(["GET", "PUT"])
@never_cache
def texts(request):
    """The published text changes. PUT publishes an admin's edits: {"set": {text: new text}, "reset": [text]}."""
    if not can_edit_text(request.user):
        if not request.user.is_authenticated:
            return json_error("Please sign in.", 401)
        return json_error("Admins only.", 403)
    editor = request.user if request.user.is_authenticated else None
    if request.method == "GET":
        return JsonResponse({"texts": published_texts()})

    try:
        data = read_json(request, max_bytes=4 * 1024 * 1024)
    except BadJSON as error:
        return json_error(str(error), 400)
    changes, resets = data.get("set", {}), data.get("reset", [])
    if not isinstance(changes, dict) or not isinstance(resets, list) or not all(isinstance(r, str) for r in resets):
        return json_error('Send {"set": {text: new text}, "reset": [text]}.', 400)
    if len(changes) + len(resets) > MAX_CHANGES:
        return json_error(f"Publish at most {MAX_CHANGES} changes at a time.", 400)
    for source, text in changes.items():
        error = check_text(source, text) if isinstance(text, str) else "Text must be a string."
        if error:
            return json_error(f"{error} ({normalize(source)[:60]})", 400)

    with transaction.atomic():
        TextOverride.objects.filter(key__in=[text_key(source) for source in resets]).delete()
        for source, text in changes.items():
            if normalize(source) == normalize(text):
                TextOverride.objects.filter(key=text_key(source)).delete()
                continue
            record = TextOverride.objects.filter(key=text_key(source)).first() or TextOverride(source=source)
            record.text, record.updated_by = text, editor
            record.save()
    return JsonResponse({"texts": published_texts()})
