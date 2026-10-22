import json

from asgiref.sync import async_to_sync
from asgiref.testing import ApplicationCommunicator
from channels.layers import get_channel_layer
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY
from django.contrib.sessions.backends.db import SessionStore
from django.test import TransactionTestCase, override_settings

from apps.accounts.models import User
from apps.accounts.tokens import issue_token
from apps.content.models import TextOverride
from apps.course import sync
from apps.realtime import notify
from config.asgi import application

LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


class WebsocketCommunicator(ApplicationCommunicator):
    """A WebSocket client for tests (channels.testing has one, but importing it needs daphne)."""

    def __init__(self, app, path, headers=()):
        scope = {"type": "websocket", "path": path, "headers": list(headers), "query_string": b"", "subprotocols": []}
        super().__init__(app, scope)

    async def connect(self, timeout=1):
        await self.send_input({"type": "websocket.connect"})
        response = await self.receive_output(timeout)
        return response["type"] == "websocket.accept", response

    async def send_json_to(self, data):
        await self.send_input({"type": "websocket.receive", "text": json.dumps(data)})

    async def receive_json_from(self, timeout=1):
        return json.loads((await self.receive_output(timeout))["text"])

    async def disconnect(self, code=1000, timeout=1):
        await self.send_input({"type": "websocket.disconnect", "code": code})
        await self.wait(timeout)


@override_settings(CHANNEL_LAYERS=LAYERS, ALLOWED_HOSTS=["testserver"])
class LiveUpdatesTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user("liya", "liya@example.com", "learning-german-26", name="Liya")

    def session_cookie(self):
        session = SessionStore()
        session[SESSION_KEY] = str(self.user.pk)
        session[BACKEND_SESSION_KEY] = "apps.accounts.backends.UsernameOrEmailBackend"
        session[HASH_SESSION_KEY] = self.user.get_session_auth_hash()
        session.save()
        return f"sessionid={session.session_key}".encode()

    def connect(self, headers=()):
        return WebsocketCommunicator(application, "/ws/v1/", headers=list(headers))

    def test_website_page_signed_in_by_its_cookie_hears_progress(self):
        cookie = self.session_cookie()

        async def run():
            live = self.connect([(b"origin", b"http://testserver"), (b"cookie", cookie)])
            connected, _ = await live.connect()
            self.assertTrue(connected)
            self.assertEqual(await live.receive_json_from(), {"type": "ready", "user": self.user.pk})
            await get_channel_layer().group_send(
                notify.user_group(self.user.pk),
                {"type": "push", "message": {"type": "progress", "revision": 4, "origin": "x"}},
            )
            self.assertEqual(await live.receive_json_from(), {"type": "progress", "revision": 4, "origin": "x"})
            await live.disconnect()

        async_to_sync(run)()

    def test_app_signs_in_with_its_token(self):
        token = issue_token(self.user)

        async def run():
            live = self.connect()  # a native app: no Origin, no cookie
            self.assertTrue((await live.connect())[0])
            await live.send_json_to({"type": "auth", "token": token})
            self.assertEqual((await live.receive_json_from())["type"], "ready")
            await live.disconnect()

        async_to_sync(run)()

    def test_wrong_token_is_turned_away(self):
        async def run():
            live = self.connect()
            await live.connect()
            await live.send_json_to({"type": "auth", "token": "made-up"})
            self.assertEqual((await live.receive_json_from())["type"], "error")
            self.assertEqual((await live.receive_output())["type"], "websocket.close")

        async_to_sync(run)()

    def test_other_sites_cannot_connect_with_a_learners_cookie(self):
        cookie = self.session_cookie()

        async def run():
            live = self.connect([(b"origin", b"https://evil.example"), (b"cookie", cookie)])
            connected, _ = await live.connect()
            self.assertFalse(connected)

        async_to_sync(run)()

    def test_published_text_reaches_everyone_and_progress_only_its_learner(self):
        other = User.objects.create_user("dawit", "dawit@example.com", "learning-german-26", name="Dawit")
        cookie = self.session_cookie()

        async def run():
            mine = self.connect([(b"origin", b"http://testserver"), (b"cookie", cookie)])
            guest = self.connect()
            await mine.connect()
            await guest.connect()
            await mine.receive_json_from()  # ready
            await sync_and_publish()
            self.assertEqual((await mine.receive_json_from())["type"], "progress")
            self.assertEqual((await mine.receive_json_from())["type"], "content")
            self.assertEqual(await guest.receive_json_from(), {"type": "content"})  # not dawit's progress
            self.assertTrue(await guest.receive_nothing())
            await mine.disconnect()
            await guest.disconnect()

        from asgiref.sync import sync_to_async

        @sync_to_async
        def sync_and_publish():
            progress, _ = sync.sync(
                self.user, [{"id": "1", "kind": "xp", "at": 1_760_000_000_000, "day": "2026-10-10", "amount": 5}]
            )
            notify.progress_changed(self.user.pk, progress.revision)
            sync.sync(other, [{"id": "1", "kind": "xp", "at": 1_760_000_000_000, "day": "2026-10-10", "amount": 5}])
            notify.progress_changed(other.pk, 1)
            TextOverride.objects.create(source="Hello!", text="Hi!")

        async_to_sync(run)()


class HandoffTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user("liya", "liya@example.com", "learning-german-26", name="Liya")

    def link(self):
        token = issue_token(self.user)
        response = self.client.post("/api/v1/auth/web-session/", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(response.status_code, 200)
        return json.loads(response.content)["url"].replace("http://testserver", "")

    def test_link_asks_first_then_signs_in_once(self):
        url = self.link()
        page = self.client.get(url)
        self.assertContains(page, "Continue as Liya")
        self.assertNotIn("_auth_user_id", self.client.session)  # looking at the link signs nobody in
        code = page.context["code"]
        response = self.client.post("/api/auth/continue/", {"code": code, "next": "/learn/"})
        self.assertRedirects(response, "/learn/", fetch_redirect_response=False)
        self.assertEqual(int(self.client.session["_auth_user_id"]), self.user.pk)
        # Signing in changed last_login, so the same link no longer works.
        self.client.logout()
        self.assertEqual(self.client.post("/api/auth/continue/", {"code": code}).status_code, 400)

    def test_tampered_or_offsite_links(self):
        self.assertEqual(self.client.get("/api/auth/continue/?code=nonsense").status_code, 400)
        url = self.link()
        code = self.client.get(url).context["code"]
        response = self.client.post("/api/auth/continue/", {"code": code, "next": "https://evil.example/"})
        self.assertRedirects(response, "/learn/", fetch_redirect_response=False)
