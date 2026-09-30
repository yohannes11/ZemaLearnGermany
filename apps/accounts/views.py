"""JSON endpoints behind the course's Sign in dialog. All writes are CSRF-protected; the course page
sends Django's CSRF token in the X-CSRFToken header."""

from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.forms import PasswordChangeForm
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from apps.core.utils import BadJSON, form_error, json_error, read_json

from .decorators import api_login_required
from .forms import LoginForm, RegistrationForm
from .models import User


@require_GET
@never_cache
def me(request):
    user = request.user if request.user.is_authenticated else None
    return JsonResponse({"user": user.as_public_dict() if user else None})


@require_POST
def register(request):
    try:
        form = RegistrationForm(read_json(request))
    except BadJSON as error:
        return json_error(str(error), 400)
    if not form.is_valid():
        return form_error(form)
    user = form.save()
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return JsonResponse({"user": user.as_public_dict()})


@require_POST
def login_view(request):
    try:
        form = LoginForm(read_json(request))
    except BadJSON as error:
        return json_error(str(error), 400)
    if not form.is_valid():
        return json_error("Email or password is not correct.", 401)
    email, password = form.cleaned_data["email"], form.cleaned_data["password"]

    user = authenticate(request, email=email, password=password)
    if user is None:
        if getattr(request, "axes_locked_out", False):
            return json_error("Too many attempts. Please wait 15 minutes and try again.", 429)
        inactive = User.objects.filter(email__iexact=email, is_active=False).first()
        if inactive and inactive.check_password(password):
            return json_error("This account has been disabled. Please contact the site admin.", 403)
        return json_error("Email or password is not correct.", 401)

    login(request, user)
    return JsonResponse({"user": user.as_public_dict()})


@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({})


@require_POST
@api_login_required
def change_password(request):
    try:
        data = read_json(request)
    except BadJSON as error:
        return json_error(str(error), 400)
    form = PasswordChangeForm(
        request.user,
        {
            "old_password": data.get("current", ""),
            "new_password1": data.get("new", ""),
            "new_password2": data.get("new", ""),
        },
    )
    if not form.is_valid():
        return form_error(form)
    form.save()
    # Keep this session signed in; every other session of the user is signed out.
    update_session_auth_hash(request, form.user)
    return JsonResponse({})
