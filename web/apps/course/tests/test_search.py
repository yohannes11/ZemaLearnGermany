"""The website's course search (static/course/js/search.js) against search_cases.json, which the app's search
(mobile/lib/features/search/search_engine.dart) is checked against too. The search runs in the browser, so this
runs it with Node."""

import shutil
import subprocess
from pathlib import Path
from unittest import skipUnless

from django.test import SimpleTestCase

CHECK = Path(__file__).with_name("search_check.js")


@skipUnless(shutil.which("node"), "needs Node.js to run the browser's search code")
class CourseSearchTests(SimpleTestCase):
    def test_search_cases(self):
        result = subprocess.run(["node", str(CHECK)], capture_output=True, text=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
