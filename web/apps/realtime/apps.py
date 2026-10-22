from django.apps import AppConfig


class RealtimeConfig(AppConfig):
    name = "apps.realtime"
    verbose_name = "Live updates"

    def ready(self):
        from . import signals  # noqa: F401  (connects the content-change signals)
