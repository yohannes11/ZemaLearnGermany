"""Give every existing account a username, made from its email address ("marta@x.com" -> "marta").

The field is added as optional here and made required and unique in the next migration.
"""

import re

from django.db import migrations, models

USERNAME_MIN, USERNAME_MAX = 3, 30


def username_base(email):
    local = email.split("@", 1)[0]
    base = re.sub(r"[^A-Za-z0-9._-]", "", local).lstrip("._-")[:USERNAME_MAX]
    return base if len(base) >= USERNAME_MIN else (base + "user")[:USERNAME_MAX]


def fill_usernames(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    taken = set()
    for user in User.objects.order_by("date_joined", "pk"):
        base = username_base(user.email)
        candidate, number = base, 1
        while candidate.lower() in taken:
            number += 1
            candidate = base[: USERNAME_MAX - len(str(number))] + str(number)
        taken.add(candidate.lower())
        user.username = candidate
        user.save(update_fields=["username"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="username",
            field=models.CharField(max_length=30, null=True, verbose_name="username"),
        ),
        migrations.RunPython(fill_usernames, migrations.RunPython.noop),
    ]
