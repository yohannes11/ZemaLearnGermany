from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.content.models import TextOverride

from .notify import content_changed


@receiver(post_save, sender=TextOverride)
@receiver(post_delete, sender=TextOverride)
def text_changed(**kwargs):
    content_changed()
