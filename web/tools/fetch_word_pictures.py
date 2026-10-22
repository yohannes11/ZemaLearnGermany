"""Download the Twemoji SVGs that the vocabulary pictures use into static/course/pics/.

Twemoji graphics: Copyright 2019 Twitter, Inc and other contributors (jdecked/twemoji),
licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
Run after editing word_pictures.py; files that are already there are skipped.
"""
import subprocess
from pathlib import Path

from course_content import COURSE, add_pictures

SOURCE = 'https://cdn.jsdelivr.net/npm/@twemoji/svg@15.0.0/{}.svg'
OUT = Path(__file__).resolve().parent.parent / 'static' / 'course' / 'pics'


def main():
    add_pictures(COURSE)
    words = [w for u in COURSE['units'] for s in u['sections'] for w in s['words']]
    names = sorted({name for w in words for name in w.get('pic', []) if name != '+'})
    OUT.mkdir(parents=True, exist_ok=True)
    failed = []
    for name in names:
        target = OUT / f'{name}.svg'
        if target.exists():
            continue
        # curl uses the system's certificates, which some Python installs on macOS lack.
        # The arguments are built from our own picture list, never from user input.
        result = subprocess.run(['curl', '-fsSL', '--max-time', '20', '-o', str(target), SOURCE.format(name)],  # noqa: S603, S607
                                capture_output=True, text=True)
        if result.returncode:
            target.unlink(missing_ok=True)
            failed.append(f'{name}: {result.stderr.strip()}')
    print(f'{len(names)} pictures, {len(failed)} failed')
    for line in failed:
        print('  ', line)
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
