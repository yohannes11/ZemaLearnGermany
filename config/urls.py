from django.conf import settings
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path

from apps.accounts.forms import AdminSiteLoginForm, LoginPageForm

admin.site.site_header = "Zema German administration"
admin.site.site_title = "Zema German admin"
admin.site.login_form = AdminSiteLoginForm

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path(
        "accounts/login/",
        auth_views.LoginView.as_view(authentication_form=LoginPageForm, redirect_authenticated_user=True),
        name="login",
    ),
    path("accounts/logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("api/auth/", include("apps.accounts.urls")),
    path("", include("apps.analytics.urls")),
    path("", include("apps.course.urls")),
    path("", include("apps.core.urls")),
]
