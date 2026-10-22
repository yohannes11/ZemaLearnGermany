from django.conf import settings
from django.db import connection
from django.http import HttpResponse
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET


@require_GET
@never_cache
def healthz(request):
    """For uptime checks: 200 when the app and its database answer."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return HttpResponse("ok", content_type="text/plain")


@require_GET
def robots_txt(request):
    """Let search engines index the public pages, but not the private and API areas."""
    lines = [
        "User-agent: *",
        "Disallow: /api/",
        "Disallow: /accounts/",
        "Disallow: /dashboard/",
        f"Sitemap: {request.build_absolute_uri(reverse('sitemap'))}",
    ]
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain")


@require_GET
def ads_txt(request):
    """ads.txt for Google AdSense, built from the ADSENSE_CLIENT setting."""
    client = settings.ADSENSE["client"]
    if not client:
        return HttpResponse("# Set ADSENSE_CLIENT to publish the AdSense line here.\n", content_type="text/plain")
    publisher = client.removeprefix("ca-")
    return HttpResponse(f"google.com, {publisher}, DIRECT, f08c47fec0942fa0\n", content_type="text/plain")
