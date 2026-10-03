import json

from django.core.management.base import BaseCommand

from apps.core.i18n import LANGUAGES, LOCALE_DIR, PLACEHOLDER
from apps.core.i18n_sources import all_strings


class Command(BaseCommand):
    help = "List interface strings without a translation (and translations nothing uses any more)."

    def add_arguments(self, parser):
        parser.add_argument("--lang", default="am", choices=[c for c in LANGUAGES if c != "en"])
        parser.add_argument(
            "--json", dest="as_json", action="store_true", help="print the missing strings as a JSON skeleton"
        )

    def handle(self, *args, lang, as_json, **options):
        path = LOCALE_DIR / f"{lang}.json"
        catalog = _load(path)
        missing, stale, broken = {}, {}, []
        for section, strings in all_strings().items():
            have = catalog.get(section, {})
            missing[section] = sorted(s for s in strings if not have.get(s))
            stale[section] = sorted(set(have) - strings)
            broken += [k for k, v in have.items() if set(PLACEHOLDER.findall(k)) != set(PLACEHOLDER.findall(v))]
        if as_json:
            self.stdout.write(_dumps({s: {k: "" for k in keys} for s, keys in missing.items()}))
            return
        for section in missing:
            self.stdout.write(f"[{section}] {len(missing[section])} missing, {len(stale[section])} unused")
            for text in missing[section]:
                self.stdout.write(f"  missing: {text}")
            for text in stale[section]:
                self.stdout.write(f"  unused:  {text}")
        for key in broken:
            self.stdout.write(f"  placeholders differ: {key}")


def _load(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def _dumps(data):
    return json.dumps(data, ensure_ascii=False, indent=2)
