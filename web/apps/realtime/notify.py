"""Telling connected devices that something changed. Messages only say *what* changed (a revision or version);
devices then fetch it over the normal API, so a missed message costs nothing but a moment's delay."""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

logger = logging.getLogger(__name__)

CONTENT_GROUP = "content"


def user_group(user_id: int) -> str:
    return f"user-{user_id}"


def _send(group: str, message: dict):
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(group, {"type": "push", "message": message})
    except Exception:  # A down channel layer must never break saving progress; clients also poll.
        logger.exception("Could not send a live update to %s", group)


def progress_changed(user_id: int, revision: int, origin: str = ""):
    """After the transaction commits: the learner's other devices fetch the new progress."""
    message = {"type": "progress", "revision": revision, "origin": origin}
    transaction.on_commit(lambda: _send(user_group(user_id), message))


def content_changed():
    """Text an admin published: every device fetches the course again (its version tells it whether to)."""
    transaction.on_commit(lambda: _send(CONTENT_GROUP, {"type": "content"}))
