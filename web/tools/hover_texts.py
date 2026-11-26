"""German texts pointing reads (static/core/js/hover-read.js) that get a human recording:
tools/gen_course_audio.py records them, and the tests check that none is missing.

Pointing reads the word under the pointer (with its article, "den Kaffee"), or the sentence beside it. So
every German text is recorded whole, each sentence of a longer text on its own, every word of two letters or
more, and every article with the noun after it. German texts are the course's words, examples, readings,
glossaries and table forms, the <em class="de"> phrases in lessons and in course.js, and the lang="de" text of
the landing page. Only a selection the learner makes by hand (any run of words) can still need the browser's
German voice.
"""

import re
from pathlib import Path

from course_am_strings import looks_english

ROOT = Path(__file__).resolve().parent.parent
WORD = re.compile(r"[A-Za-zÄÖÜäöüßé-]+")
# One sentence of a longer text, as hover-read.js cuts it (SENTENCE there).
SENTENCE = re.compile(r'[^.!?…]+(?:[.!?…]+[")»“”]*|$)')
# Words read together with the noun after them (DETERMINER in hover-read.js).
DETERMINER = (
    "der die das den dem des ein eine einen einem einer eines kein keine keinen keinem keiner keines mein meine "
    "meinen meinem meiner dein deine deinen deinem deiner sein seine seinen seinem seiner ihr ihre ihren ihrem "
    "ihrer unser unsere unseren unserem unserer euer eure euren eurem eurer"
)
ARTICLE_NOUN = re.compile(
    rf"\b(?:{'|'.join(w for d in DETERMINER.split() for w in (d, d.capitalize()))})\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]*"
)
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
    """What pointing can read aloud: every German text whole, each of its sentences, its words, and its
    article + noun pairs."""
    found = set()
    for text in map(clean, german_texts(course)):
        if not text:
            continue
        found.add(text)
        sentences = [clean(part) for part in SENTENCE.findall(text) if part.strip()]
        if len(sentences) > 1:
            found.update(sentences)
        found.update(word for word in WORD.findall(text) if len(word) >= 2)
        found.update(clean(pair) for pair in ARTICLE_NOUN.findall(text))
    return sorted(found)
