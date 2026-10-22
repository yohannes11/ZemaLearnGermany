"""Which texts in the course are English (and so need an Amharic version for the Amharic interface).

German is what the course teaches and is never translated; the English that explains it is. Fields that are
always English are taken as they are; fields that hold German or English (options, table cells, prompts of
true/false items) go through `looks_english`.
"""
import re


def _words(text: str) -> list[str]:
    return text.split()


# Words that are also German (in, an, was, will, also, so) are left out.
ENGLISH = set(_words('''the a is are were be been you your yours i me my we our they them their he him his she her
it its this that these those what which who whom whose where when why how do does did done not no yes and or but
if of to on at for from with by about as into than then there here can could would should must may might
have has had get gets got say says said word words sentence sentences question answer means mean meaning correct
right wrong choose pick write build put order listen hear text use used one two three first second same other
only very more most all every each some any many much like likes after before always never often both
something someone people time day thing things way verb verbs noun nouns ending endings article articles form
forms plural singular person tense example examples look find give take make makes see tell think know comes come
goes go
vowel vowels long short letter letters sound sounds number numbers position rest masculine neuter feminine change
together everyday official clock months seasons participle regular year male female start middle end vehicle pattern
separable perfect since english throaty soft sh sht shp ks month season'''))
# English pronunciation guides: "tsvy", "eye-ns" or NAH-meh.
PRONUNCIATION = re.compile(r'^"[^"]+"|^[A-Z]{2,}(-[a-zA-Z]+)?$')
GERMAN = set(_words('''der die das den dem des ein eine einen einem einer ist sind bin bist seid ich du er sie es
wir ihr und nicht kein keine mit aus von zu bei nach im am um auf für auch noch schon sehr gern gerne
wie wo woher was wer
wann hast hat habe haben kommst kommt komme heißt heiße heißen mein meine dein deine ja nein doch richtig falsch
bitte danke herr frau'''))

ALWAYS_ENGLISH = ('intro', 'step', 'text', 'title', 'hint', 'why')
TAG = re.compile(r'<em class="de">.*?</em>|<[^>]+>')


def looks_english(text: str) -> bool:
    if PRONUNCIATION.match(text):
        return True
    # "sie (she)" or "masculine (der)": a gloss in brackets counts on its own.
    plain = TAG.sub(' ', text)
    inside = ' '.join(re.findall(r'\(([^)]*)\)', plain))
    outside = re.sub(r'\([^)]*\)', ' ', plain)
    return _mostly_english(outside) or _mostly_english(inside)


def _mostly_english(text: str) -> bool:
    words = re.findall(r"[A-Za-zÄÖÜäöüß']+", text.lower())
    en = sum(w in ENGLISH for w in words)
    de = sum(w in GERMAN for w in words)
    return en > de


def lesson_strings(lesson: dict) -> list[str]:
    """The English texts of one lesson, in reading order."""
    found = []
    add = found.append
    found += lesson.get('intro', [])
    for block in lesson.get('blocks', []):
        for field in ('step', 'title', 'text'):
            # A reading text's title is German, like the text itself.
            if block.get(field) and not (field == 'title' and block.get('reading')):
                add(block[field])
        for _, en in block.get('examples', []):
            add(en)
        for _, en in block.get('glossary', []):
            add(en)
        table = block.get('table')
        if table:
            found += [h for h in table['head'] if h and looks_english(h)]
            found += [c for row in table['rows'] for c in row if looks_english(c)]
    for title, text in lesson.get('rules', []):
        add(title)
        add(text)
    quiz = lesson.get('quiz')
    if quiz:
        add(quiz['title'])
        for item in quiz['items']:
            true_false = item.get('options') == ['richtig', 'falsch']
            for field in ('hint', 'why'):
                # True/false items explain with the German sentence from the text.
                if item.get(field) and not (field == 'why' and true_false):
                    add(item[field])
            prompt = item.get('prompt')
            if prompt and (item.get('type') != 'choose' or looks_english(prompt)):
                add(prompt)
            # write_de gives an English sentence to translate; answer_de asks a German question.
            if item.get('type') == 'write' and item.get('text') and item.get('prompt') == 'Write it in German.':
                add(item['text'])
            if item.get('type') == 'write' and item.get('lang') == 'en':
                add(item['answer'])
            found += [o for o in item.get('options') or [] if looks_english(o)]
    seen, ordered = set(), []
    for text in found:
        if text and text not in seen:
            seen.add(text)
            ordered.append(text)
    return ordered


def course_strings(course: dict) -> list[str]:
    seen, ordered = set(), []
    for unit in course['units']:
        for lesson in unit['grammar']:
            for text in lesson_strings(lesson):
                if text not in seen:
                    seen.add(text)
                    ordered.append(text)
    return ordered
