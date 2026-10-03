from django.contrib import admin

from .models import TextOverride


@admin.register(TextOverride)
class TextOverrideAdmin(admin.ModelAdmin):
    list_display = ("source", "text", "updated_by", "updated_at")
    search_fields = ("source", "text")
    readonly_fields = ("updated_by", "updated_at")

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
