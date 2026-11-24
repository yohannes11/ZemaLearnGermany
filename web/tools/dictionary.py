"""The dictionary behind pointing at German and selecting it (static/core/js/hover-read.js): one entry per
headword in a professional dictionary's shape, and every word form found in the course's German pointing at its
headword, so "ist" finds sein, "Minuten" die Minute and "trinke" trinken.

Built by tools/course_content.py into two files:
  static/core/hover-words.json      {"words": [[german, part of speech, English, Amharic, gender, IPA, example]],
                                     "keys": {headword key: index}, "forms": {word form: index}}
  static/core/hover-sentences.json  {German sentence: [English, Amharic, IPA]}, loaded on the first sentence

Sources, all plain text a teacher can review:
  the course's vocabulary and reading glossaries (course_content.py), with their examples and Amharic;
  tools/dictionary/words.txt   words the vocabulary doesn't teach but the sentences use (in, ist, sehr, Dawit)
  tools/dictionary/forms.txt   irregular forms (bin -> sein, isst -> essen); regular ones are worked out here
  tools/dictionary/pronunciation.txt   IPA, written by tools/make_pronunciations.py (needs espeak-ng)
"""

import re
from pathlib import Path

DIR = Path(__file__).resolve().parent / 'dictionary'
WORD = re.compile(r"[A-Za-zÄÖÜäöüßé]+(?:-[A-Za-zÄÖÜäöüßé]+)*")
PARTS = ('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'article', 'preposition', 'conjunction', 'particle',
         'interjection', 'number', 'phrase', 'sentence', 'question', 'name', 'place')

# The course marks these words "small" or (for any lower-case word) "adjective"; a dictionary says what they are.
PART_OF = {
    **dict.fromkeys(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'Sie'], 'pronoun'),
    **dict.fromkeys(['mein', 'meine', 'der', 'die', 'das', 'ein', 'eine', 'kein', 'keine'], 'article'),
    **dict.fromkeys(['und'], 'conjunction'),
    **dict.fromkeys(['neben', 'um', 'vor', 'nach'], 'preposition'),
    **dict.fromkeys(['ja', 'nein', 'doch', 'bitte'], 'particle'),
    **dict.fromkeys(['auch', 'nicht', 'soso', 'zu', 'oft', 'heute', 'jetzt', 'links', 'rechts', 'vorne', 'hinten',
                     'gestern', 'morgen', 'immer', 'manchmal', 'selten', 'nie', 'wirklich', 'vielleicht',
                     'vorgestern', 'zuerst', 'dann', 'danach', 'später', 'viel'], 'adverb'),
}
QUESTION_WORDS = {'Wer': 'pronoun', 'Was': 'pronoun', 'Welche': 'pronoun', 'Wen': 'pronoun', 'Wem': 'pronoun'}
ARTICLE = re.compile(r'^(der|die|das) (?=[A-ZÄÖÜ])')
UMLAUT = str.maketrans('äöü', 'aou')


def clean(text):
    return re.sub(r'\s+', ' ', text).strip()


def bare(text):
    """The key a text is found by: no punctuation, lower case (as hover-read.js `bare`)."""
    return re.sub(r'[.,!?;:…"“”„()«»–]', '', clean(text)).strip().lower()


def read_lines(path, fields):
    """`a ||| b ||| …` lines; # starts a comment."""
    rows = []
    if not path.exists():
        return rows
    for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip() or line.startswith('#'):
            continue
        parts = [p.strip() for p in line.split('|||')]
        assert len(parts) == fields and all(parts[:2]), f'{path.name}:{number}: expected {fields} fields'
        rows.append(parts)
    return rows


def part_of_speech(word):
    german, pos = word['german'], word['pos']
    if german in PART_OF:
        return PART_OF[german]
    if pos == 'small':
        return 'particle'
    # "er, sie, es", "Wie?", "Woher?": a list of small words, or a question word, is what its words are.
    words = [w for w in re.split(r'[,/]\s*|\s+', german.rstrip('?!.')) if w]
    if pos == 'phrase' and words and all(w in PART_OF for w in words) and len({PART_OF[w] for w in words}) == 1:
        return PART_OF[words[0]]
    if pos == 'phrase' and len(words) == 1 and german.endswith('?'):
        return QUESTION_WORDS.get(words[0], 'adverb')
    if pos == 'phrase':
        if german.endswith('?'):
            return 'question'
        # "Hallo!", "Guten Morgen!" are phrases; "Ich lerne Deutsch." is a sentence.
        return 'sentence' if re.search(r'[.!]$', german) and len(german.split()) >= 3 else 'phrase'
    return pos


