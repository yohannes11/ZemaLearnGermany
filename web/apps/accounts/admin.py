from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm

from .models import User


class UserCreationForm(AdminUserCreationForm):
    class Meta:
        model = User
        fields = ("username", "email", "name")


class UserEditForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserEditForm
    add_form = UserCreationForm
    list_display = ("username", "name", "email", "is_staff", "is_active", "date_joined", "last_login")
    list_filter = ("is_staff", "is_superuser", "is_active")
    search_fields = ("username", "email", "name")
    ordering = ("-date_joined",)
    readonly_fields = ("date_joined", "last_login")
    fieldsets = (
        (None, {"fields": ("username", "email", "name", "password")}),
        ("Access", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("date_joined", "last_login")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "email", "name", "usable_password", "password1", "password2"),
            },
        ),
    )
