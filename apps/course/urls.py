from django.urls import path
from django.views.generic import RedirectView

from . import views

app_name = "course"

urlpatterns = [
    path("", views.index, name="index"),
    path("api/progress/", views.progress, name="progress"),
    # The course used to live at this address; keep old links and bookmarks working.
    path("german-a1-course.html", RedirectView.as_view(pattern_name="course:index", permanent=True)),
]
