from django.urls import path

from . import views

app_name = "core"

urlpatterns = [
    path("healthz/", views.healthz, name="healthz"),
    path("ads.txt", views.ads_txt, name="ads-txt"),
    path("robots.txt", views.robots_txt, name="robots-txt"),
]
