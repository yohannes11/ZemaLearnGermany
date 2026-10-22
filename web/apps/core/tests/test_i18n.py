import json

from django.http import HttpResponse
from django.template import Context, Template
from django.test import RequestFactory, SimpleTestCase, TestCase
from django.urls import reverse

from apps.core.i18n import COOKIE, LOCALE_DIR, PLACEHOLDER, LanguageMiddleware, translate
from apps.core.i18n_sources import all_strings


class CatalogTests(SimpleTestCase):
    """locale/am.json translates every interface string, and only those."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.catalog = json.loads((LOCALE_DIR / "am.json").read_text(encoding="utf-8"))
        cls.strings = all_strings()

    def test_every_string_is_translated(self):
        for section, strings in self.strings.items():
            missing = sorted(s for s in strings if not self.catalog[section].get(s))
            self.assertEqual(missing, [], f"run manage.py i18n_missing ({section})")

    def test_no_unused_translations(self):
        for section, strings in self.strings.items():
            self.assertEqual(sorted(set(self.catalog[section]) - strings), [], section)

    def test_placeholders_survive_translation(self):
        for section in self.catalog.values():
            for english, amharic in section.items():
                self.assertEqual(set(PLACEHOLDER.findall(english)), set(PLACEHOLDER.findall(amharic)), english)

    def test_translations_are_written_in_fidel(self):
        # Numbers, German titles and brand names may stay as they are; everything else should be Amharic.
        latin_only = [
            v
            for section in self.catalog.values()
            for k, v in section.items()
            if v == k and any(c.isalpha() for c in k) and not any(0x1200 <= ord(c) <= 0x137F for c in v)
        ]
        self.assertLessEqual(len(latin_only), 12, latin_only)


class TemplateTagTests(SimpleTestCase):
    def render(self, source, lang, **context):
        return Template("{% load zema_i18n %}" + source).render(Context({"lang": lang, **context}))

    def test_t_translates_and_fills_values(self):
        self.assertEqual(self.render('{% t "Source {n}" n=3 %}', "am"), "ምንጭ 3")
        self.assertEqual(self.render('{% t "Source {n}" n=3 %}', "en"), "Source 3")

    def test_values_are_escaped(self):
        html = self.render('{% t_html "Play “{german}”, which means {meaning}" german=x meaning="y" %}', "en", x="<b>")
        self.assertIn("&lt;b&gt;", html)

    def test_unknown_strings_fall_back_to_english(self):
        self.assertEqual(translate("Not in the catalog", "am"), "Not in the catalog")


class LanguageSwitchTests(TestCase):
    def test_english_by_default(self):
        response = self.client.get(reverse("landing:index"))
        self.assertContains(response, '<html lang="en">')
        self.assertContains(response, "Start learning German")
        self.assertContains(response, "?lang=am")

    def test_choosing_amharic_is_remembered(self):
        response = self.client.get(reverse("landing:index") + "?lang=am")
        self.assertContains(response, '<html lang="am">')
        self.assertContains(response, "ጀርመንኛ መማር ይጀምሩ")
        self.assertEqual(response.cookies[COOKIE].value, "am")
        again = self.client.get(reverse("landing:index"))
        self.assertContains(again, '<html lang="am">')
        back = self.client.get(reverse("landing:index") + "?lang=en")
        self.assertContains(back, "Start learning German")

    def test_amharic_browsers_get_amharic(self):
        response = self.client.get(reverse("landing:index"), HTTP_ACCEPT_LANGUAGE="am-ET,am;q=0.9,en;q=0.5")
        self.assertContains(response, '<html lang="am">')

    def test_course_page_sends_its_strings(self):
        response = self.client.get(reverse("course:index") + "?lang=am")
        config = response.context["app_config"]
        self.assertEqual(config["lang"], "am")
        self.assertEqual(config["messages"]["Show meaning"], "ትርጉሙን ይመልከቱ")
        self.assertContains(response, "ቅንብሮች")
        english = self.client.get(reverse("course:index") + "?lang=en")
        self.assertEqual(english.context["app_config"]["messages"], {})

    def test_responses_vary_by_language(self):
        response = self.client.get(reverse("landing:index"))
        self.assertIn("Accept-Language", response["Vary"])
        self.assertIn("Cookie", response["Vary"])


class MiddlewareTests(SimpleTestCase):
    def test_unknown_languages_are_ignored(self):
        request = RequestFactory().get("/?lang=xx")
        response = LanguageMiddleware(lambda r: HttpResponse())(request)
        self.assertEqual(request.LANG, "en")
        self.assertNotIn(COOKIE, response.cookies)
