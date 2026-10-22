from django.contrib import admin

from .models import Progress


@admin.register(Progress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "words_learned", "lessons_passed", "updated_at")
    search_fields = ("user__username", "user__email", "user__name")
    list_select_related = ("user",)
    readonly_fields = ("updated_at",)
    autocomplete_fields = ("user",)
