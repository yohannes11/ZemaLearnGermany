import csv
import re

from django.contrib.auth import get_user_model
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from apps.accounts.decorators import api_staff_required, staff_required
from apps.core.utils import BadJSON, form_error, json_error, read_json

from .forms import EventForm, UserActionForm
from .reports import CSV_FIELDS, PERIODS, usage_report, user_rows
from .user_admin import ActionRefused, apply_action

MOBILE_AGENT = re.compile(r"Mobi|Android|iPhone|iPad")


@require_POST
def events(request):
    """Records one usage event from the course page."""
    try:
        form = EventForm(read_json(request, max_bytes=2048))
    except BadJSON as error:
        return json_error(str(error), 400)
    if not form.is_valid():
        return json_error("Bad event.", 400)
    device = "phone" if MOBILE_AGENT.search(request.headers.get("User-Agent", "")) else "desktop"
    form.to_event(user=request.user, device=device).save()
    return HttpResponse(status=204)


@require_GET
@staff_required
def dashboard(request):
    urls = {
        "stats": reverse("analytics:stats"),
        "statsCsv": reverse("analytics:stats-csv"),
        "users": reverse("analytics:users"),
        "userAction": reverse("analytics:user-action", args=[0]),
    }
    return render(request, "analytics/dashboard.html", {"urls": urls})


def _period(request) -> str:
    period = request.GET.get("period", "day")
    return period if period in PERIODS else "day"


@require_GET
@never_cache
@api_staff_required
def stats(request):
    return JsonResponse(usage_report(_period(request)))


@require_GET
@never_cache
@api_staff_required
def stats_csv(request):
    period = _period(request)
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="usage-{period}.csv"'
    writer = csv.DictWriter(response, fieldnames=CSV_FIELDS)
    writer.writeheader()
    writer.writerows(usage_report(period)["series"])
    return response


@require_GET
@never_cache
@api_staff_required
def users(request):
    return JsonResponse({"users": user_rows(request.GET.get("q", "").strip()), "me": request.user.pk})


@require_POST
@api_staff_required
def user_action(request, pk):
    target = get_user_model().objects.filter(pk=pk).first()
    if target is None:
        return json_error("That user no longer exists.", 404)
    try:
        form = UserActionForm(read_json(request))
    except BadJSON as error:
        return json_error(str(error), 400)
    if not form.is_valid():
        return form_error(form)
    try:
        result = apply_action(request.user, target, form.cleaned_data["action"])
    except ActionRefused as refusal:
        return json_error(str(refusal), 400)
    return JsonResponse(result)
