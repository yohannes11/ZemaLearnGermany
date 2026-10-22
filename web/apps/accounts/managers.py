from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    """Users have a unique username and a unique email; both are matched without regard to case."""

    use_in_migrations = True

    def get_by_natural_key(self, username):
        return self.get(username__iexact=username)

    def find_by_login(self, login):
        """The user a sign-in name refers to: an email address if it contains "@", otherwise a username."""
        login = (login or "").strip()
        if not login:
            return None
        lookup = {"email__iexact": login} if "@" in login else {"username__iexact": login}
        return self.filter(**lookup).first()

    def _create_user(self, username, email, password, **extra_fields):
        if not username:
            raise ValueError("A username is required.")
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(username=username, email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, email, password, **extra_fields)

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields["is_staff"] is not True or extra_fields["is_superuser"] is not True:
            raise ValueError("A superuser needs is_staff=True and is_superuser=True.")
        return self._create_user(username, email, password, **extra_fields)