def headword_keys(german, english):
    """Every way a headword is found: as written, without punctuation, each of "A / B" and "der A, der B",
    and a noun without its article."""
    keys = {clean(german), bare(german)}
    for part in re.split(r' / |, ', german):
        keys.add(bare(part))
        if ARTICLE.match(part) or english.startswith('the '):
            keys.add(bare(ARTICLE.sub('', part)))
    return {k for k in keys if k}


def verb_forms(infinitive):
    """The regular present-tense forms of a one-word verb: lernen -> lerne, lernst, lernt, lernen;
    arbeiten -> arbeitest, arbeitet; separable aufstehen -> stehe, stehst, steht (… auf)."""
    if not re.fullmatch(r'[a-zäöüß]+n', infinitive) or infinitive in IRREGULAR:
        return set()
    if infinitive.endswith(('eln', 'ern')):  # wandern: wandere, wanderst, wandert
        stem = infinitive[:-1]
        return {infinitive, stem + 'e', stem + 'st', stem + 't'}
    stem = infinitive[:-2]
    if re.search(r'(t|d|chn|ffn|gn|tm)$', stem):  # arbeiten: arbeite, arbeitest, arbeitet
        return {infinitive, stem + 'e', stem + 'est', stem + 'et'}
    if re.search(r'(s|ß|z|x)$', stem):  # heißen: heiße, heißt
        return {infinitive, stem + 'e', stem + 't'}
    return {infinitive, stem + 'e', stem + 'st', stem + 't'}


# Their present tense is in tools/dictionary/forms.txt: the regular endings would make up words (sest, habst).
IRREGULAR = {'sein', 'tun', 'haben', 'wissen', 'werden', 'können', 'müssen', 'dürfen', 'sollen', 'wollen', 'mögen',
             'essen', 'vergessen', 'lesen'}


SEPARABLE = ('auf', 'an', 'ab', 'aus', 'ein', 'mit', 'vor', 'zu', 'fern', 'zurück', 'weg', 'los', 'her', 'hin')


