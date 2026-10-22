from django.urls import path

from .consumers import LiveConsumer

websocket_urlpatterns = [path("ws/v1/", LiveConsumer.as_asgi())]
