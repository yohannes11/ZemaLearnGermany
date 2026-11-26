"""Download the vocabulary photos (tools/word_pictures.py) from Wikimedia Commons into static/course/pics/,
and the Twemoji icons used where no photo fits the word.

Each photo is cropped square and resized to SIZE pixels, saved as static/course/pics/<key>.jpg, and its credit
(author, licence, Commons page) is written to tools/word_photos.json, which course_content.py puts in the
course data so the site and the app can show it. Only freely licensed photos are accepted: public domain,
CC0, CC BY and CC BY-SA (never NC or ND). The icons are Twemoji (jdecked/twemoji, CC BY 4.0, credited under the
course page); icons no word uses any more are deleted, the clocks (clock_pictures.py) are kept.

Run after editing PHOTOS in word_pictures.py; photos already downloaded from the same file are skipped.
Needs Pillow (requirements-dev.txt).
"""
import html
import io
import json
import re
import subprocess
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps
from word_pictures import PHOTOS, PICTURES

SIZE = 320  # pixels; the largest picture on the site is 104 CSS pixels, so this is sharp on 3x screens
API = 'https://commons.wikimedia.org/w/api.php'
AGENT = 'ZemaLearn-word-pictures/1.0 (language course; tools/fetch_word_pictures.py)'
HERE = Path(__file__).resolve().parent
OUT = HERE.parent / 'static' / 'course' / 'pics'
CREDITS = HERE / 'word_photos.json'
TWEMOJI = 'https://cdn.jsdelivr.net/npm/@twemoji/svg@15.0.0/{}.svg'
FREE = re.compile(r'^(CC0|Public domain|PD\b|CC BY(-SA)? \d)', re.I)


def get(url):
    if url.startswith(API):
        time.sleep(1)  # Wikimedia's API asks for about one request a second
    # curl uses the system's certificates, which some Python installs on macOS lack.
    # The URLs are built from our own photo list, never from user input.
    for attempt in range(5):
        result = subprocess.run(['curl', '-fsSL', '--max-time', '60', '-A', AGENT, url], capture_output=True)  # noqa: S603, S607
        if result.returncode == 0:
            return result.stdout
        time.sleep(3 + attempt * 5)  # Wikimedia asks clients to back off when it is busy
    raise RuntimeError(f'{url}: {result.stderr.decode().strip()}')


def plain(text):
    """Commons gives authors as HTML (often a link to their user page); keep the words."""
    text = re.sub(r'<[^>]+>', '', text or '')
    text = re.sub(r'\s+', ' ', html.unescape(text)).strip()
    # Some authors add boilerplate after their name ("- Wikimedia Commons - © CC BY-SA ...", "Want to use this").
    return re.split(r' - Wikimedia Commons| ?©| ?\(Want to use', text)[0].strip(' -,')


def file_infos(names):
    """Commons' details for many files at once (50 per request, as the API allows)."""
    found = {}
    for i in range(0, len(names), 50):
        query = {'action': 'query', 'format': 'json', 'titles': '|'.join(f'File:{n}' for n in names[i:i + 50]),
                 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size', 'iiurlwidth': 500}  # a standard, cached size
        data = json.loads(get(f'{API}?{urllib.parse.urlencode(query)}'))['query']
        renamed = {n['to']: n['from'] for n in data.get('normalized', [])}
        for page in data['pages'].values():
            if 'imageinfo' in page:
                title = renamed.get(page['title'], page['title'])
                found[title.removeprefix('File:')] = page['imageinfo'][0]
    return found


def credit(name, info):
    meta = info['extmetadata']
    licence = meta.get('LicenseShortName', {}).get('value', '')
    if not FREE.match(licence) or re.search(r'\b(NC|ND)\b', licence):
        raise RuntimeError(f'{name}: licence {licence!r} is not free enough')
    author = plain(meta.get('Artist', {}).get('value')) or plain(meta.get('Credit', {}).get('value'))
    author = author or 'Unknown author'
    if licence.lower().startswith('public domain') or licence.upper().startswith('PD'):
        licence = 'Public domain'
    return {
        'file': name,
        'page': info['descriptionurl'],
        'author': author[:120],
        'license': licence,
        'license_url': meta.get('LicenseUrl', {}).get('value', ''),
    }


def square(data, focus):
    """Crop to a square around `focus` (0 = top or left edge, 0.5 = middle, 1 = bottom or right) and resize."""
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
    w, h = image.size
    side = min(w, h)
    x = round((w - side) * (focus if w > h else 0.5))
    y = round((h - side) * (focus if h > w else 0.5))
    image = image.crop((x, y, x + side, y + side)).resize((SIZE, SIZE), Image.LANCZOS)
    out = io.BytesIO()
    image.save(out, 'JPEG', quality=80, optimize=True, progressive=True)
    return out.getvalue()


def icons():
    """Fetch the Twemoji SVG of every fallback icon in PICTURES; delete the ones no longer used."""
    from course_content import picture_files

    used = {name for spec in PICTURES.values() for name in picture_files(spec) if name != '+' and '.' not in name
            and not name.startswith('#')}
    for name in sorted(used):
        target = OUT / f'{name}.svg'
        if not target.exists():
            target.write_bytes(get(TWEMOJI.format(name)))
            print(f'icon {name}')
    for old in OUT.glob('*.svg'):
        if not old.stem.startswith('clock-') and old.stem not in used:
            old.unlink()
    return used


def save(credits):
    CREDITS.write_text(json.dumps(credits, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8')


def main(only=()):
    credits = json.loads(CREDITS.read_text(encoding='utf-8')) if CREDITS.exists() else {}
    OUT.mkdir(parents=True, exist_ok=True)
    todo = {}
    for key, source in sorted(PHOTOS.items()):
        name, focus = source if isinstance(source, tuple) else (source, 0.5)
        done = (OUT / f'{key}.jpg').exists() and credits.get(key, {}).get('file') == name
        if (not only or key in only) and not (done and credits[key].get('focus', 0.5) == focus):
            todo[key] = (name, focus)
    infos = file_infos(sorted({name for name, _ in todo.values()}))
    failed = []

    def fetch(item):
        key, (name, focus) = item
        try:
            info = infos.get(name.replace('_', ' ')) or infos[name]
            entry = credit(name, info)
            (OUT / f'{key}.jpg').write_bytes(square(get(info.get('thumburl') or info['url']), focus))
        except Exception as error:  # report every failure at the end
            return key, None, f'{key}: {name}: {error}'
        if focus != 0.5:
            entry['focus'] = focus
        return key, entry, None

    with ThreadPoolExecutor(4) as pool:
        for key, entry, error in pool.map(fetch, todo.items()):
            if error:
                failed.append(error)
                continue
            credits[key] = entry
            save(credits)
            print(f'{key}: {entry["file"]} ({entry["license"]}, {entry["author"]})', flush=True)
    for key in sorted(set(credits) - set(PHOTOS)):  # photos no longer used
        del credits[key]
        (OUT / f'{key}.jpg').unlink(missing_ok=True)
    save(credits)
    if not only:
        print(f'{len(icons())} icons')
    print(f'{len(PHOTOS)} photos, {len(failed)} failed')
    for line in failed:
        print('  ', line)
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main(set(sys.argv[1:]))
