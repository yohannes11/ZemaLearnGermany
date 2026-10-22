from django import forms

from .models import Event

ID_PATTERN = r"^[A-Za-z0-9-]{8,64}$"


class EventForm(forms.Form):
    """Validates an event sent by the course page (field names as the page sends them)."""

    uid = forms.RegexField(regex=ID_PATTERN)
    sid = forms.RegexField(regex=ID_PATTERN)
    type = forms.ChoiceField(choices=Event.Type.choices)
    unit = forms.IntegerField(required=False, min_value=0, max_value=20)  # 0 is the Start unit
    mode = forms.ChoiceField(choices=Event.Mode.choices, required=False)
    scope = forms.CharField(required=False, max_length=60)
    value = forms.IntegerField(required=False, min_value=0, max_value=1000)

    def __init__(self, data=None, *args, **kwargs):
        if data is not None and isinstance(data.get("scope"), str):
            data = {**data, "scope": data["scope"][:60]}
        super().__init__(data, *args, **kwargs)

    def to_event(self, *, user, device):
        data = self.cleaned_data
        return Event(
            visitor_id=data["uid"],
            session_id=data["sid"],
            type=data["type"],
            unit=data["unit"],
            mode=data["mode"] or "",
            scope=data["scope"] or "",
            value=data["value"],
            device=device,
            user=user if user.is_authenticated else None,
        )


class UserActionForm(forms.Form):
    ACTIONS = [
        ("make_admin", "Make admin"),
        ("make_learner", "Remove admin rights"),
        ("disable", "Disable account"),
        ("enable", "Enable account"),
        ("reset_password", "Reset password"),
        ("delete", "Delete account"),
    ]
    action = forms.ChoiceField(choices=ACTIONS)
