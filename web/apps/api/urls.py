"""/api/v1/: the addresses the mobile app uses. Published app builds stay in use for months, so these stay
the same; a change that would break them becomes /api/v2/."""

from django.urls import path

from apps.accounts import views as accounts
from apps.course import views as course

from . import views

app_name = "api"

urlpatterns = [
    path("", views.index, name="index"),
    path("course/", views.course, name="course"),
    path("why-german/", views.why_german, name="why-german"),
    path("auth/token/", accounts.token, name="token"),
    path("auth/register/", accounts.token_register, name="register"),
    path("auth/me/", accounts.me, name="me"),
    path("auth/password/", accounts.change_password, name="password"),
    path("progress/", course.progress, name="progress"),
    path("sync/", views.sync_view, name="sync"),
    path("auth/web-session/", accounts.web_session_link, name="web-session"),
]
