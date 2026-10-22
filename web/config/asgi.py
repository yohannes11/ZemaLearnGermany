"""ASGI entry point: the site over HTTP, and live updates over WebSockets (/ws/v1/, apps/realtime).
Served by gunicorn with uvicorn workers in production (deploy/zema.service); in development run
`uvicorn config.asgi:application --reload` (plain `manage.py runserver` serves the site without live updates)."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

# Django must be set up before anything imports models.
django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack  # noqa: E402
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from apps.realtime.routing import websocket_urlpatterns  # noqa: E402
from apps.realtime.security import browser_origin_validator  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": browser_origin_validator(AuthMiddlewareStack(URLRouter(websocket_urlpatterns))),
    }
)
