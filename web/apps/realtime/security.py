from channels.security.websocket import OriginValidator
from django.conf import settings


class BrowserOriginValidator(OriginValidator):
    """Browsers must connect from this site (another site could otherwise use a learner's cookie). Native apps
    send no Origin and carry no cookie; they sign in with their token in the first message instead."""

    def valid_origin(self, parsed_origin):
        return parsed_origin is None or super().valid_origin(parsed_origin)


def browser_origin_validator(application):
    hosts = settings.ALLOWED_HOSTS or (["localhost", "127.0.0.1", "[::1]"] if settings.DEBUG else [])
    return BrowserOriginValidator(application, hosts)
