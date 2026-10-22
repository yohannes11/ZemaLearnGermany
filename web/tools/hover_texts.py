"""Every German text a learner can point at to hear it (static/core/js/hover-read.js), so each one gets a
recording: tools/gen_course_audio.py records them, and the tests check that none is missing.

Mirrors the script's rule: a German text of up to six words is read whole; in a longer one, the single word
under the pointer. German texts are the course's words, examples, readings, glossaries and table forms,
the <em class="de"> phrases in lessons and in course.js, and the lang="de" text of the landing page.
"""

import re
from pathlib import Path

from course_am_strings import looks_english

ROOT = Path(__file__).resolve().parent.parent
WHOLE = 6
WORD = re.compile(r"[A-Za-zÄÖÜäöüß-]+")
EM_DE = re.compile(r'<em class="de">(.*?)</em>')
LANDING_DE = re.compile(r'lang="de"[^>]*>([^<{]+)<')


def clean(text):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", text)).strip()


def german_texts(course):
    texts, explained = [], []
    for unit in course["units"]:
        for section in unit["sections"]:
            texts += [w["german"] for w in section["words"]]
        for lesson in unit["grammar"]:
            explained += lesson.get("intro", [])
            for block in lesson.get("blocks", []):
                explained += [block.get("text", "")] + [en for _, en in block.get("examples", [])]
                texts += [de for de, _ in block.get("examples", [])]
                texts += block.get("reading", [])
                texts += [de for de, _ in block.get("glossary", [])]
                table = block.get("table")
                if table:
                    texts += [cell for row in table["rows"] for cell in row[1:] if cell and not looks_english(cell)]
    explained.append((ROOT / "static" / "course" / "js" / "course.js").read_text(encoding="utf-8"))
    landing = (ROOT / "templates" / "landing" / "index.html").read_text(encoding="utf-8")
    texts += [m for text in [*explained, landing] for m in EM_DE.findall(text)]
    texts += LANDING_DE.findall(landing)
    return texts


def hover_texts(course):
    """What pointing can read aloud: short German texts whole, and each word of the longer ones."""
    found = set()
    for text in map(clean, german_texts(course)):
        if not text:
            continue
        if len(text.split(" ")) <= WHOLE:
            found.add(text)
        else:
            found.update(word for word in WORD.findall(text) if len(word) >= 2)
    return sorted(found)
