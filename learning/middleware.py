"""
Middleware for handling language selection.
"""


class LanguageMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Get language from query param, session, or default to 'en'
        language = request.GET.get('lang') or request.session.get('language', 'en')

        # Validate language
        if language not in ['en', 'am']:
            language = 'en'

        # Store in request
        request.language = language

        # Store in session
        request.session['language'] = language
        request.session.modified = True

        response = self.get_response(request)
        return response
