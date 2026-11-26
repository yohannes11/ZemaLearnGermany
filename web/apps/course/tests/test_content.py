import importlib.util
import json
import re
import sys
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase

STATIC = Path(settings.BASE_DIR) / "static"
CHOICE_TYPES = {"gap", "choose", "listen"}


def load_js_object(name):
    source = (STATIC / "course" / "js" / name).read_text(encoding="utf-8")
    return json.loads(source[source.index("{") : source.rindex("}") + 1])


def english_lesson_strings(course):
    """The lesson texts that need Amharic, as tools/course_am_strings.py finds them."""
    path = Path(settings.BASE_DIR) / "tools" / "course_am_strings.py"
    spec = importlib.util.spec_from_file_location("course_am_strings", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.course_strings(course)


def tool(name):
    """A module of tools/ (only importable while tools/ is on the path)."""
    tools = str(Path(settings.BASE_DIR) / "tools")
    sys.path.insert(0, tools)
    try:
        return importlib.import_module(name)
    finally:
        sys.path.remove(tools)


def hover_texts(course):
    """The German texts pointing reads from a human recording, as tools/hover_texts.py finds them."""
    return tool("hover_texts").hover_texts(course)


def load_course():
    source = (STATIC / "course" / "js" / "course-data.js").read_text(encoding="utf-8")
    return json.loads(source[source.index("{") : source.rindex("}") + 1])


def spoken_texts(course):
    """Every German text the app can play, as tools/gen_course_audio.py collects them."""
    for unit in course["units"]:
        for section in unit["sections"]:
            yield from (word["german"] for word in section["words"])
        for lesson in unit["grammar"]:
            for block in lesson.get("blocks", []):
                yield from (de for de, _ in block.get("examples", []))
                yield from block.get("table", {}).get("say", [])
                yield from block.get("reading", [])
                yield from (de for de, _ in block.get("glossary", []))
            yield from (item["say"] for item in lesson.get("quiz", {}).get("items", []) if item["say"])


class CourseContentTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.course = load_course()

    def test_amharic_content_is_complete(self):
        """Amharic interface: every word has an Amharic meaning and every English lesson text an Amharic
        version (tools/course_am/, built by tools/course_content.py)."""
        am = load_js_object("course-am.js")
        german = {w["german"] for u in self.course["units"] for s in u["sections"] for w in s["words"]}
        self.assertEqual(sorted(german - set(am["words"])), [], "word meanings missing in tools/course_am/words*.txt")
        missing = [t for t in english_lesson_strings(self.course) if t not in am["text"]]
        self.assertEqual(missing, [], "lesson texts missing in tools/course_am/u*.txt")

    def test_hover_meanings_cover_every_word(self):
        """static/core/hover-words.json (pointing at German on any page) is rebuilt with the course: every
        headword has a part of speech and a meaning, and every vocabulary word is one."""
        dictionary = json.loads((STATIC / "core" / "hover-words.json").read_text(encoding="utf-8"))
        parts = tool("dictionary").PARTS
        known = {entry[0] for entry in dictionary["words"]}
        words = {w["german"] for u in self.course["units"] for s in u["sections"] for w in s["words"]}
        self.assertEqual(sorted(words - known), [], "run tools/course_content.py")
        for entry in dictionary["words"]:
            self.assertIn(entry[1], parts, entry[0])
            self.assertTrue(entry[2], entry[0])

    def test_every_word_of_the_course_is_in_the_dictionary(self):
        """Pointing at any word of the course's German finds a dictionary entry (tools/dictionary/)."""
        dictionary_tool = tool("dictionary")
        dictionary = json.loads((STATIC / "core" / "hover-words.json").read_text(encoding="utf-8"))
        missing = dictionary_tool.unknown_words(self.course, dictionary)
        self.assertEqual(missing, [], "add them to tools/dictionary/words.txt or forms.txt")
        found = dictionary_tool.find
        self.assertEqual(found(dictionary, "ist")[0], "sein")
        self.assertEqual(found(dictionary, "Minuten")[0], "die Minute")
        self.assertEqual(found(dictionary, "trinke")[0], "trinken")
        self.assertEqual(found(dictionary, "Kaffee")[0], "der Kaffee")

    def test_clock_times_are_read_exactly(self):
        """A clock shows the hour as said: vier Uhr is 4:00, halb zehn 9:30, fünf vor halb zehn 9:25."""
        times = tool("clock_pictures").times
        cases = {
            "Es ist vier Uhr.": ["4:00"], "Es ist halb zehn.": ["9:30"], "Es ist fünf vor halb zehn.": ["9:25"],
            "Es ist fünf nach halb zehn.": ["9:35"], "Es ist Viertel vor zehn.": ["9:45"], "Es ist zehn nach sieben.": ["7:10"],
            "Es ist fünf vor acht.": ["7:55"], "neun Uhr fünfundzwanzig": ["9:25"], "Es ist halb eins.": ["12:30"],
            "von 9 bis 17 Uhr": ["9:00", "17:00"], "Das Flugzeug landet um 6:40 Uhr.": ["6:40"],
            "Ich komme um fünf nach Hause.": ["5:00"], "9:30 → Es ist halb zehn.": ["9:30"],
            "Ich habe fünf Euro.": [], "Ich bin 8 Jahre alt.": [], "Bis dann!": [],
        }
        for text, expected in cases.items():
            self.assertEqual(times(text), expected, text)

    def test_every_time_taught_has_its_clock(self):
        """Every time in the course's German has a clock picture, and so has every time-telling exercise."""
        clocks = self.course["clocks"]
        name = tool("clock_pictures").name
        self.assertEqual(clocks["Es ist fünf vor halb zehn."], ["9:25"])
        items = [i for u in self.course["units"] for g in u["grammar"] for i in g.get("quiz", {}).get("items", [])]
        every = {t for found in clocks.values() for t in found} | {t for i in items for t in i.get("clocks", [])}
        missing = sorted(t for t in every if not (STATIC / "course" / "pics" / f"{name(t)}.svg").exists())
        self.assertEqual(missing, [], "run tools/course_content.py")
        timed = [i for i in items if (i.get("before") or "").startswith(("9:", "1:", "7:"))]
        self.assertTrue(timed)
        for item in timed:
            self.assertEqual(item["clocks"], [item["before"].split(" ")[0]], item["before"])

    def test_amharic_times_keep_the_hour_on_the_clock(self):
        """The Amharic says the hour the clock shows (9:00 = ዘጠኝ ሰዓት), never the Ethiopian clock's six-hour
        shift (ሦስት ሰዓት)."""
        times = tool("clock_pictures").times
        am = load_js_object("course-am.js")
        words = ["አንድ", "ሁለት", "ሦስት", "አራት", "አምስት", "ስድስት", "ሰባት", "ስምንት", "ዘጠኝ", "አሥር", "አሥራ አንድ", "አሥራ ሁለት"]
        pairs = list(am["examples"].items()) + list(am["words"].items())
        checked = 0
        for german, amharic in pairs:
            for time in times(german):
                hour = int(time.split(":")[0])
                shifted = (hour + 6) % 12 or 12
                if shifted == (hour % 12 or 12) or any(hour % 12 == int(t.split(":")[0]) % 12 for t in times(german) if t != time):
                    continue
                word = words[shifted - 1]
                wrong = rf"(?<!አሥራ )(?<!\w){word} (ሰዓት|ተኩል)|(?<!\d){shifted} ሰዓት"
                self.assertIsNone(re.search(wrong, amharic), f"{german} → {amharic}")
                checked += 1
        self.assertGreater(checked, 100)

    def test_every_example_sentence_has_its_translation(self):
        """Pointing beside a sentence shows its translation (static/core/hover-sentences.json)."""
        sentences = json.loads((STATIC / "core" / "hover-sentences.json").read_text(encoding="utf-8"))
        examples = {de for u in self.course["units"] for s in u["sections"] for w in s["words"] for de, _ in w.get("examples", [])}
        self.assertEqual(sorted(examples - set(sentences)), [], "run tools/course_content.py")
        self.assertTrue(all(english for english, _, _ in sentences.values()))

    def test_every_exercise_explains_its_answer(self):
        """Every lesson question says why its answer is right (in course_content.py or tools/course_why/), and
        every person on the family tree says who they are to you."""
        missing = [f"{g['key']}: {item.get('text') or item.get('prompt') or item.get('before')} → {item['answer']}"
                   for u in self.course["units"] for g in u["grammar"] if g.get("quiz")
                   for item in g["quiz"]["items"] if not item.get("why")]
        self.assertEqual(missing, [], "add an explanation in tools/course_why/u*.txt")
        trees = [g["tree"] for u in self.course["units"] for g in u["grammar"] if g.get("tree")]
        self.assertTrue(trees)
        for tree in trees:
            self.assertEqual([p["key"] for p in tree["people"] if not p.get("me") and not p.get("why")], [])

    def test_noun_genders(self):
        """Nouns carry the gender of their article (der, die, das, or plural), for their colours; the pointing
        tooltip (hover-words.json) has the same."""
        words = [w for u in self.course["units"] for s in u["sections"] for w in s["words"]]
        for word in words:
            gender = word.get("gender")
            if gender is None:
                continue
            self.assertEqual(word["pos"], "noun", word["german"])
            article = "die" if gender == "plural" else gender
            self.assertTrue(word["german"].startswith(article + " "), word["german"])
            self.assertEqual(gender == "plural", "(pl." in word["english"], word["german"])
        by_word = {w["german"]: w.get("gender") for w in words}
        self.assertEqual(by_word["der Kaffee"], "der")
        self.assertEqual(by_word["die Eltern"], "plural")
        self.assertIsNone(by_word["die Speise, das Essen"])
        dictionary = json.loads((STATIC / "core" / "hover-words.json").read_text(encoding="utf-8"))
        for entry in dictionary["words"]:
            if entry[4] is not None:
                self.assertIn(entry[4], ("der", "die", "das", "plural"), entry[0])
                self.assertEqual(entry[1], "noun", entry[0])

    def test_amharic_keeps_markup_and_german(self):
        am = load_js_object("course-am.js")
        for english, amharic in am["text"].items():
            # The German examples inside lessons stay exactly as they are.
            self.assertEqual(english.count('<em class="de">'), amharic.count('<em class="de">'), english)
            self.assertEqual(english.count("<strong>"), amharic.count("<strong>"), english)
        for german, amharic in am["words"].items():
            self.assertTrue(any(0x1200 <= ord(c) <= 0x137F for c in amharic) or amharic[0].isdigit(), german)

    def test_every_word_picture_is_shipped(self):
        pics = STATIC / "course" / "pics"
        names = {
            name
            for unit in self.course["units"]
            for section in unit["sections"]
            for word in section["words"]
            for name in word.get("pic", [])
            if name != "+" and not name.startswith("#")
        }
        self.assertGreater(len(names), 200)
        missing = sorted(n for n in names if not (pics / (n if "." in n else f"{n}.svg")).exists())
        self.assertEqual(missing, [], "run tools/fetch_word_pictures.py")

    def test_every_photo_is_credited(self):
        photos = self.course["photos"]
        shown = {
            name
            for unit in self.course["units"]
            for section in unit["sections"]
            for word in section["words"]
            for name in word.get("pic", [])
            if name.endswith(".jpg")
        }
        self.assertEqual(shown - set(photos), set())
        for name, credit in photos.items():
            self.assertTrue(credit["author"] and credit["license"], name)
            self.assertTrue(credit["page"].startswith("https://commons.wikimedia.org/wiki/File:"), name)
            self.assertNotRegex(credit["license"], r"\b(NC|ND)\b", name)

    def test_every_picture_is_a_photo_colour_clock_or_icon(self):
        known = r"^(\+|#[0-9a-f]{6}|clock-\d{4}|[a-z0-9-]+\.jpg|[0-9a-f]{2,5}(-[0-9a-f]{2,5})*)$"
        for unit in self.course["units"]:
            for section in unit["sections"]:
                for word in section["words"]:
                    for name in word.get("pic", []):
                        self.assertRegex(name, known, word["german"])

    def test_units_start_with_the_start_unit_and_run_in_order(self):
        self.assertEqual([unit["id"] for unit in self.course["units"]], list(range(10)))
        self.assertEqual(self.course["units"][0]["label"], "Start")

    def test_every_unit_ends_with_a_unit_test(self):
        for unit in self.course["units"]:
            self.assertEqual(unit["grammar"][-1]["custom"], "review", unit["id"])

    def test_keys_are_unique(self):
        keys = [s["key"] for u in self.course["units"] for s in u["sections"]]
        keys += [g["key"] for u in self.course["units"] for g in u["grammar"]]
        self.assertEqual(len(keys), len(set(keys)))

    def test_exercise_items_are_answerable(self):
        for unit in self.course["units"]:
            for lesson in unit["grammar"]:
                items = lesson.get("quiz", {}).get("items", [])
                if "quiz" in lesson:
                    self.assertGreaterEqual(len(items), 8, lesson["key"])
                for item in items:
                    kind = item.get("type")
                    with self.subTest(lesson=lesson["key"], item=item.get("answer")):
                        if kind in CHOICE_TYPES:
                            self.assertIn(item["answer"], item["options"])
                        elif kind == "order":
                            self.assertGreaterEqual(len(item["tiles"]), 2)
                        else:
                            self.assertEqual(kind, "write")
                            self.assertIn(item["lang"], {"de", "en"})

    def test_every_spoken_text_has_a_recording(self):
        manifest = json.loads((STATIC / "audio" / "manifest.json").read_text(encoding="utf-8"))
        missing = sorted({text for text in spoken_texts(self.course) if text not in manifest})
        self.assertEqual(missing, [], "run tools/gen_course_audio.py")
        for clip in {manifest[text] for text in spoken_texts(self.course)}:
            self.assertTrue((STATIC / "audio" / "katja" / "normal" / f"{clip}.mp3").exists(), clip)

    def test_everything_pointing_reads_has_a_human_recording(self):
        """Short German texts and the words of longer ones have human recordings; only whole sentences
        without one are read by the browser's German voice."""
        manifest = json.loads((STATIC / "audio" / "manifest.json").read_text(encoding="utf-8"))
        missing = [text for text in hover_texts(self.course) if text not in manifest]
        self.assertEqual(missing, [], "run tools/gen_course_audio.py")

    def test_landing_page_figures_match_the_course(self):
        from apps.landing.content import COURSE_FACTS

        units = self.course["units"]
        words = {w["german"] for unit in units for section in unit["sections"] for w in section["words"]}
        lessons = [g for unit in units for g in unit["grammar"] if g.get("custom") != "review" and g["code"][0] != "R"]
        self.assertEqual(COURSE_FACTS, {"words": len(words), "lessons": len(lessons), "units": len(units)})
