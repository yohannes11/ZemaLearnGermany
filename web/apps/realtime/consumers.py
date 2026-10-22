"""/ws/v1/: one live connection per open app or course page.

The website's page is signed in by its session cookie; the app sends its token as the first message, because a
WebSocket from a browser can't carry an Authorization header and a token in the address would end up in logs.
"""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.accounts.models import ApiToken
from apps.accounts.tokens import hash_key

from .notify import CONTENT_GROUP, user_group


@database_sync_to_async
def _token_user(key):
    token = ApiToken.objects.select_related("user").filter(key_hash=hash_key(key)).first()
    return token.user if token and token.user.is_active else None


class LiveConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.groups_joined = []
        await self.accept()
        await self._join(CONTENT_GROUP)
        user = self.scope.get("user")
        if user is not None and user.is_authenticated:
            await self._signed_in(user)

    async def receive_json(self, content, **kwargs):
        # {"type": "auth", "token": "…"}: the app signing this connection in.
        if content.get("type") == "auth" and isinstance(content.get("token"), str):
            user = await _token_user(content["token"])
            if user is None:
                await self.send_json({"type": "error", "error": "Your sign-in has expired."})
                await self.close(code=4401)
                return
            await self._signed_in(user)
        elif content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def _signed_in(self, user):
        await self._join(user_group(user.pk))
        await self.send_json({"type": "ready", "user": user.pk})

    async def _join(self, group):
        if group not in self.groups_joined:
            await self.channel_layer.group_add(group, self.channel_name)
            self.groups_joined.append(group)

    async def disconnect(self, code):
        for group in self.groups_joined:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def push(self, event):
        await self.send_json(event["message"])
