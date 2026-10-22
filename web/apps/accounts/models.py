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
