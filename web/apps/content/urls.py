from django.urls import path

from . import views

app_name = "content"

urlpatterns = [
    path("api/content/texts/", views.texts, name="texts"),
]
