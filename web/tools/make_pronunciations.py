"""Write tools/dictionary/pronunciation.txt: the IPA pronunciation of every dictionary headword and course
sentence, for the dictionary card (tools/dictionary.py). Needs espeak-ng (macOS: brew install espeak-ng;
Ubuntu: apt install espeak-ng). Then rebuild the course: python tools/course_content.py.

Lines already in the file are kept, so a teacher's correction stays: delete a line to have it made again.

    python tools/make_pronunciations.py
"""

import contextlib
import io
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import course_content as cc  # noqa: E402
import dictionary  # noqa: E402

OUT = dictionary.DIR / 'pronunciation.txt'
HEADER = ('# IPA for the dictionary card, written by tools/make_pronunciations.py (espeak-ng).\n'
          '# German ||| IPA. Correct any line by hand; the tool keeps lines that are already here.\n')


def ipa(texts):
    """espeak-ng's IPA for many texts at once, one per line."""
    # Notes in brackets aren't said; "A / B" is said as two words.
    spoken = [re.sub(r'\([^)]*\)', '', t).replace('…', '').replace(' / ', ', ') for t in texts]
    result = subprocess.run(['espeak-ng', '-v', 'de', '-q', '--ipa', '--sep='], input='\n'.join(spoken),
                            capture_output=True, text=True, check=True)
    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if len(lines) != len(texts):  # espeak joined or split lines: fall back to one call per text
        return [ipa([t])[0] if len(texts) > 1 else ' '.join(lines) for t in texts]
    return lines


def main():
    if not shutil.which('espeak-ng'):
        sys.exit('espeak-ng is not installed (macOS: brew install espeak-ng; Ubuntu: apt install espeak-ng)')
    course = cc.COURSE
    with contextlib.redirect_stdout(io.StringIO()):
        cc.check(course)
        examples = cc.add_examples(course)
        cc.add_word_types(course)
        am = cc.build_amharic(course, examples, cc.add_explanations(course))
    words, sentences = dictionary.build(course, am, am['examples'])
    known = {de: value for de, value in dictionary.read_lines(OUT, 2)}
    wanted = [entry[0] for entry in words['words']] + list(sentences)
    new = [text for text in dict.fromkeys(wanted) if text not in known]
    for start in range(0, len(new), 200):
        batch = new[start:start + 200]
        known.update(zip(batch, (f'[{value}]' for value in ipa(batch))))
        print(f'{min(start + 200, len(new))} of {len(new)}')
    OUT.write_text(HEADER + ''.join(f'{de} ||| {known[de]}\n' for de in dict.fromkeys(wanted) if de in known),
                   encoding='utf-8')
    print(f'{len(known)} pronunciations -> {OUT}')


if __name__ == '__main__':
    main()
