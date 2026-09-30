from django.urls import path

from . import views

app_name = "analytics"

urlpatterns = [
    path("dashboard/", views.dashboard, name="dashboard"),
    path("api/events/", views.events, name="events"),
    path("api/dashboard/stats/", views.stats, name="stats"),
    path("api/dashboard/stats.csv", views.stats_csv, name="stats-csv"),
    path("api/dashboard/users/", views.users, name="users"),
    path("api/dashboard/users/<int:pk>/actions/", views.user_action, name="user-action"),
]
