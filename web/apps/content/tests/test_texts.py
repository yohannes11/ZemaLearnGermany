import json

from django.template import Context, Template
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse

from apps.accounts.models import User
from apps.content.models import TextOverride, check_text, published_texts, text_key
from apps.core.i18n import placeholder_texts, text_overrides, translate

PASSWORD = "a-long-test-password"


class TextOverrideModelTests(TestCase):
    def test_save_collapses_whitespace_and_keys_by_hash(self):
        record = TextOverride.objects.create(source="  Skip  to\ncontent ", text=" Jump to the lesson ")
        self.assertEqual((record.source, record.text), ("Skip to content", "Jump to the lesson"))
        self.assertEqual(record.key, text_key("Skip to content"))
        self.assertEqual(published_texts(), {"Skip to content": "Jump to the lesson"})

    def test_check_text_keeps_placeholders(self):
        self.assertIsNone(check_text("{n} days", "{n} Tage"))
        self.assertIsNotNone(check_text("{n} days", "a few days"))
        self.assertIsNotNone(check_text("{n} days", "{count} days"))
        self.assertIsNotNone(check_text("Hello", "   "))


class TranslateOverrideTests(TestCase):
    def render(self, source, lang="en"):
        token = text_overrides.set(published_texts)
        try:
            return Template("{% load zema_i18n %}" + source).render(Context({"lang": lang}))
        finally:
            text_overrides.reset(token)

    def test_t_shows_the_changed_text_and_fills_placeholders(self):
        TextOverride.objects.create(source="{n} days", text="{n} whole days")
        self.assertEqual(self.render('{% t "{n} days" n=3 %}'), "3 whole days")

    def test_changes_apply_to_the_translation_as_shown(self):
        amharic = translate("Skip to content", "am", overrides=False)
        TextOverride.objects.create(source=amharic, text="ወደ ትምህርቱ")
        self.assertEqual(self.render('{% t "Skip to content" %}', lang="am"), "ወደ ትምህርቱ")
        self.assertEqual(self.render('{% t "Skip to content" %}'), "Skip to content")

    def test_t_html_escapes_changed_text(self):
        TextOverride.objects.create(source="Plain words", text="<b>bold</b>")
        self.assertEqual(self.render('{% t_html "Plain words" %}'), "&lt;b&gt;bold&lt;/b&gt;")

    def test_placeholder_texts_are_in_the_language_shown(self):
        self.assertIn("{n} days", placeholder_texts("en"))
        self.assertNotIn("{n} days", placeholder_texts("am"))
        self.assertTrue(all("{" in text for text in placeholder_texts("am")))


class TextsApiTests(TestCase):
    url = reverse("content:texts")

    def setUp(self):
        self.admin = User.objects.create_user("admin1", "admin@example.com", PASSWORD, is_staff=True)
        self.learner = User.objects.create_user("learner1", "learner@example.com", PASSWORD)

    def put(self, data):
        return self.client.put(self.url, json.dumps(data), content_type="application/json")

    def test_only_admins(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.client.force_login(self.learner)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.put({"set": {"Learn": "Study"}}).status_code, 403)

    def test_publish_sets_updates_and_resets(self):
        self.client.force_login(self.admin)
        response = self.put({"set": {"Learn": "Study", "Practice": "Drill"}})
        self.assertEqual(response.json()["texts"], {"Learn": "Study", "Practice": "Drill"})
        self.assertEqual(TextOverride.objects.get(source="Learn").updated_by, self.admin)

        response = self.put({"set": {"Learn": "Revise", "Practice": "Practice"}, "reset": []})
        self.assertEqual(response.json()["texts"], {"Learn": "Revise"})

        response = self.put({"reset": ["Learn"]})
        self.assertEqual(response.json()["texts"], {})
        self.assertEqual(self.client.get(self.url).json(), {"texts": {}})

    def test_refuses_lost_placeholders_and_bad_shapes(self):
        self.client.force_login(self.admin)
        self.assertEqual(self.put({"set": {"{n} days": "some days"}}).status_code, 400)
        self.assertEqual(self.put({"set": ["Learn"]}).status_code, 400)
        self.assertEqual(self.put({"set": {"Learn": 5}}).status_code, 400)
        self.assertEqual(self.put({"reset": [1]}).status_code, 400)
        self.assertFalse(TextOverride.objects.exists())


class PageTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin1", "admin@example.com", PASSWORD, is_staff=True)

    def test_visitors_load_nothing_while_no_text_is_changed(self):
        response = self.client.get(reverse("landing:index"))
        self.assertIsNone(response.context["zema_text"])
        self.assertNotContains(response, "zema-text.js")

    def test_visitors_get_published_changes_rendered_and_for_scripts(self):
        TextOverride.objects.create(source="Skip to content", text="Jump to the page")
        response = self.client.get(reverse("landing:index"))
        self.assertContains(response, "Jump to the page</a>")
        self.assertContains(response, "core/js/zema-text.js")
        self.assertNotContains(response, "zema-text-editor.js")
        config = response.context["zema_text"]
        self.assertEqual(config["texts"], {"Skip to content": "Jump to the page"})
        self.assertFalse(config["canEdit"])
        self.assertIsNone(config["api"])

    def test_admins_get_the_editor_on_every_page(self):
        self.client.force_login(self.admin)
        for url in (reverse("course:index"), reverse("landing:index"), reverse("analytics:dashboard")):
            response = self.client.get(url)
            self.assertContains(response, "zema-text-editor.js")
            self.assertEqual(response.context["zema_text"]["api"], reverse("content:texts"))

    def test_context_without_a_request_user(self):
        from apps.content.texts import text_context

        self.assertEqual(text_context(RequestFactory().get("/")), {"zema_text": None})


@override_settings(TEXT_EDITING_FOR_EVERYONE=True)
class EditingForEveryoneTests(TestCase):
    def test_visitors_get_the_editor_and_can_publish(self):
        response = self.client.get(reverse("landing:index"))
        self.assertContains(response, "zema-text-editor.js")
        self.assertIn("csrftoken", response.cookies)

        data = json.dumps({"set": {"Learn": "Study"}})
        response = self.client.put(reverse("content:texts"), data, content_type="application/json")
        self.assertEqual(response.json()["texts"], {"Learn": "Study"})
        self.assertIsNone(TextOverride.objects.get(source="Learn").updated_by)

    def test_signed_in_learners_stay_on_the_landing_page(self):
        learner = User.objects.create_user("learner1", "learner@example.com", PASSWORD)
        self.client.force_login(learner)
        self.assertEqual(self.client.get(reverse("landing:index")).status_code, 200)
