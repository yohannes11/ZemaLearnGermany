from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower

from .managers import UserManager
from .validators import USERNAME_MAX, username_validator


class User(AbstractUser):
    """A learner or site admin. Admins are staff users: they can open the dashboard.

    People sign in with their username or their email address (see backends.UsernameOrEmailBackend).
    """

    username = models.CharField(
        "username",
        max_length=USERNAME_MAX,
        unique=True,
        validators=[username_validator],
        help_text=username_validator.message,
        error_messages={"unique": "This username is taken. Please choose another."},
    )
    first_name = None
    last_name = None
    email = models.EmailField("email address", unique=True)
    name = models.CharField("name", max_length=60)

    USERNAME_FIELD = "username"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["email", "name"]

    objects = UserManager()

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"
        ordering = ["-date_joined"]
        constraints = [
            models.UniqueConstraint(Lower("username"), name="accounts_user_username_ci_unique"),
            models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique"),
        ]

    def __str__(self):
        return f"{self.name} (@{self.username})"

    def get_full_name(self):
        return self.name

    def get_short_name(self):
        return self.name.split()[0] if self.name else self.username

    @property
    def role(self):
        return "admin" if self.is_staff else "learner"

    def as_public_dict(self):
        """What the course page may know about the signed-in user."""
        return {"id": self.pk, "username": self.username, "email": self.email, "name": self.name, "role": self.role}


class ApiToken(models.Model):
    """A signed-in device of the mobile app. The app sends `Authorization: Bearer <token>` instead of a session
    cookie; only the token's hash is stored, so a leaked database can't be used to sign in."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="api_tokens")
    key_hash = models.CharField(max_length=64, unique=True, editable=False)
    device = models.CharField("device", max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "app sign-in"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} on {self.device or 'a device'}"
