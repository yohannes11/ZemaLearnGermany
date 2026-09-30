from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class UsernameOrEmailBackend(ModelBackend):
    """Signs people in with their username or their email address (either one, any letter case)."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        login = username if username is not None else kwargs.get(User.USERNAME_FIELD)
        if login is None or password is None:
            return None
        user = User.objects.find_by_login(login)
        if user is None:
            # Hash anyway, so a wrong name takes as long as a wrong password (no account probing by timing).
            User().set_password(password)
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