def build(course, am, examples_am):
    """(words, sentences) for the two JSON files."""
    ipa = {de: value for de, value in read_lines(DIR / 'pronunciation.txt', 2)}
    entries, keys = [], {}

    def add(german, part, english, amharic, gender=None, example=None):
        index = len(entries)
        entries.append([clean(german), part, english, amharic or '', gender, ipa.get(clean(german), ''), example])
        for key in headword_keys(german, english):
            keys.setdefault(key, index)
        if part in ('name', 'place'):  # Addis Abeba: each word finds it too
            for token in WORD.findall(german):
                keys.setdefault(token.lower(), index)
        return index

    verbs = {}
    for unit in course['units']:
        for section in unit['sections']:
            for word in section['words']:
                if bare(word['german']) in keys and keys[bare(word['german'])] is not None:
                    first = entries[keys[bare(word['german'])]]
                    if first[0] == clean(word['german']):
                        continue  # taught twice
                example = None
                if word.get('examples'):
                    de, en = word['examples'][0]
                    example = [de, en, examples_am.get(de, '')]
                index = add(word['german'], part_of_speech(word), word['english'], am['words'].get(word['german']),
                            word.get('gender'), example)
                if entries[index][1] == 'verb':
                    verbs[clean(word['german'])] = index
        for lesson in unit['grammar']:
            for block in lesson.get('blocks', []):
                for de, en in block.get('glossary', []):
                    if bare(de) not in keys:
                        part = 'noun' if ARTICLE.match(de) else 'verb' if en.startswith('to ') else 'phrase' if ' ' in de else 'adjective'
                        index = add(de, part, en, am['text'].get(en))
                        if part == 'verb':
                            verbs[clean(de)] = index
    rows = read_lines(DIR / 'words.txt', 4)
    taught = [german for german, *_ in rows if bare(german) in keys]
    assert not taught, f'words.txt: already in the course: {taught}'
    for german, part, english, amharic in rows:
        assert part in PARTS, f'words.txt: {german}: unknown part of speech {part!r}'
        index = add(german, part, english, amharic)
        if part == 'verb':
            verbs[german] = index

    # Word forms: irregular ones from forms.txt, then the regular verb, noun and adjective endings.
    forms = {}
    for form, headword in read_lines(DIR / 'forms.txt', 2):
        assert bare(headword) in keys, f'forms.txt: {form} -> {headword}, which is not in the dictionary'
        forms[bare(form)] = keys[bare(headword)]
    # One-word verbs first, so "fahre" finds fahren rather than "zur Arbeit fahren".
    for infinitive, index in sorted(verbs.items(), key=lambda item: ' ' in item[0]):
        base = infinitive.split(' ')[-1]
        for form in verb_forms(base):
            forms.setdefault(form, index)
        prefix = next((p for p in SEPARABLE if base.startswith(p) and len(base) > len(p) + 3), None)
        if prefix and base[len(prefix):] not in keys:
            for form in verb_forms(base[len(prefix):]):
                forms.setdefault(form, index)

    def is_part(key, *parts):
        return key in keys and entries[keys[key]][1] in parts

    def resolve(token):
        """The entry for a word form met in a German text, by the endings German adds."""
        key = token.lower()
        if key in keys or key in forms:
            return None
        candidates = []
        if token[0].isupper():
            # Nouns: plural and case endings, with or without umlaut (Minuten, Freunde, Hände).
            for end in ('nen', 'en', 'n', 'e', 'er', 's', 'es', ''):
                if key.endswith(end) and len(key) - len(end) >= 3:
                    stem = key[:len(key) - len(end)]
                    candidates += [c for c in (stem, stem.translate(UMLAUT)) if is_part(c, 'noun')]
            # A name's genitive: Dawits.
            if key.endswith('s') and is_part(key[:-1], 'name'):
                candidates.append(key[:-1])
        # Adjectives and adverbs: their endings (guten, frisches).
        for end in ('em', 'en', 'er', 'es', 'e'):
            if key.endswith(end) and len(key) - len(end) >= 2:
                stem = key[:len(key) - len(end)]
                candidates += [c for c in (stem, stem + 'e') if is_part(c, 'adjective', 'adverb', 'number', 'pronoun', 'article')]
        # Past participles: gemacht -> machen, aufgeräumt -> aufräumen, gegessen (forms.txt for the irregular).
        found = re.fullmatch(r'(\w*?)ge(\w+?)(et|t|en)', key)
        if found:
            prefix, stem, _ = found.groups()
            candidates += [c for c in (prefix + stem + 'en', prefix + stem + 'n') if is_part(c, 'verb')]
        if re.fullmatch(r'\w+iert', key):  # repariert, passiert
            candidates += [c for c in (key[:-1] + 'en',) if is_part(c, 'verb')]
        # Commands: komm, schreib, nimm (forms.txt), and any regular form of a verb met capitalised.
        candidates += [c for c in (key + 'en', key + 'n') if is_part(c, 'verb')]
        return keys[candidates[0]] if candidates else None

    sentences = {}
    texts = german_texts(course)
    for text in texts:
        for token in WORD.findall(text):
            index = resolve(token)
            if index is not None:
                forms[token.lower()] = index
    forms = {k: v for k, v in forms.items() if k not in keys}

    for unit in course['units']:
        for section in unit['sections']:
            for word in section['words']:
                for de, en in word.get('examples', []):
                    sentences.setdefault(clean(de), [en, examples_am.get(de, ''), ipa.get(clean(de), '')])
        for lesson in unit['grammar']:
            for block in lesson.get('blocks', []):
                for de, en in block.get('examples', []):
                    sentences.setdefault(clean(de), [en, am['text'].get(en, ''), ipa.get(clean(de), '')])
    return {'words': entries, 'keys': keys, 'forms': forms}, sentences


def german_texts(course):
    """The course's German sentences: examples, readings and vocabulary phrases."""
    texts = []
    for unit in course['units']:
        for section in unit['sections']:
            for word in section['words']:
                texts.append(word['german'])
                texts += [de for de, _ in word.get('examples', [])]
        for lesson in unit['grammar']:
            for block in lesson.get('blocks', []):
                texts += [de for de, _ in block.get('examples', [])]
                texts += block.get('reading', [])
                texts += [de for de, _ in block.get('glossary', [])]
    return texts


def find(dictionary, token):
    """The entry a word is found by, as hover-read.js finds it, or None."""
    key = bare(token)
    index = dictionary['keys'].get(key, dictionary['forms'].get(key))
    return None if index is None else dictionary['words'][index]


# Not German words: spelled letters (el, em, L-I-Y-A), English (thank you) and foreign phrases in examples.
NOT_GERMAN = {'ss', 'el', 'em', 'en', 'de', 'te', 'we', 'ha', 'ay', 'thank', 'you', 'mail', 'l-i-y-a', 't-e-s-f-a-y-e'}


def unknown_words(course, dictionary):
    """Words in the course's German that the dictionary can't find, most frequent first."""
    from collections import Counter
    missing = Counter()
    for text in german_texts(course):
        for token in WORD.findall(re.sub(r'\([^)]*\)', '', text)):
            if len(token) > 1 and token.lower() not in NOT_GERMAN and find(dictionary, token) is None:
                missing[token] += 1
    return missing.most_common()
