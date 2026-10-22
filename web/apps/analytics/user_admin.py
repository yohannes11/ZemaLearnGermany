"""Account actions an admin can take from the dashboard's Users tab."""

import secrets

from django.contrib.auth import get_user_model
from django.db import transaction


class ActionRefused(Exception):
    """The action is not allowed; the message explains why."""


REMOVES_ADMIN = {"disable", "make_learner", "delete"}


def active_admin_count() -> int:
    return get_user_model().objects.filter(is_staff=True, is_active=True).count()


@transaction.atomic
def apply_action(admin, target, action: str) -> dict:
    """Carry out `action` on `target`. Returns data for the response (a temporary password for resets)."""
    if target.pk == admin.pk and action in REMOVES_ADMIN:
        raise ActionRefused("You cannot do that to your own account.")
    if action in REMOVES_ADMIN and target.is_staff and target.is_active and active_admin_count() <= 1:
        raise ActionRefused("The site needs at least one active admin.")

    if action == "make_admin":
        target.is_staff = True
    elif action == "make_learner":
        target.is_staff = False
        target.is_superuser = False
    elif action == "disable":
        target.is_active = False  # an inactive user's sessions stop working immediately
    elif action == "enable":
        target.is_active = True
    elif action == "reset_password":
        temporary = secrets.token_urlsafe(9)
        target.set_password(temporary)  # changing the password signs out every session of the user
        target.save(update_fields=["password"])
        return {"temporary_password": temporary}
    elif action == "delete":
        target.delete()  # usage events stay, anonymously (Event.user is SET_NULL)
        return {}
    else:
        raise ActionRefused("Unknown action.")

    target.save(update_fields=["is_staff", "is_superuser", "is_active"])
    return {}
