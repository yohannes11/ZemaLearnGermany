#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""

import os
import sys


def main():
    default = "config.settings.test" if len(sys.argv) > 1 and sys.argv[1] == "test" else "config.settings.dev"
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", default)
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Couldn't import Django. Is it installed and is the virtual environment active?") from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
