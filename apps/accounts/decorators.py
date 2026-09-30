"""Access checks for JSON API views: they answer with JSON errors instead of redirecting to a login page."""

from functools import wraps

from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied

from apps.core.utils import json_error


def api_login_required(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return json_error("Please sign in.", 401)
        return view(request, *args, **kwargs)

    return wrapped


def api_staff_required(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return json_error("Please sign in.", 401)
        if not request.user.is_staff:
            return json_error("Admins only.", 403)
        return view(request, *args, **kwargs)

    return wrapped


def staff_required(view):
    """For pages: signed-out visitors go to the login page; signed-in learners get a 403."""

    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect_to_login(request.get_full_path())
        if not request.user.is_staff:
            raise PermissionDenied
        return view(request, *args, **kwargs)

    return wrapped
