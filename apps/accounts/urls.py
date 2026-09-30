from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("me/", views.me, name="me"),
    path("register/", views.register, name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("password/", views.change_password, name="password"),
]
