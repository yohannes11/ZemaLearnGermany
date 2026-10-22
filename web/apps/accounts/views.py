"""JSON endpoints behind the course's Sign in dialog, and the mobile app's token sign-in. Writes from the web
are CSRF-protected (the course page sends Django's token in X-CSRFToken); the app signs its requests with a
bearer token instead (see tokens.py)."""

from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.forms import PasswordChangeForm
from django.core import signing
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.core.utils import BadJSON, form_error, json_error, read_json

from .decorators import api_login_required
from .forms import LoginForm, RegistrationForm
from .models import User
from .tokens import issue_token


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
    login(request, user, backend="apps.accounts.backends.UsernameOrEmailBackend")
    return JsonResponse({"user": user.as_public_dict()})


def check_login(request, data):
    """The user `data` ({login, password}) signs in as, or the error response. Shared by the web's session
    sign-in and the app's token sign-in, so both are throttled by axes and answer the same way."""
    form = LoginForm(data)
    if not form.is_valid():
        return None, json_error("Username, email or password is not correct.", 401)
    login_name, password = form.cleaned_data["login"], form.cleaned_data["password"]

    user = authenticate(request, username=login_name, password=password)
    if user is None:
        if getattr(request, "axes_locked_out", False):
            return None, json_error("Too many attempts. Please wait 15 minutes and try again.", 429)
        account = User.objects.find_by_login(login_name)
        if account and not account.is_active and account.check_password(password):
            return None, json_error("This account has been disabled. Please contact the site admin.", 403)
        return None, json_error("Username, email or password is not correct.", 401)
    return user, None


@require_POST
def login_view(request):
    try:
        user, error = check_login(request, read_json(request))
    except BadJSON as error:
        return json_error(str(error), 400)
    if error:
        return error
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
    # Keep this session (or app sign-in) signed in; every other session and app sign-in of the user ends.
    update_session_auth_hash(request, form.user)
    current = getattr(request, "api_token", None)
    form.user.api_tokens.exclude(pk=current.pk if current else None).delete()
    return JsonResponse({})


# --------------------------------------------------------------------------- the mobile app's sign-in


# The app has no CSRF cookie before it signs in. These answer with a token in the body and never start a
# browser session, so a forged request from another site gains nothing; requests afterwards carry the token.
@csrf_exempt
@require_POST
def token_register(request):
    """Like register, but answers with a token for the app instead of starting a session."""
    try:
        data = read_json(request)
    except BadJSON as error:
        return json_error(str(error), 400)
    form = RegistrationForm(data)
    if not form.is_valid():
        return form_error(form)
    user = form.save()
    return JsonResponse({"user": user.as_public_dict(), "token": issue_token(user, str(data.get("device", "")))})


@csrf_exempt
@require_http_methods(["POST", "DELETE"])
def token(request):
    """POST {login, password, device?}: sign the app in, answering with a token. DELETE: sign this device out."""
    if request.method == "DELETE":
        current = getattr(request, "api_token", None)
        if current is None:
            return json_error("Send the token to sign out in the Authorization header.", 401)
        current.delete()
        return JsonResponse({})

    try:
        data = read_json(request)
    except BadJSON as error:
        return json_error(str(error), 400)
    user, error = check_login(request, data)
    if error:
        return error
    return JsonResponse({"user": user.as_public_dict(), "token": issue_token(user, str(data.get("device", "")))})


# --------------------------------------------------------------------------- from the app to the website, signed in

HANDOFF_SALT = "accounts.web-handoff"
HANDOFF_MAX_AGE = 120  # seconds


def _login_stamp(user):
    return user.last_login.isoformat() if user.last_login else ""


@require_POST
@api_login_required
def web_session_link(request):
    """For the app: a link that opens the website signed in as the same learner (single sign-on).

    The link works for two minutes and only once: it carries the time of the learner's last sign-in, which
    signing in through it changes."""
    code = signing.dumps({"u": request.user.pk, "l": _login_stamp(request.user)}, salt=HANDOFF_SALT)
    next_url = request.GET.get("next", "")
    if not url_has_allowed_host_and_scheme(next_url, allowed_hosts=None):
        next_url = reverse("course:index")
    url = request.build_absolute_uri(f"{reverse('accounts:handoff')}?code={code}&next={next_url}")
    return JsonResponse({"url": url, "expiresIn": HANDOFF_MAX_AGE})


def _handoff_user(code):
    try:
        data = signing.loads(code, salt=HANDOFF_SALT, max_age=HANDOFF_MAX_AGE)
    except signing.BadSignature:
        return None
    user = User.objects.filter(pk=data.get("u"), is_active=True).first()
    return user if user and _login_stamp(user) == data.get("l") else None


@never_cache
@require_http_methods(["GET", "POST"])
def handoff(request):
    """GET shows "Continue as …"; POST signs in. Signing in only on a button press means a link preview or
    scanner can't use the link up, and nobody is signed into someone else's account without seeing whose."""
    code = request.POST.get("code") or request.GET.get("code", "")
    next_url = request.POST.get("next") or request.GET.get("next", "")
    if not url_has_allowed_host_and_scheme(
        next_url, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        next_url = reverse("course:index")
    user = _handoff_user(code)
    if user is None:
        return render(request, "registration/handoff.html", {"expired": True, "next": next_url}, status=400)
    if request.method == "GET":
        return render(request, "registration/handoff.html", {"handoff_user": user, "code": code, "next": next_url})
    login(request, user, backend="apps.accounts.backends.UsernameOrEmailBackend")
    return redirect(next_url)
