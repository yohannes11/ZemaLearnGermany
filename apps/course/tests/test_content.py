import importlib.util
import json
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
            if name != "+"
        }
        self.assertGreater(len(names), 300)
        missing = sorted(name for name in names if not (pics / f"{name}.svg").exists())
        self.assertEqual(missing, [], "run tools/fetch_word_pictures.py")

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

    def test_landing_page_figures_match_the_course(self):
        from apps.landing.content import COURSE_FACTS

        units = self.course["units"]
        words = {w["german"] for unit in units for section in unit["sections"] for w in section["words"]}
        lessons = [g for unit in units for g in unit["grammar"] if g.get("custom") != "review" and g["code"][0] != "R"]
        self.assertEqual(COURSE_FACTS, {"words": len(words), "lessons": len(lessons), "units": len(units)})
