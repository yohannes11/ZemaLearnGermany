from django import forms
from django.contrib.admin.forms import AdminAuthenticationForm
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.password_validation import validate_password

from .models import User


class RegistrationForm(forms.ModelForm):
    password = forms.CharField(strip=False, max_length=200)

    class Meta:
        model = User
        fields = ["username", "name", "email"]

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError("This username is taken. Please choose another.")
        return username

    def clean_name(self):
        return self.cleaned_data["name"].strip()

    def clean_email(self):
        email = User.objects.normalize_email(self.cleaned_data["email"].strip())
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("An account with this email already exists. Try signing in.")
        return email

    def _post_clean(self):
        super()._post_clean()
        # Validate the password against the filled-in instance, so it may not resemble the username or email.
        password = self.cleaned_data.get("password")
        if password:
            try:
                validate_password(password, self.instance)
            except forms.ValidationError as error:
                self.add_error("password", error)

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password"])
        if commit:
            user.save()
        return user


class LoginForm(forms.Form):
    """The course's sign-in dialog: a username or an email address, and a password."""

    login = forms.CharField(max_length=254, strip=True)
    password = forms.CharField(strip=False, max_length=200)


class UsernameOrEmailFieldMixin:
    """For Django's login forms: the "username" field also takes an email address."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # AuthenticationForm sizes this field for the username (30); an email address may be longer.
        field = self.fields["username"]
        field.label = "Username or email"
        field.max_length = 254
        field.widget.attrs["maxlength"] = 254
        self.error_messages = {
            **self.error_messages,
            "invalid_login": "Please enter a correct username or email and password. The password is case-sensitive.",
        }


class LoginPageForm(UsernameOrEmailFieldMixin, AuthenticationForm):
    """The /accounts/login/ page (dashboard sign-in)."""


class AdminSiteLoginForm(UsernameOrEmailFieldMixin, AdminAuthenticationForm):
    """The Django admin's own sign-in page."""
