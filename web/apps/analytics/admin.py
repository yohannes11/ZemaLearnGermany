from django.contrib import admin

from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "type", "unit", "mode", "scope", "device", "user")
    list_filter = ("type", "mode", "device", "unit")
    search_fields = ("visitor_id", "session_id", "user__username", "user__email")
    date_hierarchy = "created_at"
    list_select_related = ("user",)
    raw_id_fields = ("user",)

    # Events are a log: they are recorded by the course, never edited by hand.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
