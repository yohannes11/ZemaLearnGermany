from django.contrib.sitemaps import Sitemap
from django.urls import reverse


class PublicPagesSitemap(Sitemap):
    """The pages search engines should index: the landing page and the course."""

    changefreq = "monthly"

    def items(self):
        return ["landing:index", "course:index"]

    def location(self, item):
        return reverse(item)

    def priority(self, item):
        return 1.0 if item == "landing:index" else 0.8
