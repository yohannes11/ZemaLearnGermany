import json
import re
from pathlib import Path

from django.conf import settings
from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User
from apps.landing import content


class LandingPageTests(TestCase):
    url = reverse("landing:index")

    def test_visitors_see_the_landing_page(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "landing/index.html")
        self.assertContains(response, "Every journey to Germany begins with a")
        self.assertContains(response, f'href="{reverse("course:index")}#signup"')
        self.assertContains(response, f'href="{reverse("course:index")}"')

    def test_signed_in_learners_go_to_their_course(self):
        user = User.objects.create_user("liya", "liya@example.com", "learning-german-26", name="Liya")
        self.client.force_login(user)
        self.assertRedirects(self.client.get(self.url), reverse("course:index"))

    def test_every_figure_links_to_a_listed_source(self):
        html = self.client.get(self.url).content.decode()
        cited = {int(n) for n in re.findall(r'href="#source-(\d+)"', html)}
        listed = {int(n) for n in re.findall(r'id="source-(\d+)"', html)}
        self.assertTrue(cited, "the page should cite its sources")
        self.assertLessEqual(cited, listed)
        for stat in content.STATS:
            self.assertIn(stat["source"], content.SOURCES)

    def test_structured_data_is_valid_json(self):
        html = self.client.get(self.url).content.decode()
        block = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S).group(1)
        data = json.loads(block)
        types = {node["@type"] for node in data["@graph"]}
        self.assertEqual(types, {"Organization", "Course", "FAQPage"})
        self.assertEqual(len(data["@graph"][2]["mainEntity"]), len(content.FAQ))

    def test_seo_basics(self):
        response = self.client.get(self.url)
        self.assertContains(response, '<meta name="description"')
        self.assertContains(response, '<link rel="canonical" href="http://testserver/">')
        self.assertContains(response, 'property="og:image"')


class LandingAssetTests(TestCase):
    def test_every_image_exists_in_both_sizes_with_a_credit(self):
        folder = Path(settings.BASE_DIR) / "static" / "landing" / "img"
        for key, meta in content.IMAGES.items():
            for width in (720, 1400):
                self.assertTrue((folder / f"{key}-{width}.jpg").exists(), f"{key}-{width}.jpg")
            self.assertTrue(
                meta["author"] and meta["license"] and meta["page"].startswith("https://commons.wikimedia.org/")
            )

    def test_audio_samples_exist(self):
        from apps.landing.views import AUDIO_SAMPLES

        manifest = json.loads((Path(settings.BASE_DIR) / "static" / "audio" / "manifest.json").read_text())
        for sample in AUDIO_SAMPLES:
            self.assertEqual(manifest[sample["german"]], sample["clip"])


class SearchEngineFilesTests(TestCase):
    def test_robots_txt_points_to_sitemap(self):
        body = self.client.get("/robots.txt").content.decode()
        self.assertIn("Disallow: /api/", body)
        self.assertIn("Sitemap: http://testserver/sitemap.xml", body)

    def test_sitemap_lists_public_pages(self):
        body = self.client.get("/sitemap.xml").content.decode()
        self.assertIn("<loc>http://testserver/</loc>", body)
        self.assertIn(f"<loc>http://testserver{reverse('course:index')}</loc>", body)
