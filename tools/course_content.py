"""Source for course-data.js: German A1.1, a Start unit (pronunciation, numbers 1-12) and Units 1-9.
Units 1-7 began as vocabulary sheets and unit recaps (11percent.de); later sections, lessons and Units 8-9
extend the course to the full A1.1 syllabus.

Run this file to regenerate static/course/js/course-data.js, then tools/gen_course_audio.py for new audio.
"""
import json
from pathlib import Path

from word_pictures import PICTURES


def w(german, english):
    return {'german': german, 'english': english}


def sec(key, title, words):
    return {'key': key, 'title': title, 'words': [w(g, e) for g, e in words]}


def gap(before, answer, after, options, hint='', say=None, why=''):
    return {'type': 'gap', 'before': before, 'answer': answer, 'after': after, 'options': options,
            'hint': hint, 'say': say or f'{before}{answer}{after}'.strip(), 'why': why}


def choose(prompt, answer, options, hint='', why=''):
    return {'type': 'choose', 'prompt': prompt, 'answer': answer, 'options': options, 'hint': hint, 'say': answer, 'why': why}


def conj(verb_forms, en=None):
    """Rows for a conjugation table: [('ich', 'bin'), ...] -> table rows with audio."""
    rows, say = [], []
    for person, form in verb_forms:
        rows.append([person, form])
        spoken = person.split(' / ')[0].split('/')[0]
        say.append(f'{spoken} {form}')
    return {'head': ['Person', 'Form'], 'rows': rows, 'say': say, 'highlight': 1}


PERSONS = ['ich', 'du', 'er / sie / es', 'wir', 'ihr', 'sie / Sie']

def listen(answer, options, say=None, why='', hint='Press play as often as you like, then choose.'):
    """Listening item: the learner hears `say` (default: the answer) and picks what they heard."""
    return {'type': 'listen', 'prompt': 'Which one do you hear?', 'answer': answer, 'options': options,
            'hint': hint, 'say': say or answer, 'why': why}


def sound(prompt, answer, options, say, why=''):
    """A question about how a word is pronounced; `say` is the word, played after answering."""
    return {'type': 'choose', 'prompt': prompt, 'answer': answer, 'options': options, 'hint': 'Choose the right sound.',
            'say': say, 'why': why}


def spell(before, answer, after, options, hint, why=''):
    """Dictation gap: the learner hears the whole word, then fills in the missing letters."""
    return {**gap(before, answer, after, options, hint=hint, why=why), 'listen': True}


# ---------------------------------------------------------------- Start: pronunciation & numbers 1-12
UNIT0 = {
    'id': 0,
    'label': 'Start',
    'title': 'Pronunciation & numbers',
    'lessonsLabel': 'Pronunciation',
    'sections': [
        sec('0.1', 'Long & short vowels', [
            ('der Name', 'the name (m.)'), ('der Mann', 'the man (m.)'), ('der Tee', 'the tea (m.)'),
            ('das Bett', 'the bed (n.)'), ('wir', 'we'), ('bitte', 'please'), ('rot', 'red'), ('oft', 'often'),
            ('gut', 'good'), ('die Mutter', 'the mother (f.)'), ('das Jahr', 'the year (n.)'), ('kommen', 'to come')]),
        sec('0.2', 'The umlauts ä, ö, ü', [
            ('der Käse', 'the cheese (m.)'), ('das Mädchen', 'the girl (n.)'), ('spät', 'late'), ('schön', 'beautiful'),
            ('hören', 'to hear'), ('der Löffel', 'the spoon (m.)'), ('die Tür', 'the door (f.)'), ('müde', 'tired'),
            ('die Übung', 'the exercise (f.)'), ('Tschüss!', 'Bye!')]),
        sec('0.3', 'Vowel pairs: ei, ie, eu, au', [
            ('mein', 'my'), ('nein', 'no'), ('die Zeit', 'the time (f.)'), ('Wie?', 'How?'), ('die Liebe', 'the love (f.)'),
            ('viel', 'much, a lot'), ('heute', 'today'), ('neu', 'new'), ('die Häuser', 'the houses (pl.)'),
            ('das Haus', 'the house (n.)'), ('die Frau', 'the woman (f.)'), ('auch', 'also, too')]),
        sec('0.4', 'w, v, z, j, s, ß', [
            ('das Wasser', 'the water (n.)'), ('der Wein', 'the wine (m.)'), ('der Vater', 'the father (m.)'),
            ('die Zahl', 'the number (f.)'), ('der Zug', 'the train (m.)'), ('ja', 'yes'), ('jetzt', 'now'),
            ('die Sonne', 'the sun (f.)'), ('die Straße', 'the street (f.)'), ('der Tag', 'the day (m.)'),
            ('und', 'and'), ('gelb', 'yellow')]),
        sec('0.5', 'sch, sp, st & ch', [
            ('die Schule', 'the school (f.)'), ('schnell', 'fast'), ('sprechen', 'to speak'), ('spielen', 'to play'),
            ('die Stadt', 'the city (f.)'), ('ich', 'I'), ('nicht', 'not'), ('die Milch', 'the milk (f.)'),
            ('die Nacht', 'the night (f.)'), ('das Buch', 'the book (n.)'), ('kochen', 'to cook'),
            ('der Apfel', 'the apple (m.)'), ('das Brot', 'the bread (n.)')]),
        sec('0.6', 'Numbers 1–12', [
            ('eins', 'one (1)'), ('zwei', 'two (2)'), ('drei', 'three (3)'), ('vier', 'four (4)'), ('fünf', 'five (5)'),
            ('sechs', 'six (6)'), ('sieben', 'seven (7)'), ('acht', 'eight (8)'), ('neun', 'nine (9)'),
            ('zehn', 'ten (10)'), ('elf', 'eleven (11)'), ('zwölf', 'twelve (12)')]),
    ],
    'grammar': [
        {'key': 'g0-vowels', 'code': 'P1', 'title': 'Long and short vowels', 'chapters': ['0.1'],
         'intro': [
             'Good news: German is written almost exactly as it is spoken. Once you know the sounds of the letters, '
             'you can read any word aloud, even one you have never seen before.',
             'Each vowel (<em class="de">a, e, i, o, u</em>) has a <strong>long</strong> and a <strong>short</strong> '
             'sound. The spelling around the vowel tells you which one to use.'],
         'blocks': [
             {'step': 'The sounds', 'title': 'Five vowels, two lengths',
              'text': 'Press a speaker to hear the long word, then the short one.',
              'table': {'head': ['Vowel', 'Long', 'Short'],
                        'rows': [['a', 'Name', 'Mann'], ['e', 'Tee', 'Bett'], ['i', 'wir', 'bitte'],
                                 ['o', 'rot', 'oft'], ['u', 'gut', 'Mutter']],
                        'say': ['Name, Mann', 'Tee, Bett', 'wir, bitte', 'rot, oft', 'gut, Mutter'], 'highlight': 0}},
             {'step': 'The spelling', 'title': 'How to tell long from short', 'examples': [
                 ('der Tee', 'Double vowel: long.'), ('das Jahr', 'Vowel + h: long. The h itself is silent.'),
                 ('der Name', 'One vowel + one consonant: usually long.'),
                 ('der Mann', 'Double consonant: short.'), ('oft', 'Two different consonants: usually short.')]},
             {'step': 'Every letter counts', 'title': 'Nothing is silent at the end', 'examples': [
                 ('der Name', 'The final e is spoken: NAH-meh.'), ('bitte', 'BIT-teh, never "bit".'),
                 ('der Vater', 'A final -er sounds like a short "ah": FAH-tah.')]},
         ],
         'rules': [('Double vowel or vowel + h', 'long: Tee, Jahr'), ('Double consonant', 'short: Mann, Bett'),
                   ('Final -e is spoken', 'Name = NAH-meh, never silent'), ('Final -er', 'a short "ah": Vater, Mutter')],
         'quiz': {'title': 'Long or short?', 'items': [
             sound('In "Tee", is the e long or short?', 'long', ['long', 'short'], 'der Tee', 'Double vowel: long.'),
             sound('In "Mann", is the a long or short?', 'short', ['long', 'short'], 'der Mann', 'Double consonant: short.'),
             sound('In "Jahr", is the a long or short?', 'long', ['long', 'short'], 'das Jahr', 'Vowel + h: long.'),
             sound('In "bitte", is the i long or short?', 'short', ['long', 'short'], 'bitte', 'Double consonant: short.'),
             sound('In "gut", is the u long or short?', 'long', ['long', 'short'], 'gut', 'One vowel + one consonant: long.'),
             sound('How do you end the word "Name"?', 'NAH-meh', ['NAH-meh', 'NAYM', 'NAHM'], 'der Name',
                   'The final e is always spoken.'),
             listen('Stadt', ['Stadt', 'Staat'], why='Stadt (city) has a short a, Staat (state) a long one.'),
             listen('Bett', ['Bett', 'Beet'], why='Bett (bed) is short, Beet (flower bed) is long.'),
             listen('offen', ['offen', 'Ofen'], why='offen (open) is short, Ofen (oven) is long.'),
             listen('Miete', ['Miete', 'Mitte'], why='Miete (rent) has a long ie, Mitte (middle) a short i.'),
         ]}},
        {'key': 'g0-umlauts', 'code': 'P2', 'title': 'The umlauts ä, ö, ü', 'chapters': ['0.2'],
         'intro': [
             'The two dots change the sound. <em class="de">ä</em>, <em class="de">ö</em> and <em class="de">ü</em> '
             'are vowels of their own, so <em class="de">schon</em> (already) and <em class="de">schön</em> '
             '(beautiful) are two different words.',
             'No umlaut on your keyboard? Write <strong>ae, oe, ue</strong>: <em class="de">Mädchen</em> → '
             '<em class="de">Maedchen</em>. You will also see this in email addresses and on forms.'],
         'blocks': [
             {'step': 'The sounds', 'title': 'How to make them',
              'text': 'The trick for ö and ü: say a sound you know, then round your lips without moving your tongue.',
              'table': {'head': ['Letter', 'How to say it', 'Example'],
                        'rows': [['ä', 'like the e in "bed"', 'Käse'],
                                 ['ö', 'say "eh", then round your lips', 'schön'],
                                 ['ü', 'say "ee", then round your lips as if to whistle', 'Tür']],
                        'say': ['Käse', 'schön', 'Tür'], 'highlight': 2}},
             {'step': 'Listen', 'title': 'Two dots, a different word', 'examples': [
                 ('schon, schön', 'already, beautiful'), ('die Mutter, die Mütter', 'the mother, the mothers'),
                 ('der Vater, die Väter', 'the father, the fathers'), ('zahlen, zählen', 'to pay, to count')]},
         ],
         'rules': [('ä', 'like the e in "bed"'), ('ö', '"eh" with round lips'), ('ü', '"ee" with round lips'),
                   ('No umlaut key?', 'write ae, oe, ue')],
         'quiz': {'title': 'With or without the dots?', 'items': [
             listen('schön', ['schön', 'schon'], why='schön = beautiful, schon = already.'),
             listen('schon', ['schon', 'schön'], why='schon = already, schön = beautiful.'),
             listen('Mütter', ['Mütter', 'Mutter'], why='die Mütter = the mothers.'),
             listen('Väter', ['Väter', 'Vater'], why='die Väter = the fathers.'),
             listen('Brüder', ['Brüder', 'Bruder'], why='die Brüder = the brothers.'),
             listen('zählen', ['zählen', 'zahlen'], why='zählen = to count, zahlen = to pay.'),
             listen('können', ['können', 'kennen'], why='können = can, kennen = to know (someone).'),
             sound('How do you write "Mädchen" without ä?', 'Maedchen', ['Maedchen', 'Madchen', 'Mädchen'],
                   'das Mädchen', 'ä → ae.'),
             sound('How do you write "schön" without ö?', 'schoen', ['schoen', 'schon', 'schöen'], 'schön', 'ö → oe.'),
             sound('How do you write "Tschüss" without ü?', 'Tschuess', ['Tschuess', 'Tschuss', 'Tschüs'],
                   'Tschüss!', 'ü → ue.'),
         ]}},
        {'key': 'g0-pairs', 'code': 'P3', 'title': 'Vowel pairs: ei, ie, eu, au', 'chapters': ['0.3'],
         'intro': [
             'Some vowels come in pairs and make a single sound. The famous trap is <em class="de">ei</em> and '
             '<em class="de">ie</em>, which sound nothing alike.',
             'The trick: say the <strong>second</strong> letter the English way. In <em class="de">ei</em> you say '
             'English "i" (eye): <em class="de">mein</em>. In <em class="de">ie</em> you say English "e" (ee): '
             '<em class="de">die</em>.'],
         'blocks': [
             {'step': 'The sounds', 'title': 'Four pairs to know',
              'text': 'Press a speaker to hear the examples.',
              'table': {'head': ['Letters', 'Sound', 'Examples'],
                        'rows': [['ei', '"eye"', 'mein, nein, drei'], ['ie', '"ee" in "see"', 'die, vier, Liebe'],
                                 ['eu / äu', '"oy" in "boy"', 'neu, heute, Häuser'], ['au', '"ow" in "how"', 'Haus, Frau, auch']],
                        'say': ['mein, nein, drei', 'die, vier, Liebe', 'neu, heute, Häuser', 'Haus, Frau, auch'],
                        'highlight': 0}},
             {'step': 'Listen', 'title': 'In real words', 'examples': [
                 ('der Wein, Wien', 'the wine, Vienna'), ('das Bier', 'the beer'), ('Deutsch', 'German'),
                 ('Auf Wiedersehen!', 'Goodbye!')]},
         ],
         'rules': [('ei = "eye"', 'mein, drei'), ('ie = "ee"', 'die, vier'), ('eu = äu = "oy"', 'neu, Häuser'),
                   ('au = "ow"', 'Haus, Frau')],
         'quiz': {'title': 'Listen and fill in the letters', 'items': [
             spell('dr', 'ei', '', ['ei', 'ie'], 'three'),
             spell('v', 'ie', 'r', ['ei', 'ie'], 'four'),
             spell('s', 'ie', 'ben', ['ei', 'ie'], 'seven'),
             spell('n', 'ei', 'n', ['ei', 'ie'], 'no'),
             spell('m', 'ei', 'n', ['ei', 'ie'], 'my'),
             spell('die Z', 'ei', 't', ['ei', 'ie'], 'the time'),
             spell('die L', 'ie', 'be', ['ei', 'ie'], 'the love'),
             spell('h', 'eu', 'te', ['eu', 'au', 'ei'], 'today'),
             spell('das H', 'au', 's', ['au', 'eu', 'ei'], 'the house'),
             spell('n', 'eu', 'n', ['eu', 'au', 'ie'], 'nine'),
             spell('die Fr', 'au', '', ['au', 'eu', 'ei'], 'the woman'),
         ]}},
        {'key': 'g0-consonants', 'code': 'P4', 'title': 'Letters that sound different: w, v, z, j, s, ß',
         'chapters': ['0.4'],
         'intro': [
             'Most consonants sound just as they do in English. A few letters follow German rules, and they appear '
             'in many everyday words.'],
         'blocks': [
             {'step': 'The sounds', 'title': 'Six letters to watch',
              'text': 'Press a speaker to hear each example.',
              'table': {'head': ['Letter', 'Sounds like', 'Example'],
                        'rows': [['w', 'English v', 'Wasser'], ['v', 'English f', 'Vater'],
                                 ['z', '"ts" as in "cats"', 'Zeit'], ['j', 'English y', 'ja'],
                                 ['s + vowel', 'English z', 'Sonne'], ['ß', '"ss"', 'Straße']],
                        'say': ['Wasser', 'Vater', 'Zeit', 'ja', 'Sonne', 'Straße'], 'highlight': 2}},
             {'step': 'At the end of a word', 'title': 'b, d, g go quiet',
              'text': 'At the end of a word, b, d and g sound like p, t and k.',
              'examples': [('gelb', 'yellow: the b sounds like p'), ('und', 'and: the d sounds like t'),
                           ('der Tag', 'the day: the g sounds like k')]},
         ],
         'rules': [('w → v', 'Wasser, Wein'), ('v → f', 'Vater, vier'), ('z → ts', 'Zeit, zwei'), ('j → y', 'ja, jetzt'),
                   ('Final b, d, g → p, t, k', 'gelb, und, Tag')],
         'quiz': {'title': 'How does it sound?', 'items': [
             sound('How does the w in "Wasser" sound?', 'like English v', ['like English v', 'like English w', 'like English f'], 'das Wasser'),
             sound('How does the w in "Wein" sound?', 'like English v', ['like English v', 'like English w', 'like English f'], 'der Wein'),
             sound('How does the v in "Vater" sound?', 'like English f', ['like English f', 'like English v', 'like English w'], 'der Vater'),
             sound('How does the v in "vier" sound?', 'like English f', ['like English f', 'like English v', 'like English w'], 'vier'),
             sound('How does the z in "Zeit" sound?', 'like "ts"', ['like "ts"', 'like English z', 'like "s"'], 'die Zeit'),
             sound('How does the z in "zwei" sound?', 'like "ts"', ['like "ts"', 'like English z', 'like "s"'], 'zwei'),
             sound('How does the j in "ja" sound?', 'like English y', ['like English y', 'like English j', 'like "h"'], 'ja'),
             sound('How does the s in "Sonne" sound?', 'like English z', ['like English z', 'like English s', 'like "sh"'], 'die Sonne',
                   's before a vowel sounds like z.'),
             sound('How does the ß in "Straße" sound?', 'like "ss"', ['like "ss"', 'like "b"', 'like "sh"'], 'die Straße'),
             sound('How does the d in "und" sound?', 'like t', ['like t', 'like d'], 'und', 'A final d sounds like t.'),
             sound('How does the g in "Tag" sound?', 'like k', ['like k', 'like g'], 'der Tag', 'A final g sounds like k.'),
         ]}},
        {'key': 'g0-sch-ch', 'code': 'P5', 'title': 'sch, sp, st and the two ch sounds', 'chapters': ['0.5'],
         'intro': [
             '<em class="de">sch</em> is simply English "sh": <em class="de">Schule</em>. At the start of a word, '
             '<em class="de">sp</em> and <em class="de">st</em> sound like "shp" and "sht": <em class="de">sprechen</em>, '
             '<em class="de">Stadt</em>.',
             '<em class="de">ch</em> has two sounds, and the letter just before it decides which one you use.'],
         'blocks': [
             {'step': 'The sounds', 'title': 'The two ch sounds',
              'table': {'head': ['After', 'Sound', 'Examples'],
                        'rows': [['a, o, u, au', 'throaty, at the back', 'Nacht, Buch, auch'],
                                 ['any other', 'soft, like the h in "huge"', 'ich, nicht, Milch']],
                        'say': ['Nacht, Buch, auch', 'ich, nicht, Milch'], 'highlight': 2}},
             {'step': 'Listen', 'title': 'More letter groups', 'examples': [
                 ('die Schule', 'the school: sch = sh'), ('sprechen', 'to speak: sp = shp'),
                 ('die Stadt', 'the city: st = sht'), ('sechs', 'six: chs = ks'),
                 ('der Apfel', 'the apple: pf, both letters are spoken'),
                 ('das Brot', 'the bread: r comes from the back of the throat')]},
         ],
         'rules': [('sch = sh', 'Schule'), ('sp-, st- = shp-, sht-', 'sprechen, Stadt'),
                   ('ch after a, o, u, au', 'throaty: Buch'), ('ch after other letters', 'soft: ich'),
                   ('chs = ks', 'sechs')],
         'quiz': {'title': 'Which sound is it?', 'items': [
             sound('Which ch is in "Buch"?', 'throaty', ['throaty', 'soft'], 'das Buch', 'After u: throaty.'),
             sound('Which ch is in "nicht"?', 'soft', ['throaty', 'soft'], 'nicht', 'After i: soft.'),
             sound('Which ch is in "Milch"?', 'soft', ['throaty', 'soft'], 'die Milch', 'After l: soft.'),
             sound('Which ch is in "auch"?', 'throaty', ['throaty', 'soft'], 'auch', 'After au: throaty.'),
             sound('Which ch is in "Küche"?', 'soft', ['throaty', 'soft'], 'die Küche', 'After ü: soft.'),
             sound('Which ch is in "kochen"?', 'throaty', ['throaty', 'soft'], 'kochen', 'After o: throaty.'),
             sound('Which ch is in "Mädchen"?', 'soft', ['throaty', 'soft'], 'das Mädchen', 'After ä: soft.'),
             sound('How do you say the st in "Stadt"?', 'sht', ['sht', 'st'], 'die Stadt', 'At the start of a word: sht.'),
             sound('How do you say the sp in "spielen"?', 'shp', ['shp', 'sp'], 'spielen', 'At the start of a word: shp.'),
             sound('How do you say the chs in "sechs"?', 'ks', ['ks', 'sh', 'ch'], 'sechs'),
         ]}},
        {'key': 'g0-numbers', 'code': 'P6', 'title': 'Numbers 1–12', 'chapters': ['0.6'],
         'intro': [
             'You need numbers from day one: phone numbers, prices, times, your age, your house number.',
             'The numbers 1 to 12 each have their own name. From 13 on, German builds numbers out of these, '
             'so learn these twelve well.'],
         'blocks': [
             {'step': 'The numbers', 'title': 'One to twelve',
              'text': 'Press a speaker to hear each number. The last column gives a rough English guide.',
              'table': {'head': ['Number', 'German', 'Say it like'],
                        'rows': [['1', 'eins', '"eye-ns"'], ['2', 'zwei', '"tsvy"'], ['3', 'drei', '"dry"'],
                                 ['4', 'vier', '"feer"'], ['5', 'fünf', 'round lips for ü'],
                                 ['6', 'sechs', '"zeks"'], ['7', 'sieben', '"ZEE-ben"'],
                                 ['8', 'acht', '"ahkht", throaty ch'], ['9', 'neun', '"noyn"'],
                                 ['10', 'zehn', '"tsayn"'], ['11', 'elf', '"elf"'],
                                 ['12', 'zwölf', '"tsv-" + round lips for ö']],
                        'say': ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
                                'elf', 'zwölf'], 'highlight': 1}},
             {'step': 'In use', 'title': 'Numbers in sentences', 'examples': [
                 ('Ich bin zwölf.', 'I am twelve.'), ('Ich habe zwei Kinder.', 'I have two children.'),
                 ('Zimmer elf, bitte.', 'Room eleven, please.'),
                 ('zwo', 'two: often used on the phone so that zwei and drei are not mixed up')]},
         ],
         'rules': [('eins', 'one; when counting: eins, zwei, drei'), ('zwei or zwo', 'zwo on the phone'),
                   ('sechs', 'chs = ks: "zeks"'), ('sieben', 'two syllables: ZEE-ben')],
         'quiz': {'title': 'Hear it, count it', 'items': [
             listen('2', ['2', '3', '10'], say='zwei'),
             listen('3', ['3', '2', '8'], say='drei'),
             listen('6', ['6', '7', '5'], say='sechs'),
             listen('7', ['7', '6', '11'], say='sieben'),
             listen('11', ['11', '12', '8'], say='elf'),
             listen('12', ['12', '2', '11'], say='zwölf'),
             listen('9', ['9', '10', '4'], say='neun'),
             gap('drei + vier = ', 'sieben', '', ['sieben', 'sechs', 'acht'], hint='3 + 4',
                 say='drei plus vier ist sieben'),
             gap('zehn + zwei = ', 'zwölf', '', ['zwölf', 'elf', 'zehn'], hint='10 + 2', say='zehn plus zwei ist zwölf'),
             gap('acht − fünf = ', 'drei', '', ['drei', 'zwei', 'vier'], hint='8 − 5', say='acht minus fünf ist drei'),
             gap('neun + zwei = ', 'elf', '', ['elf', 'zwölf', 'zehn'], hint='9 + 2', say='neun plus zwei ist elf'),
             gap('eins + drei = ', 'vier', '', ['vier', 'fünf', 'zwei'], hint='1 + 3', say='eins plus drei ist vier'),
         ]}},
    ],
}

# ---------------------------------------------------------------- Unit 1 (unchanged from the original course)
UNIT1 = {
    'id': 1,
    'title': 'Introductions & Greetings',
    'sections': [
        sec('1.1', 'Greetings & farewells', [
            ('Hallo!', 'Hello!'), ('Hi!', 'Hi!'), ('Guten Tag!', 'Good day!'), ('Guten Morgen!', 'Good morning!'),
            ('Guten Abend!', 'Good evening!'), ('Tschüss!', 'Bye!'), ('Auf Wiedersehen!', 'Goodbye!'),
            ('der Tag', 'the day (m.)'), ('der Morgen', 'the morning (m.)'), ('der Abend', 'the evening (m.)')]),
        sec('1.2', 'Names', [
            ('Mein Name ist …', 'My name is …'), ('Wie ist dein Name?', 'What is your name? (informal)'),
            ('Ich heiße…', 'I am called…'), ('Wie heißt du?', 'What are you called? (informal)'),
            ('Wie heißen Sie?', 'What are you called? (formal)'), ('der Name', 'the name (m.)'),
            ('der Vorname', 'the first name (m.)'), ('der Nachname', 'the last name (m.)'), ('heißen', 'to be called')]),
        sec('1.3', 'Who is that?', [
            ('Wer bist du?', 'Who are you? (informal)'), ('Wer sind Sie?', 'Who are you? (formal)'),
            ('Wer ist das?', 'Who is that?'), ('Ich weiß nicht.', "I don't know."),
            ('der Mann', 'the man (m.)'), ('die Frau', 'the woman (f.)')]),
        sec('1.4', 'Where are you from?', [
            ('Woher kommst du?', 'Where are you from? (informal)'), ('Ich komme aus…', 'I come from…'),
            ('aus den Vereinigten Staaten', 'from the United States'), ('aus der Schweiz', 'from Switzerland'),
            ('aus der Türkei', 'from Turkey'), ('aus den Niederlanden', 'from the Netherlands'),
            ('aus den Vereinigten Arabischen Emiraten', 'from the UAE')]),
        sec('1.5', 'How are you?', [
            ("Wie geht's?", 'How are you? (informal, short)'), ('Wie geht es dir?', 'How are you? (informal)'),
            ('Wie geht es Ihnen?', 'How are you? (formal)'), ('gut', 'good'), ('sehr gut', 'very good'),
            ('schlecht', 'bad'), ('sehr schlecht', 'very bad'), ('soso', 'so-so')]),
        sec('1.6', 'Question words', [
            ('Wer?', 'Who?'), ('Wie?', 'How?'), ('Woher?', 'Where from?'), ('Wo?', 'Where?'),
            ('Was?', 'What?'), ('Wie bitte?', 'Pardon?')]),
        sec('1.7', 'Personal pronouns', [
            ('ich', 'I'), ('du', 'you (informal)'), ('er, sie, es', 'he, she, it'), ('wir', 'we'),
            ('ihr', 'you all (informal)'), ('sie', 'they'), ('Sie', 'you (formal)'),
            ('duzen', 'to use informal "you"'), ('siezen', 'to use formal "you"'),
            ('Du kannst mich duzen.', 'You can use informal "you" with me.')]),
        sec('1.8', 'First verbs', [('kochen', 'to cook'), ('machen', 'to do/make'), ('kommen', 'to come')]),
        sec('1.9', 'Please, thanks & sorry', [
            ('danke / danke schön', 'thanks / thank you very much'), ('bitte / bitte schön', "please / you're welcome"),
            ('nichts zu danken', "don't mention it"), ('gern geschehen', "you're welcome"),
            ('Entschuldigung', 'Excuse me / Sorry'), ('tut mir leid', "I'm sorry")]),
        sec('1.10', 'A formal conversation', [
            ('Wie geht es Ihnen?', 'How are you? (formal)'), ('Mir geht es gut, danke. Und Ihnen?', "I'm fine, thanks. And you?"),
            ('Wie heißen Sie?', 'What is your name? (formal)'), ('Woher kommen Sie?', 'Where are you from? (formal)'),
            ('Sie können mich duzen.', 'You can use informal "you" with me.'),
            ('Ich komme aus den Vereinigten Staaten.', 'I come from the USA.')]),
    ],
    # Unit 1 lessons have hand-built pages in the app.
    'grammar': [
        {'key': 'g-present', 'code': 'G1', 'title': 'Present tense: regular verbs', 'chapters': ['1.7', '1.8'], 'custom': 'present'},
        {'key': 'g-countries', 'code': 'G2', 'title': 'Countries with articles', 'chapters': ['1.4'], 'custom': 'countries'},
    ],
}

# ---------------------------------------------------------------- Unit 2
UNIT2 = {
    'id': 2,
    'title': 'Family & personal details',
    'sections': [
        sec('2.1', 'Family', [
            ('die Mutter', 'the mother (f.)'), ('der Vater', 'the father (m.)'), ('die Eltern', 'the parents (pl.)'),
            ('der Mann', 'the husband / the man (m.)'), ('die Frau', 'the wife / the woman (f.)'),
            ('die Kinder', 'the children / the kids (pl.)'), ('der Sohn', 'the son (m.)'), ('die Tochter', 'the daughter (f.)'),
            ('der Bruder', 'the brother (m.)'), ('die Schwester', 'the sister (f.)'), ('die Geschwister', 'the siblings (pl.)'),
            ('der Opa, der Großvater', 'grandpa, grandfather (m.)'), ('die Oma, die Großmutter', 'grandma, grandmother (f.)'),
            ('die Großeltern', 'the grandparents (pl.)'), ('die Tante', 'the aunt (f.)'), ('der Onkel', 'the uncle (m.)'),
            ('die Cousine', 'the cousin (female)'), ('der Cousin', 'the cousin (male)')]),
        sec('2.2', 'The definite article', [
            ('der', 'the (masculine)'), ('die', 'the (feminine)'), ('das', 'the (neuter)'), ('die (Plural)', 'the (plural)')]),
        sec('2.3', 'Who is that?', [
            ('Wer bist du?', 'Who are you? (informal)'), ('Wer sind Sie?', 'Who are you? (formal)'),
            ('Wer ist das?', 'Who is that?'), ('Ich weiß nicht.', "I don't know."),
            ('der Mann', 'the man (m.)'), ('die Frau', 'the woman (f.)')]),
        sec('2.4', 'My: mein & meine', [
            ('mein', 'my (masculine & neuter nouns)'), ('meine', 'my (feminine & plural nouns)'),
            ('mein Vater', 'my father'), ('meine Mutter', 'my mother'), ('meine Eltern', 'my parents')]),
        sec('2.5', 'The verb sein (to be)', [
            ('sein', 'to be'), ('ich bin', 'I am'), ('du bist', 'you are (informal)'), ('er, sie, es ist', 'he, she, it is'),
            ('wir sind', 'we are'), ('ihr seid', 'you are (plural, informal)'), ('sie sind', 'they are'), ('Sie sind', 'you are (formal)')]),
        sec('2.6', 'Languages', [
            ('die Sprache', 'the language (f.)'), ('sprechen', 'to speak'), ('ein bisschen', 'a little'),
            ('Deutsch', 'German'), ('Englisch', 'English'), ('Französisch', 'French'), ('Spanisch', 'Spanish'),
            ('Portugiesisch', 'Portuguese'), ('Japanisch', 'Japanese'), ('Chinesisch', 'Chinese'),
            ('Welche Sprachen sprichst du?', 'Which languages do you speak?'), ('Ich spreche Deutsch.', 'I speak German.'),
            ('Ich spreche ein bisschen Englisch.', 'I speak a little English.')]),
        sec('2.9', 'Phone numbers', [
            ('Wie ist deine Telefonnummer?', 'What is your phone number?'),
            ('Wie lautet deine Telefonnummer?', 'What is your phone number?'),
            ('die Telefonnummer', 'the phone number (f.)'), ('Wie bitte?', 'Pardon?'),
            ('Können Sie das bitte wiederholen?', 'Can you repeat that, please? (formal)')]),
        sec('2.10', 'Numbers 1–20', [
            ('eins', 'one / 1'), ('zwei', 'two / 2'), ('drei', 'three / 3'), ('vier', 'four / 4'), ('fünf', 'five / 5'),
            ('sechs', 'six / 6'), ('sieben', 'seven / 7'), ('acht', 'eight / 8'), ('neun', 'nine / 9'), ('zehn', 'ten / 10'),
            ('elf', 'eleven / 11'), ('zwölf', 'twelve / 12'), ('dreizehn', 'thirteen / 13'), ('vierzehn', 'fourteen / 14'),
            ('fünfzehn', 'fifteen / 15'), ('sechzehn', 'sixteen / 16'), ('siebzehn', 'seventeen / 17'),
            ('achtzehn', 'eighteen / 18'), ('neunzehn', 'nineteen / 19'), ('zwanzig', 'twenty / 20')]),
        sec('2.11', 'Where do you live?', [
            ('Wo wohnst du?', 'Where do you live? (informal)'), ('Wo wohnen Sie?', 'Where do you live? (formal)'),
            ('Wo lebt sie?', 'Where does she live?'), ('Ich wohne in …', 'I live in …'), ('Sie lebt in …', 'She lives in …'),
            ('Ich bin in … geboren.', 'I was born in …')]),
        sec('2.12', 'Married? Children?', [
            ('Bist du verheiratet?', 'Are you married? (informal)'), ('Sind Sie verheiratet?', 'Are you married? (formal)'),
            ('verheiratet', 'married'), ('geschieden', 'divorced'), ('ledig', 'single'),
            ('Ja, ich bin verheiratet.', 'Yes, I am married.'), ('Ich bin ledig.', 'I am single.'),
            ('Hast du Kinder?', 'Do you have children? (informal)'), ('Haben Sie Kinder?', 'Do you have children? (formal)'),
            ('Ich habe einen Sohn.', 'I have a son.'), ('Ich habe eine Tochter.', 'I have a daughter.'),
            ('Ich habe zwei Kinder.', 'I have two children.'), ('Ich habe keine Kinder.', "I don't have any children."),
            ('der Freund', 'the boyfriend / the friend (m.)'), ('die Freundin', 'the girlfriend / the friend (f.)')]),
        sec('2.13', 'Personal details', [
            ('der Name', 'the name (m.)'), ('der Vorname', 'the first name (m.)'), ('der Mittelname', 'the middle name (m.)'),
            ('der Spitzname', 'the nickname (m.)'), ('der Nachname', 'the last name (m.)'), ('die Straße', 'the street (f.)'),
            ('die Hausnummer', 'the house number (f.)'), ('die Stadt', 'the city / the town (f.)'),
            ('die Postleitzahl', 'the postcode / the zip code (f.)'), ('die Handynummer', 'the mobile number (f.)'),
            ('das Datum', 'the date (n.)'), ('die Unterschrift', 'the signature (f.)')]),
    ],
    'grammar': [
        {'key': 'g2-sein', 'code': 'G1', 'title': 'The verb sein (to be)', 'chapters': ['2.5', '2.12'],
         'intro': ['<em class="de">sein</em> means <strong>to be</strong>. It is irregular: every form has to be learned by heart, but you will use it all the time.'],
         'blocks': [
             {'step': 'The forms', 'title': 'sein in the present tense', 'text': 'Press a speaker to hear each form.',
              'table': conj([('ich', 'bin'), ('du', 'bist'), ('er / sie / es', 'ist'), ('wir', 'sind'), ('ihr', 'seid'), ('sie / Sie', 'sind')])},
             {'title': 'In sentences', 'examples': [
                 ('Ich bin Anna.', 'I am Anna.'), ('Du bist mein Bruder.', 'You are my brother.'),
                 ('Sie ist verheiratet.', 'She is married.'), ('Wir sind Geschwister.', 'We are siblings.'),
                 ('Ihr seid pünktlich.', 'You are on time.'), ('Sind Sie Frau Müller?', 'Are you Ms Müller?')]},
         ],
         'rules': [('bin · bist · ist', 'ich, du, er/sie/es'), ('sind · seid · sind', 'wir, ihr, sie/Sie'),
                   ('wir = sie = Sie', 'All three use sind.')],
         'quiz': {'title': 'Choose the right form of sein', 'items': [
             gap('Ich ', 'bin', ' Lehrerin.', ['bin', 'bist', 'ist', 'sind'], 'I am a teacher.'),
             gap('Du ', 'bist', ' mein Freund.', ['bin', 'bist', 'ist', 'seid'], 'You are my friend.'),
             gap('Er ', 'ist', ' verheiratet.', ['bin', 'bist', 'ist', 'sind'], 'He is married.'),
             gap('Wir ', 'sind', ' Geschwister.', ['seid', 'sind', 'ist', 'bin'], 'We are siblings.'),
             gap('Ihr ', 'seid', ' pünktlich.', ['sind', 'seid', 'bist', 'ist'], 'You (all) are on time.'),
             gap('Sie ', 'sind', ' meine Eltern.', ['ist', 'sind', 'seid', 'bin'], 'They are my parents.'),
             gap('Das ', 'ist', ' meine Schwester.', ['ist', 'sind', 'bist', 'bin'], 'That is my sister.'),
             gap('', 'Sind', ' Sie Herr Schmidt?', ['Ist', 'Sind', 'Seid', 'Bist'], 'Are you Mr Schmidt? (formal)'),
             gap('', 'Bist', ' du ledig?', ['Bist', 'Ist', 'Bin', 'Sind'], 'Are you single?'),
             gap('Meine Oma ', 'ist', ' 80.', ['ist', 'sind', 'bist', 'seid'], 'My grandma is 80.'),
         ]}},
        {'key': 'g2-sprechen', 'code': 'G2', 'title': 'sprechen: e changes to i', 'chapters': ['2.6'],
         'intro': ['<em class="de">sprechen</em> (to speak) is a <strong>stem-changing verb</strong>: in the du and er/sie/es forms the <strong>e</strong> of the stem becomes <strong>i</strong>. The endings stay regular.'],
         'blocks': [
             {'step': 'The forms', 'title': 'sprechen in the present tense',
              'table': conj([('ich', 'spreche'), ('du', 'sprichst'), ('er / sie / es', 'spricht'), ('wir', 'sprechen'), ('ihr', 'sprecht'), ('sie / Sie', 'sprechen')])},
             {'title': 'In sentences', 'examples': [
                 ('Ich spreche Deutsch.', 'I speak German.'), ('Sprichst du Englisch?', 'Do you speak English?'),
                 ('Sie spricht ein bisschen Spanisch.', 'She speaks a little Spanish.'), ('Wir sprechen Französisch.', 'We speak French.')]},
         ],
         'rules': [('e → i', 'only for du and er/sie/es'), ('du sprichst', 'er/sie/es spricht'), ('wir sprechen', 'ihr sprecht, sie sprechen')],
         'quiz': {'title': 'Choose the right form of sprechen', 'items': [
             gap('Ich ', 'spreche', ' Deutsch.', ['spreche', 'sprichst', 'spricht', 'sprechen'], 'I speak German.'),
             gap('', 'Sprichst', ' du Englisch?', ['Sprechst', 'Sprichst', 'Spricht', 'Sprechen'], 'Do you speak English?', why='du: e → i, sprichst.'),
             gap('Er ', 'spricht', ' Japanisch.', ['sprecht', 'spricht', 'sprechen', 'sprichst'], 'He speaks Japanese.', why='er/sie/es: e → i, spricht.'),
             gap('Wir ', 'sprechen', ' Spanisch.', ['sprechen', 'sprecht', 'spricht', 'spreche'], 'We speak Spanish.'),
             gap('Ihr ', 'sprecht', ' sehr gut Deutsch.', ['sprecht', 'spricht', 'sprechen', 'sprichst'], 'You (all) speak German very well.', why='ihr keeps the e: sprecht.'),
             gap('Meine Mutter ', 'spricht', ' Portugiesisch.', ['spricht', 'sprecht', 'sprechen', 'spreche'], 'My mother speaks Portuguese.'),
             gap('', 'Sprechen', ' Sie Chinesisch?', ['Sprecht', 'Sprechen', 'Spricht', 'Sprichst'], 'Do you speak Chinese? (formal)'),
             gap('Sie ', 'sprechen', ' Französisch.', ['sprechen', 'spricht', 'sprecht', 'sprichst'], 'They speak French.'),
             gap('Du ', 'sprichst', ' ein bisschen Deutsch.', ['sprechst', 'sprichst', 'spricht', 'sprecht'], 'You speak a little German.'),
         ]}},
        {'key': 'g2-gender', 'code': 'G3', 'title': 'der, die, das: noun gender', 'chapters': ['2.1', '2.2'],
         'intro': ['Every German noun is <strong>masculine (der)</strong>, <strong>feminine (die)</strong> or <strong>neuter (das)</strong>. In the plural, all nouns use <strong>die</strong>.',
                   'The best habit is to always learn a noun together with its article. These patterns help you guess.'],
         'blocks': [
             {'step': 'Patterns', 'title': 'Usually der (masculine)', 'examples': [
                 ('der Vater', 'male people: the father'), ('der Montag', 'days, months, seasons: Monday'),
                 ('der Sommer', 'summer'), ('der Liebling', 'words ending in -ling: the darling'), ('der Wein', 'most alcoholic drinks: wine (but das Bier)')]},
             {'title': 'Usually die (feminine)', 'examples': [
                 ('die Mutter', 'female people: the mother (but das Mädchen)'), ('die Freiheit', 'words ending in -heit / -keit: freedom'),
                 ('die Freundschaft', 'words ending in -schaft: friendship'), ('die Rechnung', 'words ending in -ung: the bill'),
                 ('die Kultur', 'words ending in -ur: culture'), ('die Lampe', 'many words ending in -e: the lamp')]},
             {'title': 'Usually das (neuter)', 'examples': [
                 ('das Mädchen', 'words ending in -chen: the girl'), ('das Kaninchen', 'the rabbit'), ('das Publikum', 'many Latin words: the audience')]},
         ],
         'rules': [('der', 'male people, days, months, seasons, -ling'), ('die', 'female people, -heit, -keit, -schaft, -ung, -ur, often -e'),
                   ('das', '-chen, -lein, many Latin words'), ('die (plural)', 'all plurals')],
         'quiz': {'title': 'der, die or das?', 'items': [
             gap('', 'der', ' Vater', ['der', 'die', 'das'], 'the father', why='Male people are masculine.'),
             gap('', 'die', ' Schwester', ['der', 'die', 'das'], 'the sister', why='Female people are feminine.'),
             gap('', 'das', ' Mädchen', ['der', 'die', 'das'], 'the girl', why='Words ending in -chen are neuter.'),
             gap('', 'der', ' Montag', ['der', 'die', 'das'], 'Monday', why='Days of the week are masculine.'),
             gap('', 'die', ' Rechnung', ['der', 'die', 'das'], 'the bill', why='Words ending in -ung are feminine.'),
             gap('', 'die', ' Freiheit', ['der', 'die', 'das'], 'freedom', why='Words ending in -heit are feminine.'),
             gap('', 'der', ' Winter', ['der', 'die', 'das'], 'winter', why='Seasons are masculine.'),
             gap('', 'das', ' Bier', ['der', 'die', 'das'], 'beer', why='Most drinks with alcohol are der, but das Bier is the exception.'),
             gap('', 'die', ' Kultur', ['der', 'die', 'das'], 'culture', why='Words ending in -ur are feminine.'),
             gap('', 'der', ' Wein', ['der', 'die', 'das'], 'wine', why='Most alcoholic drinks are masculine.'),
             gap('', 'die', ' Freundschaft', ['der', 'die', 'das'], 'friendship', why='Words ending in -schaft are feminine.'),
             gap('', 'die', ' Eltern', ['der', 'die', 'das'], 'the parents', why='All plurals use die.'),
         ]}},
        {'key': 'g2-mein', 'code': 'G4', 'title': 'mein or meine?', 'chapters': ['2.1', '2.4'],
         'intro': ['<em class="de">mein</em> and <em class="de">meine</em> both mean <strong>my</strong>. Which one you use depends on the noun that follows.'],
         'blocks': [
             {'step': 'The rule', 'title': 'mein for der and das, meine for die and plural',
              'table': {'head': ['Noun type', 'Example'], 'rows': [['masculine (der)', 'mein Vater'], ['neuter (das)', 'mein Kind'], ['feminine (die)', 'meine Mutter'], ['plural (die)', 'meine Eltern']],
                        'say': ['mein Vater', 'mein Kind', 'meine Mutter', 'meine Eltern'], 'highlight': 1}},
         ],
         'rules': [('der / das → mein', 'mein Bruder, mein Datum'), ('die → meine', 'meine Tante'), ('plural → meine', 'meine Großeltern')],
         'quiz': {'title': 'mein or meine?', 'items': [
             gap('', 'meine', ' Mutter', ['mein', 'meine'], 'my mother (die Mutter)'),
             gap('', 'mein', ' Vater', ['mein', 'meine'], 'my father (der Vater)'),
             gap('', 'meine', ' Eltern', ['mein', 'meine'], 'my parents (plural)'),
             gap('', 'mein', ' Bruder', ['mein', 'meine'], 'my brother (der Bruder)'),
             gap('', 'meine', ' Schwester', ['mein', 'meine'], 'my sister (die Schwester)'),
             gap('', 'meine', ' Großeltern', ['mein', 'meine'], 'my grandparents (plural)'),
             gap('', 'mein', ' Name', ['mein', 'meine'], 'my name (der Name)'),
             gap('', 'meine', ' Telefonnummer', ['mein', 'meine'], 'my phone number (die Telefonnummer)'),
             gap('', 'mein', ' Kind', ['mein', 'meine'], 'my child (das Kind)'),
             gap('', 'meine', ' Tante', ['mein', 'meine'], 'my aunt (die Tante)'),
             gap('', 'mein', ' Onkel', ['mein', 'meine'], 'my uncle (der Onkel)'),
         ]}},
    ],
}

# ---------------------------------------------------------------- Unit 3
UNIT3 = {
    'id': 3,
    'title': 'Food & shopping',
    'sections': [
        sec('3.1', 'Going shopping', [
            ('die Nachbarin', 'the neighbour (f.)'), ('der Supermarkt', 'the supermarket (m.)'), ('der Laden', 'the shop / the store (m.)'),
            ('das Geschäft', 'the shop / the business (n.)'), ('einkaufen gehen', 'to go shopping'), ('brauchen', 'to need'),
            ('kaufen', 'to buy'), ('kosten', 'to cost'), ('die Kartoffel', 'the potato (f.)'), ('die Tomate', 'the tomato (f.)'),
            ('das Brot', 'the bread (n.)'), ('die Banane', 'the banana (f.)'), ('der Saft', 'the juice (m.)')]),
        sec('3.2', 'Fruit & vegetables', [
            ('der Apfel', 'the apple (m.)'), ('die Birne', 'the pear (f.)'), ('die Banane', 'the banana (f.)'), ('die Orange', 'the orange (f.)'),
            ('die Erdbeere', 'the strawberry (f.)'), ('die Traube', 'the grape (f.)'), ('die Kartoffel', 'the potato (f.)'),
            ('die Tomate', 'the tomato (f.)'), ('der/die Paprika', 'the pepper / the paprika'), ('die Gurke', 'the cucumber (f.)'),
            ('die Zwiebel', 'the onion (f.)')]),
        sec('3.3', 'A / an: ein & eine', [
            ('ein', 'a, an (masculine & neuter)'), ('eine', 'a, an (feminine)'), ('ein Apfel', 'an apple'), ('eine Banane', 'a banana')]),
        sec('3.4', 'Food', [
            ('die Nahrungsmittel', 'the food / groceries (pl.)'), ('das Brötchen', 'the bread roll (n.)'), ('der Kuchen', 'the cake (m.)'),
            ('der Joghurt', 'the yoghurt (m.)'), ('der Käse', 'the cheese (m.)'), ('das Ei', 'the egg (n.)'), ('der Reis', 'the rice (m.)'),
            ('das Fleisch', 'the meat (n.)'), ('der Fisch', 'the fish (m.)'), ('die Wurst', 'the sausage (f.)'),
            ('Hast du Hunger?', 'Are you hungry?'), ('Ich habe Hunger.', 'I am hungry.'), ('Guten Appetit!', 'Enjoy your meal!')]),
        sec('3.5', 'No / not a: kein & keine', [
            ('kein', 'no, not a (masculine & neuter)'), ('keine', 'no, not a (feminine & plural)'),
            ('Das ist kein Apfel.', 'That is not an apple.'), ('Das ist keine Birne.', 'That is not a pear.'),
            ('Ich möchte kein Stück Kuchen.', "I don't want a piece of cake.")]),
        sec('3.6', 'Article overview', [
            ('der, die, das', 'the (definite articles)'), ('ein, eine', 'a, an (indefinite articles)'),
            ('mein, meine', 'my (possessive articles)'), ('kein, keine', 'no, not a (negative articles)')]),
        sec('3.8', 'Drinks', [
            ('das Bier', 'the beer (n.)'), ('der Tee', 'the tea (m.)'), ('das Wasser', 'the water (n.)'),
            ('das Mineralwasser', 'the mineral water (n.)'), ('die Milch', 'the milk (f.)'), ('der Wein', 'the wine (m.)'),
            ('der Kaffee', 'the coffee (m.)'), ('der Orangensaft', 'the orange juice (m.)'),
            ('Hast du Durst?', 'Are you thirsty?'), ('Bist du durstig?', 'Are you thirsty?'), ('Ich habe Durst.', 'I am thirsty.'),
            ('Was möchtest du trinken?', 'What would you like to drink? (informal)'),
            ('Was möchten Sie trinken?', 'What would you like to drink? (formal)'), ('Schmeckt gut!', 'Tastes good!'), ('Prost!', 'Cheers!')]),
        sec('3.9', 'The verb haben (to have)', [
            ('haben', 'to have'), ('ich habe', 'I have'), ('du hast', 'you have (informal)'), ('er hat', 'he has'),
            ('wir haben', 'we have'), ('ihr habt', 'you have (plural, informal)'), ('sie haben', 'they have')]),
        sec('3.11', 'Numbers 20–100', [
            ('einundzwanzig', 'twenty-one / 21'), ('zweiundzwanzig', 'twenty-two / 22'), ('dreißig', 'thirty / 30'),
            ('vierzig', 'forty / 40'), ('fünfzig', 'fifty / 50'), ('sechzig', 'sixty / 60'), ('siebzig', 'seventy / 70'),
            ('achtzig', 'eighty / 80'), ('neunzig', 'ninety / 90'), ('hundert', 'a hundred / 100')]),
        sec('3.12', 'Prices', [
            ('Wie viel kostet das?', 'How much does that cost?'), ('Was kostet das?', 'What does that cost?'),
            ('Das kostet …', 'That costs …'), ('Das macht …', 'That comes to …'), ('der Preis', 'the price (m.)'),
            ('der Euro', 'the euro (m.)'), ('der Cent', 'the cent (m.)'), ('das Kilo', 'the kilo (n.)'),
            ('das Wechselgeld', 'the change (n.)')]),
        sec('3.13', 'What do you like to eat?', [
            ('Was isst du gerne?', 'What do you like to eat?'), ('Was trinkst du gerne?', 'What do you like to drink?'),
            ('Isst du gerne Fisch?', 'Do you like to eat fish?'), ('Trinkst du gerne Tee?', 'Do you like to drink tea?'),
            ('Ja, ich esse gerne Fisch.', 'Yes, I like to eat fish.'), ('Nein, ich trinke nicht gerne Tee.', "No, I don't like to drink tea."),
            ('Was ist dein Lieblingsessen?', 'What is your favourite food?')]),
        sec('3.14', 'The verb essen (to eat)', [
            ('essen', 'to eat'), ('ich esse', 'I eat'), ('du isst', 'you eat (informal)'), ('sie isst', 'she eats'),
            ('wir essen', 'we eat'), ('ihr esst', 'you eat (plural, informal)'), ('sie essen', 'they eat')]),
        sec('3.15', 'At the restaurant', [
            ('etwas zum Trinken', 'something to drink'), ('etwas zum Essen', 'something to eat'),
            ('Was darf es sein?', 'What can I get you?'), ('Kommt gleich!', 'Coming right up!'),
            ('Ich möchte … bitte.', 'I would like … please.'), ('Ich nehme …', "I'll have …"),
            ('Können wir bitte die Rechnung bekommen?', 'Can we have the bill, please?'),
            ('Zahlen Sie mit Karte oder Bargeld?', 'Are you paying by card or in cash?'), ('Stimmt so.', 'Keep the change.'),
            ('In Ordnung?', 'All right?'), ('der Kellner', 'the waiter (m.)'), ('die Gäste', 'the guests (pl.)'),
            ('ein Glas Wein', 'a glass of wine'), ('das Menü', 'the set menu (n.)'), ('die Speise, das Essen', 'the dish, the food'),
            ('die Getränke', 'the drinks (pl.)'), ('bestellen', 'to order'), ('bereit', 'ready'),
            ('der Nachtisch, die Nachspeise', 'the dessert'), ('die Rechnung', 'the bill / the check (f.)'), ('bekommen', 'to get / to receive'),
            ('köstlich', 'delicious'), ('das Bargeld', 'the cash (n.)'), ('die Kreditkarte', 'the credit card (f.)'), ('das Trinkgeld', 'the tip (n.)')]),
    ],
    'grammar': [
        {'key': 'g3-articles', 'code': 'G1', 'title': 'ein / eine and kein / keine', 'chapters': ['3.3', '3.5', '3.6'],
         'intro': ['<em class="de">ein / eine</em> mean <strong>a / an</strong>. <em class="de">kein / keine</em> mean <strong>no / not a</strong>: they work exactly like ein / eine, with a k in front.'],
         'blocks': [
             {'step': 'The rule', 'title': 'Which form?',
              'table': {'head': ['Noun type', 'a / an', 'no / not a'], 'rows': [
                  ['masculine (der Apfel)', 'ein Apfel', 'kein Apfel'], ['neuter (das Ei)', 'ein Ei', 'kein Ei'],
                  ['feminine (die Banane)', 'eine Banane', 'keine Banane'], ['plural (die Äpfel)', '— Äpfel', 'keine Äpfel']],
                  'say': ['kein Apfel', 'kein Ei', 'keine Banane', 'keine Äpfel'], 'highlight': 2}},
             {'title': 'In sentences', 'examples': [
                 ('Das ist ein Apfel.', 'That is an apple.'), ('Das ist keine Birne.', 'That is not a pear.'),
                 ('Ich habe keine Kinder.', "I don't have any children."), ('Das ist kein Brot.', 'That is not bread.')]},
         ],
         'rules': [('ein / kein', 'masculine and neuter'), ('eine / keine', 'feminine'), ('keine', 'plural (there is no plural of ein)')],
         'quiz': {'title': 'ein, eine, kein or keine?', 'items': [
             gap('Das ist ', 'eine', ' Banane.', ['ein', 'eine', 'kein', 'keine'], 'That is a banana.'),
             gap('Das ist ', 'kein', ' Apfel.', ['ein', 'eine', 'kein', 'keine'], 'That is not an apple.'),
             gap('Ich habe ', 'keine', ' Kinder.', ['ein', 'eine', 'kein', 'keine'], "I don't have any children.", why='Plural: keine.'),
             gap('Das ist ', 'ein', ' Ei.', ['ein', 'eine', 'kein', 'keine'], 'That is an egg.', why='das Ei is neuter: ein.'),
             gap('Das ist ', 'keine', ' Birne.', ['ein', 'eine', 'kein', 'keine'], 'That is not a pear.'),
             gap('Das ist ', 'kein', ' Brot.', ['ein', 'eine', 'kein', 'keine'], 'That is not bread.', why='das Brot is neuter: kein.'),
             gap('Das ist ', 'eine', ' Tomate.', ['ein', 'eine', 'kein', 'keine'], 'That is a tomato.'),
             gap('Das sind ', 'keine', ' Kartoffeln.', ['ein', 'eine', 'kein', 'keine'], 'Those are not potatoes.', why='Plural: keine.'),
             gap('Das ist ', 'ein', ' Kuchen.', ['ein', 'eine', 'kein', 'keine'], 'That is a cake.'),
             gap('Das ist ', 'keine', ' Gurke.', ['ein', 'eine', 'kein', 'keine'], 'That is not a cucumber.'),
         ]}},
        {'key': 'g3-plural', 'code': 'G2', 'title': 'Plural forms', 'chapters': ['3.2', '3.4'],
         'intro': ['German plurals come in several patterns. The article in the plural is always <strong>die</strong>. Learn each noun with its plural.'],
         'blocks': [
             {'step': 'Patterns', 'title': 'Six ways to form the plural',
              'table': {'head': ['Ending', 'Singular', 'Plural'], 'rows': [
                  ['-(e)n', 'die Banane', 'die Bananen'], ['-e', 'der Fisch', 'die Fische'], ['-s', 'der Paprika', 'die Paprikas'],
                  ['-er', 'das Ei', 'die Eier'], ['no ending', 'der Kuchen', 'die Kuchen'], ['vowel change', 'der Apfel', 'die Äpfel']],
                  'say': ['die Bananen', 'die Fische', 'die Paprikas', 'die Eier', 'die Kuchen', 'die Äpfel'], 'highlight': 2}},
         ],
         'rules': [('die in the plural', 'die Äpfel, die Eier, die Kuchen'), ('feminine -e → -en', 'die Tomate → die Tomaten'), ('Umlaut', 'der Apfel → die Äpfel')],
         'quiz': {'title': 'Choose the plural', 'items': [
             gap('die Banane → die ', 'Bananen', '', ['Bananen', 'Bananes', 'Banane'], 'banana → bananas'),
             gap('der Fisch → die ', 'Fische', '', ['Fischen', 'Fische', 'Fischs'], 'fish → fish (plural)'),
             gap('das Ei → die ', 'Eier', '', ['Eis', 'Eien', 'Eier'], 'egg → eggs'),
             gap('der Apfel → die ', 'Äpfel', '', ['Apfels', 'Äpfel', 'Apfeln'], 'apple → apples', why='Vowel change, no ending.'),
             gap('der Kuchen → die ', 'Kuchen', '', ['Kuchen', 'Kuchens', 'Küchen'], 'cake → cakes', why='No ending.'),
             gap('die Tomate → die ', 'Tomaten', '', ['Tomates', 'Tomaten', 'Tomate'], 'tomato → tomatoes'),
             gap('der Paprika → die ', 'Paprikas', '', ['Paprikas', 'Paprikan', 'Paprike'], 'pepper → peppers'),
             gap('die Kartoffel → die ', 'Kartoffeln', '', ['Kartoffels', 'Kartoffeln', 'Kartöffel'], 'potato → potatoes'),
             gap('die Erdbeere → die ', 'Erdbeeren', '', ['Erdbeeren', 'Erdbeers', 'Erdbeere'], 'strawberry → strawberries'),
         ]}},
        {'key': 'g3-questions', 'code': 'G3', 'title': 'Yes/no questions: verb first', 'chapters': ['3.13'],
         'intro': ['To ask a question that can be answered with <strong>ja</strong> or <strong>nein</strong>, put the <strong>verb in first place</strong>.'],
         'blocks': [
             {'step': 'The rule', 'title': 'Statement → question', 'examples': [
                 ('Du isst gerne Obst. → Isst du gerne Obst?', 'Do you like to eat fruit?'),
                 ('Wir brauchen Kartoffeln. → Brauchen wir Kartoffeln?', 'Do we need potatoes?'),
                 ('Das ist eine Banane. → Ist das eine Banane?', 'Is this a banana?')]},
         ],
         'rules': [('Verb first', 'Isst du …? Hast du …? Ist das …?'), ('Answer', 'Ja, … / Nein, …')],
         'quiz': {'title': 'Which question is correct?', 'items': [
             choose('Do you like to eat fish?', 'Isst du gerne Fisch?', ['Isst du gerne Fisch?', 'Du isst gerne Fisch?', 'Gerne du isst Fisch?']),
             choose('Do we need potatoes?', 'Brauchen wir Kartoffeln?', ['Wir brauchen Kartoffeln?', 'Brauchen wir Kartoffeln?', 'Kartoffeln wir brauchen?']),
             choose('Is this a banana?', 'Ist das eine Banane?', ['Das ist eine Banane?', 'Eine Banane ist das?', 'Ist das eine Banane?']),
             choose('Are you hungry?', 'Hast du Hunger?', ['Hast du Hunger?', 'Du hast Hunger?', 'Hunger hast du?']),
             choose('Do you like to drink tea?', 'Trinkst du gerne Tee?', ['Du trinkst gerne Tee?', 'Trinkst du gerne Tee?', 'Gerne trinkst du Tee?']),
             choose('Is the cake tasty?', 'Ist der Kuchen köstlich?', ['Der Kuchen ist köstlich?', 'Ist der Kuchen köstlich?', 'Köstlich der Kuchen ist?']),
             choose('Do you need bread?', 'Brauchst du Brot?', ['Brauchst du Brot?', 'Du brauchst Brot?', 'Brot brauchst du?']),
             choose('Does the apple cost 1 euro?', 'Kostet der Apfel einen Euro?', ['Der Apfel kostet einen Euro?', 'Kostet der Apfel einen Euro?', 'Einen Euro der Apfel kostet?']),
         ]}},
        {'key': 'g3-haben-essen', 'code': 'G4', 'title': 'haben and essen', 'chapters': ['3.9', '3.14'],
         'intro': ['<em class="de">haben</em> (to have) loses its <strong>b</strong> in the du and er/sie/es forms. <em class="de">essen</em> (to eat) changes <strong>e → i</strong> in the same two forms.'],
         'blocks': [
             {'step': 'haben', 'title': 'haben in the present tense',
              'table': conj([('ich', 'habe'), ('du', 'hast'), ('er / sie / es', 'hat'), ('wir', 'haben'), ('ihr', 'habt'), ('sie / Sie', 'haben')])},
             {'step': 'essen', 'title': 'essen in the present tense',
              'table': conj([('ich', 'esse'), ('du', 'isst'), ('er / sie / es', 'isst'), ('wir', 'essen'), ('ihr', 'esst'), ('sie / Sie', 'essen')])},
         ],
         'rules': [('du hast · er hat', 'haben loses the b'), ('du isst · er isst', 'essen: e → i'), ('wir haben · wir essen', 'plural forms are regular')],
         'quiz': {'title': 'Choose the right form', 'items': [
             gap('Ich ', 'habe', ' Hunger.', ['habe', 'hast', 'hat', 'haben'], 'I am hungry.'),
             gap('', 'Hast', ' du Durst?', ['Habst', 'Hast', 'Hat', 'Habe'], 'Are you thirsty?'),
             gap('Er ', 'hat', ' zwei Kinder.', ['habt', 'hat', 'hast', 'haben'], 'He has two children.'),
             gap('Wir ', 'haben', ' keine Milch.', ['haben', 'habt', 'hat', 'habe'], "We don't have any milk."),
             gap('Ihr ', 'habt', ' einen Garten.', ['habt', 'haben', 'hat', 'hast'], 'You (all) have a garden.'),
             gap('Ich ', 'esse', ' gerne Fisch.', ['esse', 'isst', 'essen', 'esst'], 'I like to eat fish.'),
             gap('Du ', 'isst', ' gerne Kuchen.', ['esst', 'isst', 'esse', 'essen'], 'You like to eat cake.', why='du: e → i, isst.'),
             gap('Sie ', 'isst', ' kein Fleisch.', ['esst', 'isst', 'essen', 'esse'], "She doesn't eat meat."),
             gap('Wir ', 'essen', ' Reis.', ['essen', 'esst', 'isst', 'esse'], 'We eat rice.'),
             gap('', 'Esst', ' ihr gerne Käse?', ['Isst', 'Esst', 'Essen', 'Esse'], 'Do you (all) like cheese?', why='ihr keeps the e: esst.'),
         ]}},
    ],
}

# ---------------------------------------------------------------- Unit 4
UNIT4 = {
    'id': 4,
    'title': 'Home & living',
    'sections': [
        sec('4.1', 'Rooms', [
            ('die Wohnung', 'the apartment / the flat (f.)'), ('das Haus', 'the house (n.)'), ('das Zimmer', 'the room (n.)'),
            ('das Wohnzimmer', 'the living room (n.)'), ('das Schlafzimmer', 'the bedroom (n.)'), ('das Kinderzimmer', "the children's room (n.)"),
            ('das Arbeitszimmer', 'the study / the home office (n.)'), ('die Küche', 'the kitchen (f.)'),
            ('das Badezimmer', 'the bathroom (n.)'), ('das Bad', 'the bathroom (n.)')]),
        sec('4.2', 'Where is it?', [
            ('Wo ist es?', 'Where is it?'), ('Entschuldigung, wo ist das Badezimmer?', 'Excuse me, where is the bathroom?'),
            ('links', 'left / on the left'), ('rechts', 'right / on the right'), ('vorne', 'at the front'),
            ('hinten', 'at the back'), ('neben', 'next to')]),
        sec('4.3', 'Describing things', [
            ('Wie ist etwas?', 'What is something like?'), ('billig', 'cheap'), ('teuer', 'expensive'), ('schön', 'beautiful / nice'),
            ('hässlich', 'ugly'), ('dunkel', 'dark'), ('hell', 'bright / light'), ('alt', 'old'), ('neu', 'new'),
            ('klein', 'small'), ('groß', 'big / large')]),
        sec('4.4', 'nicht (not)', [
            ('nicht', 'not'), ('Die Küche ist nicht klein.', 'The kitchen is not small.'), ('Das Auto ist nicht neu.', 'The car is not new.')]),
        sec('4.5', 'er, sie, es for things', [
            ('er (der Tisch)', 'it (for der-nouns)'), ('sie (die Lampe)', 'it (for die-nouns)'), ('es (das Bett)', 'it (for das-nouns)'),
            ('sie (die Stühle)', 'they (for plural nouns)')]),
        sec('4.6', 'Talking about a home', [
            ('Das ist doch toll!', "That's really great!"), ('Wie ist deine Wohnung?', 'What is your apartment like?'),
            ('Hast du auch einen Balkon?', 'Do you have a balcony too?'), ('Ist die Wohnung teuer?', 'Is the apartment expensive?')]),
        sec('4.7', 'Floors & outside', [
            ('das Erdgeschoss', 'the ground floor (n.)'), ('der Stock', 'the floor / the storey (m.)'),
            ('der erste Stock', 'the first floor'), ('der zweite Stock', 'the second floor'), ('der Dachboden', 'the attic (m.)'),
            ('der Garten', 'the garden (m.)'), ('der Balkon', 'the balcony (m.)'), ('die Garage', 'the garage (f.)'),
            ('die Treppe', 'the stairs (f.)'), ('der Keller', 'the cellar / the basement (m.)')]),
        sec('4.8', 'Where? im / in der', [
            ('im ersten Stock', 'on the first floor'), ('im zweiten Stock', 'on the second floor'), ('im Garten', 'in the garden'),
            ('im Flur', 'in the hallway'), ('im Zimmer', 'in the room'), ('im Schlafzimmer', 'in the bedroom'),
            ('im Wohnzimmer', 'in the living room'), ('im Arbeitszimmer', 'in the study'), ('in der Garage', 'in the garage'),
            ('in der Wohnung', 'in the apartment'), ('in der Küche', 'in the kitchen')]),
        sec('4.9', 'Furniture', [
            ('der Schrank', 'the wardrobe / the cupboard (m.)'), ('das Sofa', 'the sofa (n.)'), ('die Couch', 'the couch (f.)'),
            ('der Tisch', 'the table (m.)'), ('der Couchtisch', 'the coffee table (m.)'), ('der Stuhl', 'the chair (m.)'),
            ('das Bett', 'the bed (n.)'), ('der Fernseher', 'the TV (m.)'), ('die Lampe', 'the lamp (f.)'),
            ('der Teppich', 'the carpet / the rug (m.)'), ('das Regal', 'the shelf (n.)')]),
        sec('4.10', 'Do you like it?', [
            ('Wie gefällt dir …?', 'How do you like …? (informal)'), ('Wie gefallen dir …?', 'How do you like …? (plural things)'),
            ('Wie gefällt Ihnen …?', 'How do you like …? (formal)'), ('Es gefällt mir.', 'I like it.'),
            ('Es gefällt mir sehr.', 'I like it a lot.'), ('Es gefällt mir sehr gut.', 'I like it very much.'),
            ('Es gefällt mir nicht.', "I don't like it."), ('Es gefällt mir nicht so gut.', "I don't like it that much."),
            ('Es gefällt mir überhaupt nicht.', "I don't like it at all.")]),
        sec('4.11', 'Kitchen & bathroom', [
            ('der Küchenschrank', 'the kitchen cupboard (m.)'), ('der Herd', 'the stove / the cooker (m.)'),
            ('der Kühlschrank', 'the fridge (m.)'), ('die Spüle', 'the kitchen sink (f.)'), ('die Waschmaschine', 'the washing machine (f.)'),
            ('die Dusche', 'the shower (f.)'), ('die Badewanne', 'the bathtub (f.)'), ('das Waschbecken', 'the washbasin (n.)'),
            ('der Spiegel', 'the mirror (m.)'), ('die Toilette', 'the toilet (f.)')]),
        sec('4.12', 'Colours', [
            ('weiß', 'white'), ('schwarz', 'black'), ('blau', 'blue'), ('rot', 'red'), ('gelb', 'yellow'), ('grün', 'green'),
            ('orange', 'orange'), ('braun', 'brown'), ('lila', 'purple'), ('grau', 'grey'),
            ('dunkelblau', 'dark blue'), ('hellgrün', 'light green'),
            ('Welche Farbe hat …?', 'What colour is …?'), ('Welche Farbe haben …?', 'What colour are …?')]),
        sec('4.13', 'your, his, her', [
            ('dein / deine', 'your (informal)'), ('sein / seine', 'his / its'), ('ihr / ihre', 'her / their')]),
        sec('4.14', 'Big numbers', [
            ('zweihundert', 'two hundred / 200'), ('dreihundert', 'three hundred / 300'), ('vierhundert', 'four hundred / 400'),
            ('fünfhundert', 'five hundred / 500'), ('sechshundert', 'six hundred / 600'), ('siebenhundert', 'seven hundred / 700'),
            ('achthundert', 'eight hundred / 800'), ('neunhundert', 'nine hundred / 900'), ('eintausend', 'one thousand / 1000'),
            ('zweitausend', 'two thousand / 2000'), ('fünftausend', 'five thousand / 5000'), ('eine Million', 'a million')]),
    ],
    'grammar': [
        {'key': 'g4-possessive', 'code': 'G1', 'title': 'Possessive articles: my, your, his …', 'chapters': ['4.13'],
         'intro': ['Possessive articles say who something belongs to. Like <em class="de">mein / meine</em>, they take <strong>-e</strong> before feminine and plural nouns.'],
         'blocks': [
             {'step': 'The table', 'title': 'Who owns it?',
              'table': {'head': ['Person', 'der / das', 'die / plural'], 'rows': [
                  ['ich', 'mein', 'meine'], ['du', 'dein', 'deine'], ['er / es', 'sein', 'seine'], ['sie (she)', 'ihr', 'ihre'],
                  ['wir', 'unser', 'unsere'], ['ihr', 'euer', 'eure'], ['sie (they)', 'ihr', 'ihre'], ['Sie', 'Ihr', 'Ihre']],
                  'say': ['meine', 'deine', 'seine', 'ihre', 'unsere', 'eure', 'ihre', 'Ihre'], 'highlight': 2}},
             {'title': 'In sentences', 'examples': [
                 ('Das ist mein Zimmer.', 'That is my room.'), ('Wo ist deine Küche?', 'Where is your kitchen?'),
                 ('Sein Garten ist groß.', 'His garden is big.'), ('Ihre Wohnung ist hell.', 'Her apartment is bright.'),
                 ('Unser Haus ist alt.', 'Our house is old.')]},
         ],
         'rules': [('+ e for die and plural', 'dein → deine, sein → seine'), ('euer → eure', 'the e in the middle drops'), ('Ihr (capital)', 'your, formal')],
         'quiz': {'title': 'Choose the possessive article', 'items': [
             gap('', 'deine', ' Wohnung', ['dein', 'deine', 'seine', 'ihr'], 'your apartment (du)'),
             gap('', 'sein', ' Garten', ['sein', 'seine', 'ihr', 'dein'], 'his garden'),
             gap('', 'ihr', ' Haus', ['ihr', 'ihre', 'sein', 'Ihr'], 'her house (das Haus)'),
             gap('', 'unsere', ' Küche', ['unser', 'unsere', 'eure', 'ihre'], 'our kitchen'),
             gap('', 'euer', ' Balkon', ['euer', 'eure', 'unser', 'Ihr'], 'your balcony (ihr)'),
             gap('', 'Ihr', ' Name', ['Ihr', 'Ihre', 'ihr', 'dein'], 'your name (formal)'),
             gap('', 'meine', ' Eltern', ['mein', 'meine', 'dein', 'deine'], 'my parents'),
             gap('', 'dein', ' Zimmer', ['dein', 'deine', 'sein', 'mein'], 'your room (du)'),
             gap('', 'seine', ' Lampe', ['sein', 'seine', 'ihre', 'deine'], 'his lamp'),
             gap('', 'ihre', ' Kinder', ['ihr', 'ihre', 'seine', 'eure'], 'their children'),
         ]}},
        {'key': 'g4-nicht', 'code': 'G2', 'title': 'nicht or kein?', 'chapters': ['4.3', '4.4'],
         'intro': ['Use <em class="de">nicht</em> to say something is <strong>not</strong> a certain way, for example with adjectives. Use <em class="de">kein / keine</em> before a noun (unit 3).'],
         'blocks': [
             {'step': 'The rule', 'title': 'nicht with adjectives', 'examples': [
                 ('Die Küche ist nicht klein.', 'The kitchen is not small.'), ('Das Auto ist nicht neu.', 'The car is not new.'),
                 ('Die Wohnung ist nicht teuer.', 'The apartment is not expensive.')]},
             {'title': 'kein with nouns', 'examples': [
                 ('Das ist kein Stuhl.', 'That is not a chair.'), ('Das ist keine Lampe.', 'That is not a lamp.'),
                 ('Wir haben keinen Balkon.', "We don't have a balcony.")]},
         ],
         'rules': [('nicht + adjective', 'nicht klein, nicht teuer'), ('kein + noun', 'kein Stuhl, keine Lampe')],
         'quiz': {'title': 'nicht, kein or keine?', 'items': [
             gap('Die Küche ist ', 'nicht', ' klein.', ['nicht', 'kein', 'keine'], 'The kitchen is not small.'),
             gap('Das ist ', 'kein', ' Stuhl.', ['nicht', 'kein', 'keine'], 'That is not a chair.'),
             gap('Das Bett ist ', 'nicht', ' neu.', ['nicht', 'kein', 'keine'], 'The bed is not new.'),
             gap('Das ist ', 'keine', ' Lampe.', ['nicht', 'kein', 'keine'], 'That is not a lamp.'),
             gap('Die Wohnung ist ', 'nicht', ' teuer.', ['nicht', 'kein', 'keine'], 'The apartment is not expensive.'),
             gap('Das sind ', 'keine', ' Stühle.', ['nicht', 'kein', 'keine'], 'Those are not chairs.'),
             gap('Das Sofa ist ', 'nicht', ' schön.', ['nicht', 'kein', 'keine'], 'The sofa is not nice.'),
             gap('Das ist ', 'kein', ' Sofa.', ['nicht', 'kein', 'keine'], 'That is not a sofa.'),
             gap('Der Garten ist ', 'nicht', ' groß.', ['nicht', 'kein', 'keine'], 'The garden is not big.'),
         ]}},
        {'key': 'g4-it', 'code': 'G3', 'title': 'er, sie, es for things', 'chapters': ['4.5', '4.9'],
         'intro': ['In German, <strong>it</strong> depends on the gender of the noun: a der-noun becomes <em class="de">er</em>, a die-noun becomes <em class="de">sie</em>, a das-noun becomes <em class="de">es</em>. Plurals become <em class="de">sie</em> (they).'],
         'blocks': [
             {'step': 'The rule', 'title': 'Replace the noun', 'examples': [
                 ('Der Tisch ist neu. Er ist schön.', 'The table is new. It is nice.'), ('Die Lampe ist alt. Sie ist hässlich.', 'The lamp is old. It is ugly.'),
                 ('Das Bett ist groß. Es ist teuer.', 'The bed is big. It is expensive.'), ('Die Stühle sind neu. Sie sind billig.', 'The chairs are new. They are cheap.')]},
         ],
         'rules': [('der → er', 'der Tisch → er'), ('die → sie', 'die Lampe → sie'), ('das → es', 'das Bett → es'), ('plural → sie', 'die Stühle → sie')],
         'quiz': {'title': 'er, sie or es?', 'items': [
             gap('Der Tisch ist neu. ', 'Er', ' ist schön.', ['Er', 'Sie', 'Es'], 'The table is new. It is nice.'),
             gap('Die Lampe ist alt. ', 'Sie', ' ist hässlich.', ['Er', 'Sie', 'Es'], 'The lamp is old. It is ugly.'),
             gap('Das Bett ist groß. ', 'Es', ' ist teuer.', ['Er', 'Sie', 'Es'], 'The bed is big. It is expensive.'),
             gap('Die Stühle sind neu. ', 'Sie', ' sind billig.', ['Er', 'Sie', 'Es'], 'The chairs are new. They are cheap.'),
             gap('Der Garten ist klein. ', 'Er', ' ist schön.', ['Er', 'Sie', 'Es'], 'The garden is small. It is nice.'),
             gap('Die Küche ist hell. ', 'Sie', ' ist neu.', ['Er', 'Sie', 'Es'], 'The kitchen is bright. It is new.'),
             gap('Das Sofa ist rot. ', 'Es', ' ist gemütlich.', ['Er', 'Sie', 'Es'], 'The sofa is red. It is cosy.'),
             gap('Der Schrank ist braun. ', 'Er', ' ist alt.', ['Er', 'Sie', 'Es'], 'The wardrobe is brown. It is old.'),
             gap('Das Zimmer ist dunkel. ', 'Es', ' ist klein.', ['Er', 'Sie', 'Es'], 'The room is dark. It is small.'),
         ]}},
    ],
}

# ---------------------------------------------------------------- Unit 5
UNIT5 = {
    'id': 5,
    'title': 'Daily routine & time',
    'sections': [
        sec('5.1', 'My day', [
            ('die Uhr', "the clock / o'clock (f.)"), ('die Zähne', 'the teeth (pl.)'), ('die Arbeit', 'the work / the job (f.)'),
            ('arbeiten', 'to work'), ('aufräumen', 'to tidy up'), ('das Mittagessen', 'the lunch (n.)'), ('der Besuch', 'the visit / the visitors (m.)'),
            ('fernsehen', 'to watch TV'), ('trinken', 'to drink'), ('spielen', 'to play'), ('das Computerspiel', 'the computer game (n.)'),
            ('schlafen', 'to sleep'), ('Es ist 8 Uhr.', "It is 8 o'clock."), ('sich die Zähne putzen', "to brush one's teeth"),
            ('sich anziehen', 'to get dressed'), ('zur Arbeit fahren', 'to go to work (by car or bus)'), ('nach Hause kommen', 'to come home'),
            ('zu Besuch kommen', 'to come to visit'), ('schlafen gehen', 'to go to bed')]),
        sec('5.2', 'What time is it?', [
            ('Wie spät ist es?', 'What time is it?'), ('Wie viel Uhr ist es?', 'What time is it?'),
            ('Es ist neun Uhr.', "It is nine o'clock."), ('Es ist ein Uhr.', "It is one o'clock."), ('Es ist halb zwei.', 'It is half past one.')]),
        sec('5.3', 'Time words', [
            ('um', 'at (a time)'), ('von … bis', 'from … until'), ('vor', 'before / to (the hour)'), ('nach', 'after / past (the hour)'),
            ('um acht Uhr', "at eight o'clock"), ('von neun bis fünf', 'from nine until five')]),
        sec('5.5', 'Telling the time', [
            ('Es ist fünf nach neun.', 'It is five past nine. / 9:05'), ('Es ist Viertel nach neun.', 'It is quarter past nine. / 9:15'),
            ('Es ist fünf vor halb zehn.', 'It is 9:25 (five before half ten).'), ('Es ist halb zehn.', 'It is half past nine. / 9:30'),
            ('Es ist fünf nach halb zehn.', 'It is 9:35 (five after half ten).'), ('Es ist Viertel vor zehn.', 'It is quarter to ten. / 9:45'),
            ('Es ist fünf vor zehn.', 'It is five to ten. / 9:55')]),
        sec('5.6', 'Days of the week', [
            ('der Montag', 'Monday'), ('der Dienstag', 'Tuesday'), ('der Mittwoch', 'Wednesday'), ('der Donnerstag', 'Thursday'),
            ('der Freitag', 'Friday'), ('der Samstag', 'Saturday'), ('der Sonntag', 'Sunday'), ('am Montag', 'on Monday'),
            ('gestern', 'yesterday'), ('heute', 'today'), ('morgen', 'tomorrow'), ('Welcher Tag ist heute?', 'What day is it today?')]),
        sec('5.7', 'Separable verbs', [
            ('aufstehen', 'to get up'), ('anrufen', 'to call (on the phone)'), ('anziehen', 'to put on (clothes)'), ('einkaufen', 'to shop'),
            ('aufmachen', 'to open'), ('zumachen', 'to close'), ('Ich stehe um 7 Uhr auf.', "I get up at 7 o'clock.")]),
        sec('5.8', 'What do you like doing?', [
            ('Was machst du gerne?', 'What do you like doing?'), ('Was machst du nicht gerne?', "What don't you like doing?"),
            ('Kochst du gerne?', 'Do you like cooking?'), ('Kaufst du gerne ein?', 'Do you like shopping?'),
            ('Er spielt gerne Gitarre.', 'He likes playing the guitar.'), ('Ich mache nicht gerne Kuchen.', "I don't like making cakes.")]),
        sec('5.9', 'Months & seasons', [
            ('der Januar', 'January'), ('der Februar', 'February'), ('der März', 'March'), ('der April', 'April'), ('der Mai', 'May'),
            ('der Juni', 'June'), ('der Juli', 'July'), ('der August', 'August'), ('der September', 'September'), ('der Oktober', 'October'),
            ('der November', 'November'), ('der Dezember', 'December'), ('der Frühling', 'spring'), ('der Sommer', 'summer'),
            ('der Herbst', 'autumn / fall'), ('der Winter', 'winter'), ('die Monate', 'the months (pl.)'), ('die Jahreszeiten', 'the seasons (pl.)')]),
        sec('5.10', 'Making plans', [
            ('wollen', 'to want'), ('fragen', 'to ask'), ('die Zeit', 'the time (f.)'), ('der Geburtstag', 'the birthday (m.)'),
            ('beginnen', 'to begin / to start'), ('pünktlich', 'on time / punctual'), ('toll', 'great'), ('Zeit haben', 'to have time'),
            ('frei sein', 'to be free'), ('eine Party machen', 'to throw a party'), ('Sei pünktlich!', 'Be on time!'), ('Bis Samstag!', 'See you on Saturday!')]),
        sec('5.11', 'Verbs with a vowel change', [
            ('tragen', 'to wear / to carry (du trägst)'), ('waschen', 'to wash (du wäschst)'), ('fahren', 'to drive / to go (du fährst)'),
            ('fallen', 'to fall (du fällst)'), ('treten', 'to step / to kick (du trittst)'), ('geben', 'to give (du gibst)'),
            ('helfen', 'to help (du hilfst)'), ('lesen', 'to read (du liest)'), ('sehen', 'to see (du siehst)')]),
    ],
    'grammar': [
        {'key': 'g5-time', 'code': 'G1', 'title': 'Telling the time', 'chapters': ['5.2', '5.5'],
         'intro': ['Germans often say <strong>halb</strong> + the <em>next</em> hour: <em class="de">halb zehn</em> is 9:30 (half on the way to ten). Around half past you count from the half: <em class="de">fünf vor halb zehn</em> is 9:25.'],
         'blocks': [
             {'step': 'The clock', 'title': 'From 9:00 to 9:55',
              'table': {'head': ['Time', 'Everyday', 'Official'], 'rows': [
                  ['9:00', 'neun Uhr', 'neun Uhr'], ['9:05', 'fünf nach neun', 'neun Uhr fünf'], ['9:15', 'Viertel nach neun', 'neun Uhr fünfzehn'],
                  ['9:25', 'fünf vor halb zehn', 'neun Uhr fünfundzwanzig'], ['9:30', 'halb zehn', 'neun Uhr dreißig'],
                  ['9:35', 'fünf nach halb zehn', 'neun Uhr fünfunddreißig'], ['9:45', 'Viertel vor zehn', 'neun Uhr fünfundvierzig'],
                  ['9:55', 'fünf vor zehn', 'neun Uhr fünfundfünfzig']],
                  'say': ['neun Uhr', 'fünf nach neun', 'Viertel nach neun', 'fünf vor halb zehn', 'halb zehn', 'fünf nach halb zehn', 'Viertel vor zehn', 'fünf vor zehn'],
                  'highlight': 1}},
         ],
         'rules': [('halb + next hour', '9:30 = halb zehn'), ('vor / nach', 'to / past'), ('Viertel', 'quarter: Viertel nach, Viertel vor')],
         'quiz': {'title': 'What time is it?', 'items': [
             gap('9:30 → Es ist ', 'halb zehn', '.', ['halb neun', 'halb zehn', 'neun halb'], 'half past nine', why='halb + the NEXT hour.'),
             gap('9:15 → Es ist ', 'Viertel nach neun', '.', ['Viertel vor neun', 'Viertel nach neun', 'Viertel nach zehn'], 'quarter past nine'),
             gap('9:45 → Es ist ', 'Viertel vor zehn', '.', ['Viertel vor neun', 'Viertel nach zehn', 'Viertel vor zehn'], 'quarter to ten'),
             gap('9:05 → Es ist ', 'fünf nach neun', '.', ['fünf vor neun', 'fünf nach neun', 'fünf nach zehn'], 'five past nine'),
             gap('9:55 → Es ist ', 'fünf vor zehn', '.', ['fünf vor zehn', 'fünf nach zehn', 'fünf vor neun'], 'five to ten'),
             gap('9:25 → Es ist ', 'fünf vor halb zehn', '.', ['fünf nach halb zehn', 'fünf vor halb zehn', 'fünf vor halb neun'], 'twenty-five past nine'),
             gap('1:30 → Es ist ', 'halb zwei', '.', ['halb eins', 'halb zwei', 'eins halb'], 'half past one', why='halb + the NEXT hour: halb zwei.'),
             gap('9:35 → Es ist ', 'fünf nach halb zehn', '.', ['fünf nach halb zehn', 'fünf vor halb zehn', 'fünf nach neun'], 'twenty-five to ten'),
             gap('7:00 → Es ist ', 'sieben Uhr', '.', ['sieben Uhr', 'Uhr sieben', 'halb sieben'], "seven o'clock"),
         ]}},
        {'key': 'g5-word-order', 'code': 'G2', 'title': 'The verb in second place', 'chapters': ['5.1', '5.3'],
         'intro': ['In a German statement the <strong>verb is always in second place</strong>. The first place can be the subject or something else, such as a time.'],
         'blocks': [
             {'step': 'The rule', 'title': 'Position 1 · verb · the rest', 'examples': [
                 ('Ich arbeite von 8 bis 2 Uhr.', 'I work from 8 to 2.'), ('Um 8 Uhr geht er zur Arbeit.', 'At 8 he goes to work.'),
                 ('Heute koche ich.', 'Today I am cooking.'), ('Am Montag spiele ich Fußball.', 'On Monday I play football.')]},
         ],
         'rules': [('Verb = position 2', 'always, in statements'), ('Time first?', 'then the subject comes after the verb: Heute koche ich.')],
         'quiz': {'title': 'Which sentence is correct?', 'items': [
             choose('At 8 he goes to work.', 'Um 8 Uhr geht er zur Arbeit.', ['Um 8 Uhr er geht zur Arbeit.', 'Um 8 Uhr geht er zur Arbeit.', 'Um 8 Uhr zur Arbeit er geht.']),
             choose('Today I am cooking.', 'Heute koche ich.', ['Heute ich koche.', 'Heute koche ich.', 'Koche heute ich.']),
             choose('On Monday I play football.', 'Am Montag spiele ich Fußball.', ['Am Montag spiele ich Fußball.', 'Am Montag ich spiele Fußball.', 'Ich am Montag spiele Fußball.']),
             choose('In the evening we watch TV.', 'Am Abend sehen wir fern.', ['Am Abend wir sehen fern.', 'Am Abend sehen wir fern.', 'Wir am Abend sehen fern.']),
             choose('Tomorrow she works.', 'Morgen arbeitet sie.', ['Morgen sie arbeitet.', 'Morgen arbeitet sie.', 'Sie morgen arbeitet.']),
             choose('I work from 8 to 2.', 'Ich arbeite von 8 bis 2 Uhr.', ['Ich arbeite von 8 bis 2 Uhr.', 'Ich von 8 bis 2 Uhr arbeite.', 'Arbeite ich von 8 bis 2 Uhr.']),
             choose('At noon we eat lunch.', 'Um 12 Uhr essen wir Mittagessen.', ['Um 12 Uhr wir essen Mittagessen.', 'Um 12 Uhr essen wir Mittagessen.', 'Wir um 12 Uhr essen Mittagessen.']),
             choose('Today I have time.', 'Heute habe ich Zeit.', ['Heute habe ich Zeit.', 'Heute ich habe Zeit.', 'Ich heute habe Zeit.']),
         ]}},
        {'key': 'g5-separable', 'code': 'G3', 'title': 'Separable verbs', 'chapters': ['5.7'],
         'intro': ['Some verbs have a prefix that <strong>splits off</strong> in the present tense. The main part is conjugated in second place, and the prefix goes to the <strong>end of the sentence</strong>.'],
         'blocks': [
             {'step': 'The forms', 'title': 'aufstehen (to get up)',
              'table': {'head': ['Person', 'Form'], 'rows': [['ich', 'stehe … auf'], ['du', 'stehst … auf'], ['er / sie / es', 'steht … auf'],
                                                          ['wir', 'stehen … auf'], ['ihr', 'steht … auf'], ['sie / Sie', 'stehen … auf']],
                        'say': ['ich stehe auf', 'du stehst auf', 'er steht auf', 'wir stehen auf', 'ihr steht auf', 'sie stehen auf'], 'highlight': 1}},
             {'title': 'In sentences', 'examples': [
                 ('Ich stehe jeden Tag um 8 Uhr auf.', 'I get up at 8 every day.'), ('Er ruft seine Mutter an.', 'He calls his mother.'),
                 ('Wir kaufen am Samstag ein.', 'We go shopping on Saturday.'), ('Machst du das Fenster auf?', 'Are you opening the window?')]},
         ],
         'rules': [('verb in position 2', 'Ich stehe …'), ('prefix at the end', '… um 8 Uhr auf.'), ('Examples', 'aufstehen, anrufen, einkaufen, fernsehen, aufmachen')],
         'quiz': {'title': 'Which sentence is correct?', 'items': [
             choose('aufstehen · ich · um 7 Uhr', 'Ich stehe um 7 Uhr auf.', ['Ich aufstehe um 7 Uhr.', 'Ich stehe um 7 Uhr auf.', 'Ich stehe auf um 7 Uhr.'], 'I get up at 7.'),
             choose('anrufen · er · seine Mutter', 'Er ruft seine Mutter an.', ['Er anruft seine Mutter.', 'Er ruft an seine Mutter.', 'Er ruft seine Mutter an.'], 'He calls his mother.'),
             choose('einkaufen · wir · am Samstag', 'Wir kaufen am Samstag ein.', ['Wir kaufen am Samstag ein.', 'Wir einkaufen am Samstag.', 'Wir kaufen ein am Samstag.'], 'We go shopping on Saturday.'),
             choose('fernsehen · du · am Abend', 'Du siehst am Abend fern.', ['Du fernsiehst am Abend.', 'Du siehst am Abend fern.', 'Du fernsehen am Abend.'], 'You watch TV in the evening.'),
             choose('aufmachen · sie · das Fenster', 'Sie macht das Fenster auf.', ['Sie aufmacht das Fenster.', 'Sie macht das Fenster auf.', 'Sie macht auf das Fenster.'], 'She opens the window.'),
             choose('aufräumen · ihr · das Zimmer', 'Ihr räumt das Zimmer auf.', ['Ihr räumt das Zimmer auf.', 'Ihr aufräumt das Zimmer.', 'Ihr räumt auf das Zimmer.'], 'You (all) tidy the room.'),
             choose('zumachen · ich · die Tür', 'Ich mache die Tür zu.', ['Ich zumache die Tür.', 'Ich mache die Tür zu.', 'Ich mache zu die Tür.'], 'I close the door.'),
             choose('anziehen · er · die Jacke', 'Er zieht die Jacke an.', ['Er zieht die Jacke an.', 'Er anzieht die Jacke.', 'Er zieht an die Jacke.'], 'He puts on the jacket.'),
         ]}},
        {'key': 'g5-vowel', 'code': 'G4', 'title': 'Verbs that change a → ä', 'chapters': ['5.11'],
         'intro': ['Some verbs change <strong>a → ä</strong> in the du and er/sie/es forms. All the other forms stay regular.'],
         'blocks': [
             {'step': 'The forms', 'title': 'schlafen, fahren, waschen',
              'table': {'head': ['Person', 'schlafen', 'fahren', 'waschen'], 'rows': [
                  ['ich', 'schlafe', 'fahre', 'wasche'], ['du', 'schläfst', 'fährst', 'wäschst'], ['er / sie / es', 'schläft', 'fährt', 'wäscht'],
                  ['wir', 'schlafen', 'fahren', 'waschen'], ['ihr', 'schlaft', 'fahrt', 'wascht'], ['sie / Sie', 'schlafen', 'fahren', 'waschen']],
                  'say': ['ich schlafe', 'du schläfst', 'er schläft', 'wir schlafen', 'ihr schlaft', 'sie schlafen'], 'highlight': 1}},
         ],
         'rules': [('a → ä', 'only du and er/sie/es'), ('du fährst', 'er fährt'), ('ihr fahrt', 'no umlaut for ihr')],
         'quiz': {'title': 'Choose the right form', 'items': [
             gap('Du ', 'fährst', ' zur Arbeit.', ['fahrst', 'fährst', 'fährt', 'fahrt'], 'You drive to work.'),
             gap('Er ', 'schläft', ' bis 9 Uhr.', ['schlaft', 'schläft', 'schlafst', 'schlafen'], 'He sleeps until 9.'),
             gap('Wir ', 'fahren', ' nach Hause.', ['fahren', 'fähren', 'fahrt', 'fährt'], 'We go home.'),
             gap('Sie ', 'wäscht', ' die Wäsche.', ['wascht', 'wäscht', 'wäschst', 'waschen'], 'She does the washing.'),
             gap('Ihr ', 'schlaft', ' lange.', ['schläft', 'schlaft', 'schlafen', 'schläfst'], 'You (all) sleep for a long time.', why='ihr has no umlaut.'),
             gap('Ich ', 'fahre', ' mit dem Bus.', ['fahre', 'fähre', 'fährt', 'fahrst'], 'I go by bus.'),
             gap('', 'Schläfst', ' du gut?', ['Schlafst', 'Schläfst', 'Schläft', 'Schlaft'], 'Do you sleep well?'),
             gap('Mein Vater ', 'fährt', ' ein Auto.', ['fahrt', 'fährt', 'fährst', 'fahren'], 'My father drives a car.'),
         ]}},
    ],
}

# ---------------------------------------------------------------- Unit 6
UNIT6 = {
    'id': 6,
    'title': 'Weather, holidays & hobbies',
    'sections': [
        sec('6.1', 'The weather', [
            ('das Wetter', 'the weather (n.)'), ('der Regen', 'the rain (m.)'), ('der Schnee', 'the snow (m.)'), ('die Sonne', 'the sun (f.)'),
            ('warm', 'warm'), ('heiß', 'hot'), ('kalt', 'cold'), ('es regnet', "it's raining"), ('es schneit', "it's snowing"),
            ('die Sonne scheint', 'the sun is shining'), ('es ist sonnig', "it's sunny"), ('Wie ist das Wetter?', 'What is the weather like?'),
            ('Es ist 20 Grad.', "It's 20 degrees.")]),
        sec('6.2', 'More weather & directions', [
            ('die Wolke', 'the cloud (f.)'), ('wolkig', 'cloudy'), ('der Wind', 'the wind (m.)'), ('windig', 'windy'),
            ('der Nebel', 'the fog (m.)'), ('das Eis', 'the ice (n.)'), ('das Gewitter', 'the thunderstorm (n.)'),
            ('die Temperatur', 'the temperature (f.)'), ('das Grad', 'the degree (n.)'), ('der Norden', 'the north'),
            ('der Süden', 'the south'), ('der Osten', 'the east'), ('der Westen', 'the west')]),
        sec('6.3', 'Holidays', [
            ('der Urlaub', 'the holiday / the vacation (m.)'), ('gemütlich', 'cosy'), ('das Zelt', 'the tent (n.)'), ('das Meer', 'the sea (n.)'),
            ('die Küste', 'the coast (f.)'), ('schwimmen', 'to swim'), ('schnorcheln', 'to snorkel'), ('tauchen', 'to dive'),
            ('das Skifahren', 'skiing (n.)'), ('das Schlittschuhlaufen', 'ice skating (n.)'), ('die Natur', 'nature (f.)'),
            ('wandern', 'to hike'), ('Urlaub machen', 'to go on holiday')]),
        sec('6.4', 'Hobbies', [
            ('lesen', 'to read'), ('tanzen', 'to dance'), ('reisen', 'to travel'), ('kochen', 'to cook'), ('joggen', 'to jog'),
            ('malen', 'to paint'), ('die Fotografie', 'photography (f.)'), ('Fahrrad fahren', 'to ride a bike'),
            ('Freunde treffen', 'to meet friends'), ('Computerspiele spielen', 'to play computer games'), ('Musik hören', 'to listen to music'),
            ('Musik machen', 'to make music'), ('Fußball spielen', 'to play football'), ('Basketball spielen', 'to play basketball'),
            ('Handball spielen', 'to play handball'), ('Was sind deine Hobbys?', 'What are your hobbies? (informal)'),
            ('Was sind Ihre Hobbys?', 'What are your hobbies? (formal)'),
            ('Was machst du in deiner Freizeit?', 'What do you do in your free time? (informal)'),
            ('Was machen Sie in Ihrer Freizeit?', 'What do you do in your free time? (formal)')]),
        sec('6.5', 'What do you need?', [
            ('der Jogginganzug', 'the tracksuit (m.)'), ('die Tennisschuhe', 'the trainers / the tennis shoes (pl.)'),
            ('das Fahrrad', 'the bicycle (n.)'), ('der Helm', 'the helmet (m.)'), ('das Schwimmbad', 'the swimming pool (n.)'),
            ('die Badehose', 'the swimming trunks (f.)'), ('der Badeanzug', 'the swimsuit (m.)'), ('die Jacke', 'the jacket (f.)'),
            ('die Mütze', 'the hat / the cap (f.)'), ('brauchen', 'to need'), ('mitnehmen', 'to take along')]),
        sec('6.8', 'Favourites', [
            ('der Lieblingsfilm', 'the favourite film (m.)'), ('das Lieblingsbuch', 'the favourite book (n.)'),
            ('die Lieblingsmusik', 'the favourite music (f.)'), ('das Lieblingslied', 'the favourite song (n.)'),
            ('das Lieblingsessen', 'the favourite food (n.)'), ('das Lieblingsgetränk', 'the favourite drink (n.)'),
            ('die Lieblingsfarbe', 'the favourite colour (f.)')]),
        sec('6.9', 'Opinions', [
            ('Wie findest du …?', 'What do you think of …?'), ('Ich finde es …', 'I find it …'),
            ('Ich finde ihn …', 'I find him / it (der-noun) …'), ('Ich finde sie …', 'I find her / it (die-noun) …')]),
        sec('6.10', 'Describing things', [
            ('kompliziert', 'complicated'), ('einfach', 'easy / simple'), ('schwer', 'difficult / heavy'), ('leicht', 'easy / light'),
            ('interessant', 'interesting'), ('spannend', 'exciting'), ('langweilig', 'boring'), ('gemütlich', 'cosy'),
            ('praktisch', 'practical'), ('freundlich', 'friendly'), ('nett', 'nice / kind'), ('zu', 'too (zu teuer = too expensive)')]),
        sec('6.11', 'Agreeing & disagreeing', [
            ('Stimmt das?', 'Is that right?'), ('Ist das richtig?', 'Is that correct?'), ('Was denkst du?', 'What do you think?'),
            ('Denkst du, wir sollen …?', 'Do you think we should …?'), ('Das stimmt.', "That's right."), ('Das stimmt nicht.', "That's not right."),
            ('Das ist richtig.', "That's correct."), ('Das ist nicht richtig.', "That's not correct."), ('Natürlich.', 'Of course.'),
            ('Genau.', 'Exactly.'), ('Nein, leider nicht.', 'No, unfortunately not.'), ('Ich denke …', 'I think …'),
            ('Unsinn!', 'Nonsense!'), ('Quatsch!', 'Rubbish!')]),
    ],
    'grammar': [
        {'key': 'g6-accusative', 'code': 'G1', 'title': 'The accusative case', 'chapters': ['6.5', '6.9'],
         'intro': ['The <strong>direct object</strong> of a sentence (the person or thing the action is done to) is in the <strong>accusative</strong>.',
                   'Only <strong>masculine</strong> articles change: der → den, ein → einen, kein → keinen. Feminine, neuter and plural stay the same.'],
         'blocks': [
             {'step': 'The table', 'title': 'Articles in the accusative',
              'table': {'head': ['', 'masculine', 'feminine', 'neuter', 'plural'], 'rows': [
                  ['the', 'den Helm', 'die Jacke', 'das Zelt', 'die Schuhe'], ['a', 'einen Helm', 'eine Jacke', 'ein Zelt', '— Schuhe'],
                  ['no', 'keinen Helm', 'keine Jacke', 'kein Zelt', 'keine Schuhe']],
                  'say': ['den Helm', 'einen Helm', 'keinen Helm'], 'highlight': 1}},
             {'title': 'Verbs with the accusative', 'examples': [
                 ('Ich habe einen Bruder.', 'I have a brother.'), ('Wir kaufen einen Tisch.', 'We are buying a table.'),
                 ('Ich brauche den Helm.', 'I need the helmet.'), ('Nimm einen Badeanzug mit!', 'Take a swimsuit with you!'),
                 ('Wir besuchen den Onkel.', 'We are visiting the uncle.')]},
         ],
         'rules': [('der → den', 'ein → einen, kein → keinen'), ('die, das, plural', 'no change'),
                   ('Typical verbs', 'haben, kaufen, brauchen, mitnehmen, besuchen, finden')],
         'quiz': {'title': 'Choose the right article', 'items': [
             gap('Ich brauche ', 'einen', ' Helm.', ['ein', 'einen', 'eine'], 'I need a helmet.', why='der Helm is masculine: einen.'),
             gap('Hast du ', 'ein', ' Fahrrad?', ['ein', 'einen', 'eine'], 'Do you have a bike?', why='das Fahrrad is neuter: no change.'),
             gap('Ich kaufe ', 'eine', ' Jacke.', ['ein', 'einen', 'eine'], 'I am buying a jacket.', why='die Jacke is feminine: no change.'),
             gap('Ich habe ', 'keinen', ' Badeanzug.', ['kein', 'keinen', 'keine'], "I don't have a swimsuit.", why='der Badeanzug is masculine: keinen.'),
             gap('Wir nehmen ', 'das', ' Zelt mit.', ['der', 'den', 'das'], 'We are taking the tent.', why='das Zelt is neuter: no change.'),
             gap('Ich finde ', 'den', ' Film spannend.', ['der', 'den', 'die'], 'I find the film exciting.', why='der Film is masculine: den.'),
             gap('Er braucht ', 'keine', ' Mütze.', ['kein', 'keinen', 'keine'], "He doesn't need a hat.", why='die Mütze is feminine: no change.'),
             gap('Hast du ', 'einen', ' Garten?', ['ein', 'einen', 'eine'], 'Do you have a garden?', why='der Garten is masculine: einen.'),
             gap('Wir besuchen ', 'den', ' Onkel.', ['der', 'den', 'dem'], 'We are visiting the uncle.', why='der Onkel is masculine: den.'),
             gap('Ich kaufe ', 'die', ' Tennisschuhe.', ['der', 'den', 'die'], 'I am buying the tennis shoes.', why='Plural: no change.'),
         ]}},
    ],
}

# ---------------------------------------------------------------- Unit 7
JOBS = [
    ('der Lehrer', 'the teacher (m.)'), ('die Lehrerin', 'the teacher (f.)'), ('der Ingenieur', 'the engineer (m.)'),
    ('die Ingenieurin', 'the engineer (f.)'), ('der Verkäufer', 'the sales assistant (m.)'), ('die Verkäuferin', 'the sales assistant (f.)'),
    ('der Kellner', 'the waiter'), ('die Kellnerin', 'the waitress'), ('der Programmierer', 'the programmer (m.)'),
    ('die Programmiererin', 'the programmer (f.)'), ('der Polizist', 'the police officer (m.)'), ('die Polizistin', 'the police officer (f.)'),
    ('der Elektriker', 'the electrician (m.)'), ('die Elektrikerin', 'the electrician (f.)'), ('der Journalist', 'the journalist (m.)'),
    ('die Journalistin', 'the journalist (f.)'), ('der Mechaniker', 'the mechanic (m.)'), ('die Mechanikerin', 'the mechanic (f.)'),
    ('der Arzt', 'the doctor (m.)'), ('die Ärztin', 'the doctor (f.)'), ('der Krankenpfleger', 'the nurse (m.)'),
    ('die Krankenschwester', 'the nurse (f.)'), ('der Tierarzt', 'the vet (m.)'), ('die Tierärztin', 'the vet (f.)'),
    ('der Zahnarzt', 'the dentist (m.)'), ('die Zahnärztin', 'the dentist (f.)'), ('der Geschäftsmann', 'the businessman'),
    ('die Geschäftsfrau', 'the businesswoman'), ('der Anwalt', 'the lawyer (m.)'), ('die Anwältin', 'the lawyer (f.)'),
    ('der Friseur', 'the hairdresser (m.)'), ('die Friseurin', 'the hairdresser (f.)'), ('der Koch', 'the cook / the chef (m.)'),
    ('die Köchin', 'the cook / the chef (f.)'), ('Was bist du von Beruf?', 'What do you do for a living?'),
    ('Ich bin Lehrerin von Beruf.', 'I am a teacher by profession.'),
]


UNIT7 = {
    'id': 7,
    'title': 'Jobs & abilities',
    'sections': [
        sec('7.1', 'Jobs', JOBS),
        sec('7.2', 'What can you do?', [
            ('Was kannst du gut machen?', 'What are you good at?'), ('Was kannst du nicht gut machen?', 'What are you not good at?'),
            ('Sie kann sehr gut tanzen.', 'She can dance very well.'), ('Er kann gar nicht kochen.', "He can't cook at all."),
            ('Skateboard fahren', 'to skateboard'), ('malen', 'to paint'), ('Ski laufen', 'to ski'), ('Gitarre spielen', 'to play the guitar')]),
        sec('7.3', 'können (can)', [
            ('können', 'can / to be able to'), ('ich kann', 'I can'), ('du kannst', 'you can'), ('sie kann', 'she can'),
            ('wir können', 'we can'), ('ihr könnt', 'you (all) can'), ('sie können', 'they can')]),
        sec('7.4', 'müssen, dürfen, sollen', [
            ('müssen', 'must / to have to'), ('ich muss', 'I must'), ('du musst', 'you must'), ('es muss', 'it must'),
            ('wir müssen', 'we must'), ('ihr müsst', 'you (all) must'), ('sie müssen', 'they must'),
            ('dürfen', 'may / to be allowed to'), ('ich darf', 'I may'), ('du darfst', 'you may'), ('er darf', 'he may'),
            ('wir dürfen', 'we may'), ('ihr dürft', 'you (all) may'), ('sie dürfen', 'they may'),
            ('sollen', 'should / to be supposed to'), ('ich soll', 'I should'), ('du sollst', 'you should'), ('es soll', 'it should'),
            ('wir sollen', 'we should'), ('ihr sollt', 'you (all) should'), ('sie sollen', 'they should')]),
        sec('7.5', 'wollen & möchten', [
            ('wollen', 'to want'), ('ich will', 'I want'), ('du willst', 'you want'), ('er will', 'he wants'),
            ('wir wollen', 'we want'), ('ihr wollt', 'you (all) want'), ('sie wollen', 'they want'),
            ('möchten', 'would like'), ('ich möchte', 'I would like'), ('du möchtest', 'you would like'), ('sie möchte', 'she would like'),
            ('wir möchten', 'we would like'), ('ihr möchtet', 'you (all) would like'), ('sie möchten', 'they would like')]),
        sec('7.6', 'Learning German', [
            ('gut', 'good / well'), ('besser', 'better'), ('am besten', 'best'), ('verbessern', 'to improve'),
            ('verschieden', 'different / various'), ('auswählen', 'to choose / to select'), ('verbringen', 'to spend (time)'),
            ('vielleicht', 'maybe / perhaps'), ('das Vokabular', 'the vocabulary (n.)'), ('das Hörverstehen', 'listening comprehension (n.)'),
            ('die Aussprache', 'the pronunciation (f.)'), ('der Gesprächspartner', 'the conversation partner (m.)')]),
        sec('7.7', 'Writing an email', [
            ('der Betreff', 'the subject (m.)'), ('der Empfänger', 'the recipient (m.)'), ('der Absender', 'the sender (m.)'),
            ('der Anhang', 'the attachment (m.)'), ('senden', 'to send'), ('löschen', 'to delete'), ('schreiben', 'to write'),
            ('Sehr geehrte Frau Müller', 'Dear Ms Müller (formal)'), ('Sehr geehrter Herr Müller', 'Dear Mr Müller (formal)'),
            ('Sehr geehrte Damen und Herren', 'Dear Sir or Madam'), ('Liebe Anna, lieber Tom', 'Dear Anna, dear Tom (informal)'),
            ('Mit freundlichen Grüßen', 'Kind regards'), ('Viele Grüße', 'Best wishes'), ('Liebe Grüße', 'Love / warm wishes'),
            ('Alles Gute', 'All the best')]),
        sec('7.8', 'Years & dates of birth', [
            ('Wann bist du geboren?', 'When were you born?'), ('Wann ist er gestorben?', 'When did he die?'),
            ('neunzehnhundertneunundneunzig', '1999'), ('zweitausendeins', '2001'), ('achtzehnhundertachtundvierzig', '1848')]),
        sec('7.9', 'The perfect with haben', [
            ('hat gegessen', 'has eaten / ate'), ('hat gefunden', 'has found / found'), ('hat geholfen', 'has helped / helped'),
            ('hat genommen', 'has taken / took'), ('hat geschrieben', 'has written / wrote'), ('hat gesprochen', 'has spoken / spoke'),
            ('hat getroffen', 'has met / met'), ('hat getrunken', 'has drunk / drank')]),
        sec('7.10', 'The perfect with sein', [
            ('ist gekommen', 'has come / came'), ('ist gegangen', 'has gone / went'), ('ist gefahren', 'has driven / drove'),
            ('ist gereist', 'has travelled / travelled'), ('ist geblieben', 'has stayed / stayed')]),
    ],
    'grammar': [
        {'key': 'g7-modals', 'code': 'G1', 'title': 'Modal verbs', 'chapters': ['7.2', '7.3', '7.4', '7.5'],
         'intro': ['Modal verbs (können, müssen, dürfen, sollen, wollen, möchten) change the meaning of another verb. The <strong>modal is in second place</strong>, and the <strong>other verb goes to the end</strong> in the infinitive.',
                   'Note: ich and er/sie/es have the <strong>same form</strong>, with no ending: ich kann, er kann.'],
         'blocks': [
             {'step': 'The forms', 'title': 'Modal verbs in the present tense',
              'table': {'head': ['', 'können', 'müssen', 'dürfen', 'sollen', 'wollen', 'möchten'], 'rows': [
                  ['ich', 'kann', 'muss', 'darf', 'soll', 'will', 'möchte'], ['du', 'kannst', 'musst', 'darfst', 'sollst', 'willst', 'möchtest'],
                  ['er / sie / es', 'kann', 'muss', 'darf', 'soll', 'will', 'möchte'], ['wir', 'können', 'müssen', 'dürfen', 'sollen', 'wollen', 'möchten'],
                  ['ihr', 'könnt', 'müsst', 'dürft', 'sollt', 'wollt', 'möchtet'], ['sie / Sie', 'können', 'müssen', 'dürfen', 'sollen', 'wollen', 'möchten']],
                  'say': ['ich kann', 'du kannst', 'er kann', 'wir können', 'ihr könnt', 'sie können']}},
             {'title': 'In sentences', 'examples': [
                 ('Ich kann gut tanzen.', 'I can dance well.'), ('Du musst heute arbeiten.', 'You have to work today.'),
                 ('Wir dürfen hier schwimmen.', 'We are allowed to swim here.'), ('Er will Deutsch lernen.', 'He wants to learn German.'),
                 ('Ich möchte einen Kaffee.', 'I would like a coffee.')]},
         ],
         'rules': [('modal = position 2', 'Ich kann …'), ('infinitive at the end', '… gut tanzen.'), ('ich = er/sie/es', 'kann, muss, darf, soll, will, möchte')],
         'quiz': {'title': 'Choose the right form', 'items': [
             gap('Ich ', 'kann', ' gut tanzen.', ['kann', 'kannst', 'können', 'könnt'], 'I can dance well. (können)'),
             gap('Du ', 'musst', ' heute arbeiten.', ['muss', 'musst', 'müssen', 'müsst'], 'You have to work today. (müssen)'),
             gap('Wir ', 'dürfen', ' hier schwimmen.', ['darf', 'darfst', 'dürfen', 'dürft'], 'We are allowed to swim here. (dürfen)'),
             gap('Er ', 'will', ' Deutsch lernen.', ['will', 'willst', 'wollen', 'wollt'], 'He wants to learn German. (wollen)'),
             gap('', 'Möchtest', ' du einen Kaffee?', ['Möchte', 'Möchtest', 'Möchten', 'Möchtet'], 'Would you like a coffee? (möchten)'),
             gap('Ihr ', 'sollt', ' pünktlich sein.', ['soll', 'sollst', 'sollen', 'sollt'], 'You (all) should be on time. (sollen)'),
             gap('Sie ', 'kann', ' sehr gut kochen.', ['kann', 'kannst', 'können', 'könnt'], 'She can cook very well. (können)', why='er/sie/es has no ending: kann.'),
             gap('Ihr ', 'müsst', ' viel lernen.', ['muss', 'musst', 'müssen', 'müsst'], 'You (all) have to study a lot. (müssen)'),
             gap('Ich ', 'möchte', ' ein Glas Wasser.', ['möchte', 'möchtest', 'möchten', 'möchtet'], 'I would like a glass of water. (möchten)'),
             gap('Du ', 'darfst', ' jetzt nicht fernsehen.', ['darf', 'darfst', 'dürfen', 'dürft'], "You aren't allowed to watch TV now. (dürfen)"),
         ]}},
        {'key': 'g7-perfect', 'code': 'G2', 'title': 'The perfect tense', 'chapters': ['7.9', '7.10'],
         'intro': ['The <strong>perfect</strong> is the usual way to talk about the past in spoken German. It has two parts: <strong>haben or sein</strong> in second place, and the <strong>participle</strong> (ge- … -t / -en) at the end.'],
         'blocks': [
             {'step': 'haben or sein?', 'title': 'Most verbs use haben', 'examples': [
                 ('Ich habe Kaffee getrunken.', 'I drank coffee.'), ('Wir haben Pizza gegessen.', 'We ate pizza.'),
                 ('Er hat mir geholfen.', 'He helped me.'), ('Du hast einen Brief geschrieben.', 'You wrote a letter.')]},
             {'title': 'Movement or change: sein', 'examples': [
                 ('Er ist nach Berlin gefahren.', 'He drove to Berlin.'), ('Sie ist nach Hause gekommen.', 'She came home.'),
                 ('Ich bin ins Kino gegangen.', 'I went to the cinema.'), ('Ich bin zu Hause geblieben.', 'I stayed at home.')]},
             {'title': 'The participle', 'table': {'head': ['Verb', 'Participle'], 'rows': [
                 ['machen (regular)', 'gemacht'], ['kaufen (regular)', 'gekauft'], ['trinken', 'getrunken'], ['kommen', 'gekommen'], ['gehen', 'gegangen']],
                 'say': ['gemacht', 'gekauft', 'getrunken', 'gekommen', 'gegangen'], 'highlight': 1}},
         ],
         'rules': [('haben / sein = position 2', 'Ich habe …'), ('participle at the end', '… getrunken.'), ('sein', 'kommen, gehen, fahren, reisen, bleiben, aufstehen')],
         'quiz': {'title': 'haben or sein?', 'items': [
             gap('Ich ', 'habe', ' Kaffee getrunken.', ['habe', 'bin'], 'I drank coffee.'),
             gap('Er ', 'ist', ' nach Berlin gefahren.', ['hat', 'ist'], 'He drove to Berlin.', why='fahren is movement: sein.'),
             gap('Wir ', 'haben', ' Pizza gegessen.', ['haben', 'sind'], 'We ate pizza.'),
             gap('Sie ', 'ist', ' nach Hause gekommen.', ['hat', 'ist'], 'She came home.', why='kommen is movement: sein.'),
             gap('Du ', 'hast', ' einen Brief geschrieben.', ['hast', 'bist'], 'You wrote a letter.'),
             gap('Ich ', 'bin', ' zu Hause geblieben.', ['habe', 'bin'], 'I stayed at home.', why='bleiben uses sein.'),
             gap('Ihr ', 'habt', ' Deutsch gesprochen.', ['habt', 'seid'], 'You (all) spoke German.'),
             gap('Wir ', 'sind', ' nach Spanien gereist.', ['haben', 'sind'], 'We travelled to Spain.', why='reisen is movement: sein.'),
             gap('Er ', 'hat', ' mir geholfen.', ['hat', 'ist'], 'He helped me.'),
             gap('Ich ', 'bin', ' ins Kino gegangen.', ['habe', 'bin'], 'I went to the cinema.', why='gehen is movement: sein.'),
         ]}},
        {'key': 'g7-years', 'code': 'G3', 'title': 'Saying years', 'chapters': ['7.8'],
         'intro': ['Years before 2000 are read in two halves with <strong>hundert</strong> in between: 1999 = <em class="de">neunzehnhundertneunundneunzig</em>. From 2000 on, say them like normal numbers: 2001 = <em class="de">zweitausendeins</em>.',
                   'You say <em class="de">Ich bin 1990 geboren</em> or <em class="de">im Jahr 1990</em> — never “in 1990”.'],
         'blocks': [
             {'step': 'Examples', 'title': 'How to read years', 'table': {'head': ['Year', 'Said as'], 'rows': [
                 ['1848', 'achtzehnhundertachtundvierzig'], ['1999', 'neunzehnhundertneunundneunzig'], ['1990', 'neunzehnhundertneunzig'],
                 ['2001', 'zweitausendeins'], ['2024', 'zweitausendvierundzwanzig']],
                 'say': ['achtzehnhundertachtundvierzig', 'neunzehnhundertneunundneunzig', 'neunzehnhundertneunzig', 'zweitausendeins', 'zweitausendvierundzwanzig'], 'highlight': 1}},
         ],
         'rules': [('before 2000', 'neunzehnhundert…'), ('from 2000', 'zweitausend…'), ('no “in”', 'Ich bin 1990 geboren.')],
         'quiz': {'title': 'How do you say it?', 'items': [
             gap('1999 → ', 'neunzehnhundertneunundneunzig', '', ['neunzehnhundertneunundneunzig', 'eintausendneunhundertneunundneunzig', 'neunzehnneunundneunzig'], '1999'),
             gap('2001 → ', 'zweitausendeins', '', ['zwanzighunderteins', 'zweitausendeins', 'zweitausendhunderteins'], '2001'),
             gap('1848 → ', 'achtzehnhundertachtundvierzig', '', ['achtzehnhundertachtundvierzig', 'achtzehnhundertvierundachtzig', 'tausendachthundertachtundvierzig'], '1848'),
             gap('1990 → ', 'neunzehnhundertneunzig', '', ['neunzehnhundertneunzig', 'neunzehnhundertneunzehn', 'neunhundertneunzig'], '1990'),
             gap('2024 → ', 'zweitausendvierundzwanzig', '', ['zwanzigvierundzwanzig', 'zweitausendvierundzwanzig', 'zweitausendzweiundvierzig'], '2024'),
             gap('Ich bin ', '1995', ' geboren.', ['1995', 'in 1995', 'im 1995'], 'I was born in 1995.', say='Ich bin neunzehnhundertfünfundneunzig geboren.', why='No preposition before a year.'),
             gap('1975 → ', 'neunzehnhundertfünfundsiebzig', '', ['neunzehnhundertfünfundsiebzig', 'neunzehnhundertsiebenundfünfzig', 'neunzehnfünfundsiebzig'], '1975'),
             gap('2010 → ', 'zweitausendzehn', '', ['zwanzigzehn', 'zweitausendzehn', 'zweitausendhundertzehn'], '2010'),
         ]}},
    ],
}


# ================================================================ Extended A1.1 syllabus
# More sections, lessons and exercise types for every unit, plus Units 8 and 9 (travel; the past).
# All texts and example sentences are written for this course.

# Names and places keep their capital letter when they start a sentence-building exercise.
NAMES = {'Selam', 'Dawit', 'Hanna', 'Yonas', 'Meron', 'Abebe', 'Tigist', 'Samuel', 'Liya', 'Kaleb', 'Almaz',
         'Lena', 'Jonas', 'Anna', 'Herr', 'Frau', 'Sie', 'Deutschland', 'Äthiopien', 'Addis', 'Berlin',
         'Frankfurt', 'Hamburg', 'Leipzig'}


def pick(prompt, answer, options, say=None, hint='', why=''):
    """Multiple choice; `say` (default: the answer) is played after answering."""
    return {'type': 'choose', 'prompt': prompt, 'answer': answer, 'options': options, 'hint': hint,
            'say': answer if say is None else say, 'why': why}


def tf(statement, true, why=''):
    """Reading comprehension: richtig (true) or falsch (false)?"""
    answer = 'richtig' if true else 'falsch'
    return {'type': 'choose', 'prompt': statement, 'answer': answer, 'options': ['richtig', 'falsch'],
            'hint': 'Richtig (true) or falsch (false)? Look at the text.', 'say': '', 'show': answer, 'why': why}


def order(sentence, hint, alts=(), keep=False):
    """Sentence building: the learner taps the words into order. `alts` are other correct word orders."""
    words = sentence.rstrip('.?!').split()
    if not keep and words[0] not in NAMES:
        words[0] = words[0][0].lower() + words[0][1:]
    prompt = 'Build the question.' if sentence.endswith('?') else 'Build the sentence.'
    return {'type': 'order', 'prompt': prompt, 'tiles': words, 'answer': sentence, 'alts': list(alts),
            'hint': hint, 'say': sentence}


def dialogue(lines, hint):
    """Put the lines of a conversation in order."""
    return {'type': 'order', 'mode': 'lines', 'prompt': 'Put the conversation in order.', 'tiles': lines,
            'answer': ' '.join(lines), 'hint': hint, 'say': '', 'show': ' → '.join(lines)}


def write_de(english, german, alts=(), hint='', why=''):
    """Translation into German, typed."""
    return {'type': 'write', 'lang': 'de', 'prompt': 'Write it in German.', 'text': english, 'answer': german,
            'alts': list(alts), 'hint': hint, 'say': german, 'why': why}


def write_en(german, english, alts=()):
    """Translation into English, typed."""
    return {'type': 'write', 'lang': 'en', 'prompt': 'What does it mean in English?', 'text': german,
            'answer': english, 'alts': list(alts), 'hint': '', 'say': german, 'show': english, 'why': ''}


def answer_de(question, answer, alts=()):
    """Answer a question about a text, in German."""
    return {'type': 'write', 'lang': 'de', 'prompt': 'Answer in German.', 'text': question, 'answer': answer,
            'alts': list(alts), 'hint': '', 'say': answer, 'why': ''}


def dictation(german, hint, alts=()):
    """Listen and write."""
    return {'type': 'write', 'lang': 'de', 'listen': True, 'prompt': 'Write what you hear.', 'answer': german,
            'alts': list(alts), 'hint': hint, 'say': german, 'why': ''}


def lesson(key, code, title, chapters, intro, blocks, rules, quiz_title, items):
    return {'key': key, 'code': code, 'title': title, 'chapters': chapters, 'intro': intro, 'blocks': blocks,
            'rules': rules, 'quiz': {'title': quiz_title, 'items': items}}


def reading(key, code, title, chapters, intro, text_title, paragraphs, glossary, items):
    return {'key': key, 'code': code, 'title': f'Reading: {title}', 'chapters': chapters, 'intro': intro,
            'blocks': [{'step': 'Read', 'title': text_title, 'reading': paragraphs, 'glossary': glossary}],
            'rules': [], 'quiz': {'title': 'Questions about the text', 'items': items}}


READ_INTRO = ['Read the text. Press a speaker to hear each part, and use the word list below it.',
              'Then answer the questions. The text stays on screen while you do.']


def review(unit_id):
    return {'key': f'test-{unit_id}', 'code': '★', 'title': 'Unit test', 'chapters': [], 'custom': 'review',
            'intro': ['Twelve questions from every lesson of this unit, mixed with its vocabulary. '
                      'You get a new mix each time you start.',
                      'Score 9 or more to complete the unit. If a question surprises you, go back to that lesson.']}


def extend(unit, sections=(), grammar=(), words=None):
    """Add sections and lessons to a unit; `words` adds entries to existing sections by key."""
    for key, extra in (words or {}).items():
        target = next(s for s in unit['sections'] if s['key'] == key)
        target['words'] += [w(g, e) for g, e in extra]
    unit['sections'] += list(sections)
    unit['grammar'] += list(grammar) + [review(unit['id'])]


# ---------------------------------------------------------------- Start: the alphabet
extend(UNIT0, sections=[
    sec('0.7', 'The alphabet', [
        ('das Alphabet', 'the alphabet (n.)'), ('der Buchstabe', 'the letter (m.)'), ('buchstabieren', 'to spell'),
        ('Wie schreibt man das?', 'How do you spell that?'),
        ('Können Sie das bitte buchstabieren?', 'Can you spell that, please?'),
        ('Wie ist Ihr Name, bitte?', 'What is your name, please?'), ('mit zwei n', "with two n's"),
        ('der Umlaut', 'the umlaut (m.)'), ('das Eszett', 'the letter ß (n.)')]),
], grammar=[
    lesson('g0-alphabet', 'P7', 'The German alphabet', ['0.7'],
           ['At the embassy, at the doctor\'s or on the phone you will often hear: <em class="de">Wie schreibt man '
            'das?</em> (How do you spell that?) Then you spell your name with the German letter names.',
            'Many letters sound close to English. Watch out for the vowels and for <strong>J, V, W, Y, Z</strong>.'],
           [{'step': 'The letters', 'title': 'A to Z, plus ä, ö, ü and ß',
             'text': 'Press a speaker to hear each group of letters.',
             'table': {'head': ['Letters', 'Say them'],
                       'rows': [['A B C D', 'a · be · ze · de'], ['E F G H', 'e · ef · ge · ha'],
                                ['I J K L', 'i · jot · ka · el'], ['M N O P', 'em · en · o · pe'],
                                ['Q R S T', 'ku · er · es · te'], ['U V W X', 'u · fau · we · ix'],
                                ['Y Z', 'üpsilon · zett'], ['Ä Ö Ü ß', 'ä · ö · ü · eszett']],
                       'say': ['a, be, ze, de', 'e, ef, ge, ha', 'i, jot, ka, el', 'em, en, o, pe', 'ku, er, es, te',
                               'u, fau, we, ix', 'üpsilon, zett', 'ä, ö, ü, eszett'], 'highlight': 1}},
            {'step': 'Spelling a name', 'title': 'Say it letter by letter', 'examples': [
                ('Wie schreibt man das?', 'How do you spell that?'), ('es, e, el, a, em', 'Selam'),
                ('de, a, we, i, te', 'Dawit'), ('Mit zwei n: ha, a, en, en, a.', "With two n's: Hanna.")]}],
           [('J = jot', 'not "jay"'), ('V = fau', 'like the f in "far"'), ('W = we', 'sounds like "vay"'),
            ('Z = zett', '"tsett"'), ('I = i', 'sounds like "ee"'), ('E = e', 'sounds like "ay"')],
           'Spell and listen', [
               listen('Selam', ['Selam', 'Salem', 'Selamu'], say='es, e, el, a, em',
                      hint='Listen to the spelling, then choose the name.'),
               listen('Dawit', ['Dawit', 'David', 'Dawid'], say='de, a, we, i, te',
                      hint='Listen to the spelling, then choose the name.'),
               listen('Tigist', ['Tigist', 'Tegist', 'Tigest'], say='te, i, ge, i, es, te',
                      hint='Listen to the spelling, then choose the name.'),
               listen('Yonas', ['Yonas', 'Jonas', 'Junas'], say='üpsilon, o, en, a, es',
                      hint='Listen to the spelling, then choose the name.'),
               listen('Meron', ['Meron', 'Miron', 'Meran'], say='em, e, er, o, en',
                      hint='Listen to the spelling, then choose the name.'),
               listen('Hawassa', ['Hawassa', 'Awasa', 'Hawasa'], say='ha, a, we, a, es, es, a',
                      hint='Listen to the spelling, then choose the town.'),
               pick('How do you say the letter J?', 'jot', ['jot', 'jay', 'je'], hint='Choose the letter name.'),
               pick('How do you say the letter V?', 'fau', ['fau', 'we', 'vi'], hint='Choose the letter name.'),
               pick('How do you say the letter W?', 'we', ['we', 'dabbelju', 'fau'], hint='Choose the letter name.'),
               pick('How do you say the letter Z?', 'zett', ['zett', 'zi', 'es'], hint='Choose the letter name.'),
               pick('How do you say the letter I?', 'i', ['i', 'ei', 'je'], hint='It sounds like the "ee" in "see".'),
               {**dictation('Hanna', 'A name, spelled letter by letter.'), 'say': 'ha, a, en, en, a'},
           ]),
])

# ---------------------------------------------------------------- Unit 1 additions
extend(UNIT1, words={
    '1.1': [('Gute Nacht!', 'Good night!')],
    '1.5': [('Super!', 'Great!'), ('Es geht.', "It's okay. / So-so."), ('Nicht so gut.', 'Not so good.'),
            ('Und dir?', 'And you? (informal)'), ('Auch gut.', 'Good too.')],
    '1.10': [('Freut mich!', 'Nice to meet you!')],
}, sections=[
    sec('1.11', 'Countries', [
        ('Äthiopien', 'Ethiopia'), ('Eritrea', 'Eritrea'), ('Kenia', 'Kenya'), ('Deutschland', 'Germany'),
        ('Österreich', 'Austria'), ('Frankreich', 'France'), ('Spanien', 'Spain'), ('Italien', 'Italy'),
        ('Ich komme aus Äthiopien.', 'I come from Ethiopia.'), ('Er kommt aus Kenia.', 'He comes from Kenya.'),
        ('Sie kommt aus Eritrea.', 'She comes from Eritrea.'), ('Ich wohne in Addis Abeba.', 'I live in Addis Ababa.')]),
    sec('1.12', 'In the German class', [
        ('Ich lerne Deutsch.', 'I am learning German.'), ('der Deutschkurs', 'the German course (m.)'),
        ('der Kursleiter', 'the course teacher (m.)'), ('die Kursleiterin', 'the course teacher (f.)'),
        ('Ich verstehe das nicht.', "I don't understand that."), ('Noch einmal, bitte.', 'Once more, please.'),
        ('Langsam, bitte.', 'Slowly, please.'), ('Wie sagt man … auf Deutsch?', 'How do you say … in German?'),
        ('Entschuldigung, wie bitte?', 'Sorry, pardon?')]),
], grammar=[
    lesson('g1-word-order', 'G3', 'Questions and statements: where the verb goes', ['1.6', '1.4'],
           ['In a statement and in a W-question (with <em class="de">wer, wie, woher, wo, was</em>) the verb is '
            'always in <strong>position 2</strong>.',
            'In a yes/no question the verb comes <strong>first</strong>: <em class="de">Kommst du aus Kenia?</em>'],
           [{'step': 'Position 2', 'title': 'The verb is the second element',
             'text': 'Press a speaker to hear each sentence.',
             'table': {'head': ['Position 1', 'Verb', 'Rest'],
                       'rows': [['Wer', 'ist', 'das?'], ['Woher', 'kommst', 'du?'], ['Wie', 'heißen', 'Sie?'],
                                ['Ich', 'heiße', 'Selam.'], ['Das', 'ist', 'Dawit.'], ['Er', 'kommt', 'aus Äthiopien.']],
                       'say': ['Wer ist das?', 'Woher kommst du?', 'Wie heißen Sie?', 'Ich heiße Selam.',
                               'Das ist Dawit.', 'Er kommt aus Äthiopien.'], 'highlight': 1}},
            {'step': 'Verb first', 'title': 'Yes/no questions', 'examples': [
                ('Kommst du aus Kenia?', 'Do you come from Kenya?'), ('Heißt du Hanna?', 'Is your name Hanna?'),
                ('Sind Sie Frau Bekele?', 'Are you Ms Bekele?'), ('Lernst du Deutsch?', 'Are you learning German?')]}],
           [('W-question', 'Woher + verb: Woher kommst du?'), ('Statement', 'Ich + verb: Ich komme aus Kenia.'),
            ('Yes/no question', 'verb first: Kommst du aus Kenia?')],
           'Build the sentences', [
               order('Woher kommst du?', 'Where are you from?'),
               order('Wie heißen Sie?', 'What is your name? (formal)'),
               order('Ich komme aus Äthiopien.', 'I come from Ethiopia.'),
               order('Das ist Dawit.', 'That is Dawit.'),
               order('Wer ist das?', 'Who is that?'),
               order('Kommst du aus Kenia?', 'Do you come from Kenya?'),
               order('Wo wohnst du?', 'Where do you live?'),
               order('Lernst du auch Deutsch?', 'Are you learning German too?'),
               choose('Where are you from?', 'Woher kommst du?', ['Woher kommst du?', 'Woher du kommst?', 'Kommst woher du?'],
                      why='W-word first, then the verb.'),
               choose('Are you Mr Tesfaye?', 'Sind Sie Herr Tesfaye?',
                      ['Sind Sie Herr Tesfaye?', 'Sie Herr Tesfaye sind?', 'Herr Tesfaye sind Sie?'],
                      why='Yes/no question: the verb comes first.'),
               write_de('I come from Ethiopia.', 'Ich komme aus Äthiopien.'),
               write_de('What is your name? (informal)', 'Wie heißt du?', alts=['Wie ist dein Name?']),
               write_en('Woher kommen Sie?', 'Where are you from?', alts=['Where do you come from?']),
           ]),
    lesson('g1-du-sie', 'G4', 'du or Sie?', ['1.7', '1.10'],
           ['German has two words for "you". <em class="de">du</em> is for family, friends, children and classmates. '
            '<em class="de">Sie</em> (always with a capital S) is for adults you do not know well: at work, in shops, '
            'at the doctor\'s, with officials.',
            'With <em class="de">Sie</em> the verb looks like the infinitive: <em class="de">Sie kommen, Sie heißen</em>. '
            'And <em class="de">sein</em> becomes <em class="de">Sie sind</em>.'],
           [{'step': 'Side by side', 'title': 'Informal and formal',
             'table': {'head': ['', 'du', 'Sie'],
                       'rows': [['heißen', 'Wie heißt du?', 'Wie heißen Sie?'],
                                ['kommen', 'Woher kommst du?', 'Woher kommen Sie?'],
                                ['sein', 'Wer bist du?', 'Wer sind Sie?'],
                                ['How are you?', 'Wie geht es dir?', 'Wie geht es Ihnen?'],
                                ['And you?', 'Und dir?', 'Und Ihnen?']],
                       'say': ['Wie heißt du? Wie heißen Sie?', 'Woher kommst du? Woher kommen Sie?',
                               'Wer bist du? Wer sind Sie?', 'Wie geht es dir? Wie geht es Ihnen?',
                               'Und dir? Und Ihnen?'], 'highlight': 2}},
            {'step': 'Names', 'title': 'First name or family name?',
             'text': 'With du you use the first name. With Sie you use Herr or Frau and the family name.',
             'examples': [("Hallo, Dawit! Wie geht's?", 'Hi, Dawit! How are you?'),
                          ('Guten Tag, Frau Bekele! Wie geht es Ihnen?', 'Good day, Ms Bekele! How are you?'),
                          ('Sie können mich duzen.', 'You can call me du.')]}],
           [('du', 'friends, family, children, classmates'), ('Sie', 'strangers, work, officials'),
            ('Sie + verb', '= infinitive: Sie kommen'), ('dir / Ihnen', 'Wie geht es dir / Ihnen?')],
           'du or Sie?', [
               choose('You meet a new classmate. You ask her name.', 'Wie heißt du?', ['Wie heißt du?', 'Wie heißen Sie?'],
                      hint='du or Sie?', why='A classmate: du.'),
               choose('At the embassy, you greet the officer.', 'Guten Tag! Wie geht es Ihnen?',
                      ['Guten Tag! Wie geht es Ihnen?', 'Hallo! Wie geht es dir?'], hint='du or Sie?',
                      why='An official: Sie.'),
               choose('Your doctor asks where you are from.', 'Woher kommen Sie?', ['Woher kommen Sie?', 'Woher kommst du?'],
                      hint='du or Sie?', why='A doctor and a patient say Sie.'),
               choose('You ask a child his name.', 'Wie heißt du?', ['Wie heißt du?', 'Wie heißen Sie?'],
                      hint='du or Sie?', why='Children: du.'),
               choose('You ask your new boss, Mr Weber, how he is.', 'Wie geht es Ihnen, Herr Weber?',
                      ['Wie geht es Ihnen, Herr Weber?', 'Wie geht es dir, Herr Weber?'], hint='du or Sie?',
                      why='Herr or Frau + family name goes with Sie.'),
               gap('Woher ', 'kommen', ' Sie?', ['kommen', 'kommst', 'kommt'], 'Where are you from? (formal)'),
               gap('Woher ', 'kommst', ' du?', ['kommst', 'kommen', 'komme'], 'Where are you from? (informal)'),
               gap('Wer ', 'sind', ' Sie?', ['sind', 'bist', 'ist'], 'Who are you? (formal)'),
               gap('Wie geht es ', 'Ihnen', '?', ['Ihnen', 'dir', 'Sie'], 'How are you? (formal)'),
               gap('Gut, danke. Und ', 'dir', '?', ['dir', 'Ihnen', 'du'], 'Fine, thanks. And you? (to a friend)'),
               dialogue(['Guten Tag! Ich heiße Abebe Tesfaye.', 'Guten Tag, Herr Tesfaye. Ich bin Anna Weber.',
                         'Freut mich, Frau Weber. Woher kommen Sie?', 'Ich komme aus Deutschland. Und Sie?',
                         'Ich komme aus Äthiopien.'], 'A formal first meeting'),
               dialogue(['Hallo! Ich bin Meron. Und du?', 'Hi, Meron! Ich heiße Jonas.', 'Woher kommst du, Jonas?',
                         'Aus Österreich. Und du?', 'Ich komme aus Eritrea.'], 'Two classmates'),
           ]),
    reading('g1-reading', 'R1', 'First day in the German course', ['1.11', '1.12'], READ_INTRO,
            'Der erste Tag im Deutschkurs', [
                'Heute ist der erste Tag im Deutschkurs. Die Kursleiterin heißt Frau Wagner. Sie kommt aus '
                'Deutschland, aus Hamburg.',
                'Im Kurs sind zwölf Personen. Meron kommt aus Eritrea, aber sie wohnt in Addis Abeba. '
                'Dawit kommt aus Bahir Dar.',
                'Dawit sagt: „Hallo, ich heiße Dawit. Ich lerne Deutsch für die Arbeit.“ Meron fragt: „Wie bitte? '
                'Noch einmal, bitte!“',
                'Frau Wagner sagt: „Herzlich willkommen! Wir sagen hier du, okay?“'],
            [('heute', 'today'), ('der erste Tag', 'the first day'), ('aber', 'but'), ('für die Arbeit', 'for work'),
             ('Herzlich willkommen!', 'Welcome!')], [
                tf('Frau Wagner kommt aus Hamburg.', True),
                tf('Im Kurs sind zehn Personen.', False, why='Im Kurs sind zwölf Personen.'),
                tf('Meron wohnt in Eritrea.', False, why='Sie kommt aus Eritrea, aber sie wohnt in Addis Abeba.'),
                tf('Dawit kommt aus Bahir Dar.', True),
                tf('Dawit lernt Deutsch für die Arbeit.', True),
                tf('Im Kurs sagen alle Sie.', False, why='Frau Wagner sagt: Wir sagen hier du.'),
                pick('Wer ist Frau Wagner?', 'die Kursleiterin', ['die Kursleiterin', 'eine Studentin', 'Merons Mutter'],
                     hint='Who is Frau Wagner?'),
                pick('Was sagt Meron?', 'Noch einmal, bitte!', ['Noch einmal, bitte!', 'Herzlich willkommen!',
                                                                'Ich heiße Dawit.'], hint='What does Meron say?'),
                answer_de('Wo wohnt Meron?', 'Sie wohnt in Addis Abeba.', alts=['In Addis Abeba.', 'Addis Abeba']),
                write_en('Ich lerne Deutsch für die Arbeit.', 'I am learning German for work.',
                         alts=['I learn German for work.', 'I am learning German for my job.']),
            ]),
])

# ---------------------------------------------------------------- Unit 2 additions
extend(UNIT2, words={
    '2.6': [('Amharisch', 'Amharic'), ('Tigrinya', 'Tigrinya'), ('Oromo', 'Oromo'), ('Arabisch', 'Arabic'),
            ('Italienisch', 'Italian'), ('Türkisch', 'Turkish'), ('Russisch', 'Russian'),
            ('Sprichst du Englisch?', 'Do you speak English?'), ('Ja, ein bisschen.', 'Yes, a little.'),
            ('Nein, gar nicht.', 'No, not at all.')],
}, sections=[
    sec('2.14', 'How old are you?', [
        ('Wie alt bist du?', 'How old are you? (informal)'), ('Wie alt sind Sie?', 'How old are you? (formal)'),
        ('Ich bin 25 Jahre alt.', 'I am 25 years old.'), ('Ich bin 30.', 'I am 30.'), ('das Alter', 'the age (n.)'),
        ('jung', 'young'), ('alt', 'old'), ('Er ist 70 Jahre alt.', 'He is 70 years old.')]),
    sec('2.15', 'More family', [
        ('der Enkel', 'the grandson (m.)'), ('die Enkelin', 'the granddaughter (f.)'),
        ('die Enkelkinder', 'the grandchildren (pl.)'), ('der Ehemann', 'the husband (m.)'),
        ('die Ehefrau', 'the wife (f.)'), ('der Partner', 'the partner (m.)'), ('die Partnerin', 'the partner (f.)'),
        ('Mama', 'Mum'), ('Papa', 'Dad'), ('das Kind', 'the child (n.)'), ('Ich bin Single.', 'I am single.'),
        ('Wir leben zusammen.', 'We live together.'), ('Ich lebe allein.', 'I live alone.')]),
    sec('2.16', 'Yes, no or doch', [
        ('ja', 'yes'), ('nein', 'no'), ('doch', 'yes (to a negative question)'),
        ('Ist das deine Schwester?', 'Is that your sister?'), ('Ja, das ist meine Schwester.', 'Yes, that is my sister.'),
        ('Nein, das ist meine Cousine.', 'No, that is my cousin.'), ('Ist das nicht dein Bruder?', "Isn't that your brother?"),
        ('Doch, das ist mein Bruder.', 'Yes, it is my brother.'), ('Ich glaube, …', 'I think …')]),
    sec('2.17', "Whose? Selam's brother", [
        ('Selams Bruder', "Selam's brother"), ('Dawits Mutter', "Dawit's mother"), ('Hannas Eltern', "Hanna's parents"),
        ("Jonas' Vater", "Jonas's father"), ('Wer ist Dawits Vater?', "Who is Dawit's father?"),
        ('Das ist Merons Tochter.', "That is Meron's daughter.")]),
], grammar=[
    lesson('g2-doch', 'G5', 'ja, nein or doch?', ['2.16'],
           ['To a normal yes/no question you answer <strong>ja</strong> or <strong>nein</strong>.',
            'If the question contains <em class="de">nicht</em> or <em class="de">kein</em> and you want to say '
            '"yes, it is", the answer is <strong>doch</strong>. English has no single word for this.'],
           [{'step': 'Three answers', 'title': 'Which word, when?',
             'table': {'head': ['Question', 'Yes', 'No'],
                       'rows': [['Ist das dein Vater?', 'Ja, das ist mein Vater.', 'Nein, das ist mein Onkel.'],
                                ['Ist das nicht dein Vater?', 'Doch, das ist mein Vater.', 'Nein, das ist mein Onkel.'],
                                ['Hast du keine Kinder?', 'Doch, ich habe zwei Kinder.', 'Nein, ich habe keine Kinder.']],
                       'say': ['Ist das dein Vater? Ja, das ist mein Vater.', 'Ist das nicht dein Vater? Doch, das ist mein Vater.',
                               'Hast du keine Kinder? Doch, ich habe zwei Kinder.'], 'highlight': 1}},
            {'step': 'Listen', 'title': 'doch in conversation', 'examples': [
                ('Bist du nicht verheiratet? – Doch!', "Aren't you married? – Yes, I am!"),
                ('Sprichst du kein Englisch? – Doch, ein bisschen.', "Don't you speak any English? – Yes, a little."),
                ('Wohnst du nicht in Addis? – Nein, in Adama.', "Don't you live in Addis? – No, in Adama.")]}],
           [('ja / nein', 'answers to a normal question'), ('doch', '"yes" to a question with nicht or kein'),
            ('nein', '"no" to both kinds of question')],
           'ja, nein or doch?', [
               gap('Ist das deine Mutter? – ', 'Ja', ', das ist meine Mutter.', ['Ja', 'Doch', 'Nein'], 'Yes, it is.'),
               gap('Ist das nicht deine Mutter? – ', 'Doch', ', das ist meine Mutter.', ['Ja', 'Doch', 'Nein'],
                   'Yes, it is.', why='A question with nicht: "yes" is doch.'),
               gap('Bist du verheiratet? – ', 'Nein', ', ich bin ledig.', ['Ja', 'Doch', 'Nein'], 'No, I am single.'),
               gap('Bist du nicht verheiratet? – ', 'Doch', ', ich bin verheiratet.', ['Ja', 'Doch', 'Nein'],
                   'Yes, I am married.'),
               gap('Hast du keine Geschwister? – ', 'Doch', ', ich habe zwei Brüder.', ['Ja', 'Doch', 'Nein'],
                   'Yes, I have two brothers.', why='A question with kein: "yes" is doch.'),
               gap('Hast du keine Kinder? – ', 'Nein', ', ich habe keine Kinder.', ['Ja', 'Doch', 'Nein'],
                   'No, I have no children.'),
               gap('Sprichst du Amharisch? – ', 'Ja', ', sehr gut.', ['Ja', 'Doch', 'Nein'], 'Yes, very well.'),
               gap('Sprichst du kein Englisch? – ', 'Doch', ', ein bisschen.', ['Ja', 'Doch', 'Nein'], 'Yes, a little.'),
               gap('Kommst du nicht aus Kenia? – ', 'Nein', ', ich komme aus Äthiopien.', ['Ja', 'Doch', 'Nein'],
                   'No, from Ethiopia.'),
               gap('Ist Dawit nicht dein Bruder? – ', 'Doch', ', er ist mein Bruder.', ['Ja', 'Doch', 'Nein'],
                   'Yes, he is my brother.'),
               order('Ist das nicht deine Schwester?', "Isn't that your sister?"),
               choose("Aren't you from Ethiopia? – Yes, I am.", 'Doch, ich komme aus Äthiopien.',
                      ['Doch, ich komme aus Äthiopien.', 'Ja, ich komme aus Äthiopien.', 'Nein, ich komme aus Äthiopien.'],
                      why='After a question with nicht, "yes" is doch.'),
           ]),
    lesson('g2-names-s', 'G6', "Selams Bruder: whose is it?", ['2.17', '2.1'],
           ['To say whose family member someone is, add <strong>-s</strong> to the name, with no apostrophe: '
            '<em class="de">Selams Bruder</em> = Selam\'s brother.',
            'If the name already ends in s, ß, x or z, write only an apostrophe: <em class="de">Jonas\' Vater</em>.'],
           [{'step': 'Examples', 'title': 'Name + s', 'examples': [
               ('Selams Bruder', "Selam's brother"), ('Dawits Mutter', "Dawit's mother"),
               ('Hannas Eltern', "Hanna's parents"), ("Jonas' Vater", "Jonas's father"),
               ('Wer ist Merons Tochter?', "Who is Meron's daughter?")]},
            {'step': 'Family puzzles', 'title': 'Who is who?', 'examples': [
                ('Abebe ist Dawits Vater.', "Abebe is Dawit's father."),
                ('Dawit ist Abebes Sohn.', "Dawit is Abebe's son."),
                ('Hannas Oma heißt Almaz.', "Hanna's grandma is called Almaz.")]}],
           [('Name + s', 'Selams Bruder'), ('No apostrophe', "Hannas, not Hanna's"),
            ('Name ending in s', "Jonas' Vater")],
           'Whose is it?', [
               gap('', 'Selams', ' Bruder heißt Yonas.', ['Selams', "Selam's", 'Selam'], "Selam's brother is called Yonas.",
                   why='German adds -s with no apostrophe.'),
               gap('Das ist ', 'Dawits', ' Mutter.', ['Dawits', "Dawit's", 'Dawit'], "That is Dawit's mother."),
               gap('Wer ist ', 'Hannas', ' Vater?', ['Hannas', 'Hanna', "Hannas'"], "Who is Hanna's father?"),
               gap('', "Jonas'", ' Schwester heißt Lena.', ["Jonas'", 'Jonass', 'Jonases'], "Jonas's sister is called Lena.",
                   why='The name ends in s: add only an apostrophe.'),
               pick('Abebe ist Dawits Vater. Dawit ist Abebes …', 'Sohn', ['Sohn', 'Bruder', 'Vater'],
                    hint="Abebe is Dawit's father. Dawit is Abebe's …"),
               pick("Almaz ist Hannas Oma. Hanna ist Almaz' …", 'Enkelin', ['Enkelin', 'Tochter', 'Schwester'],
                    hint="Almaz is Hanna's grandma. Hanna is Almaz's …"),
               pick("Yonas ist Selams Bruder. Selam ist Yonas' …", 'Schwester', ['Schwester', 'Mutter', 'Tante'],
                    hint="Yonas is Selam's brother. Selam is Yonas's …"),
               pick('Tigist ist die Schwester von Dawits Mutter. Tigist ist Dawits …', 'Tante', ['Tante', 'Oma', 'Cousine'],
                    hint="Tigist is the sister of Dawit's mother. She is Dawit's …"),
               pick('Samuel ist der Sohn von Dawits Onkel. Samuel ist Dawits …', 'Cousin', ['Cousin', 'Bruder', 'Enkel'],
                    hint="Samuel is the son of Dawit's uncle. He is Dawit's …"),
               order('Das ist Merons Tochter.', "That is Meron's daughter."),
               write_de("Selam's brother", 'Selams Bruder', hint='Remember: -s, no apostrophe.'),
               write_en('Hannas Eltern wohnen in Adama.', "Hanna's parents live in Adama."),
           ]),
    lesson('g2-verbs-plural', 'G7', 'wohnen, arbeiten, haben: all six forms', ['2.11', '2.12'],
           ['You already know the endings for ich, du and er/sie. Here are all six persons, with '
            '<em class="de">wir, ihr</em> and <em class="de">sie/Sie</em>.',
            'Verbs whose stem ends in <strong>-t</strong> or <strong>-d</strong> (arbeiten, finden) add an extra '
            '<strong>e</strong> so they are easier to say: <em class="de">du arbeitest, er arbeitet</em>.'],
           [{'step': 'The forms', 'title': 'Six persons',
             'table': {'head': ['Person', 'wohnen', 'arbeiten', 'haben'],
                       'rows': [['ich', 'wohne', 'arbeite', 'habe'], ['du', 'wohnst', 'arbeitest', 'hast'],
                                ['er / sie / es', 'wohnt', 'arbeitet', 'hat'], ['wir', 'wohnen', 'arbeiten', 'haben'],
                                ['ihr', 'wohnt', 'arbeitet', 'habt'], ['sie / Sie', 'wohnen', 'arbeiten', 'haben']],
                       'say': ['ich wohne, ich arbeite, ich habe', 'du wohnst, du arbeitest, du hast',
                               'er wohnt, er arbeitet, er hat', 'wir wohnen, wir arbeiten, wir haben',
                               'ihr wohnt, ihr arbeitet, ihr habt', 'sie wohnen, sie arbeiten, sie haben']}},
            {'step': 'In sentences', 'title': 'wir, ihr, sie', 'examples': [
                ('Wir wohnen in Hawassa.', 'We live in Hawassa.'), ('Wo wohnt ihr?', 'Where do you (all) live?'),
                ('Sie arbeiten in einem Hotel.', 'They work in a hotel.'),
                ('Ihr habt zwei Kinder, oder?', 'You have two children, right?'),
                ('Lebt ihr zusammen?', 'Do you live together?')]}],
           [('wir / sie / Sie', '= the infinitive: wohnen'), ('ihr', '-t: ihr wohnt'),
            ('arbeiten', 'du arbeitest, er arbeitet'), ('haben', 'du hast, er hat')],
           'Choose the right form', [
               gap('Wir ', 'wohnen', ' in Hawassa.', ['wohnen', 'wohnt', 'wohnst'], 'We live in Hawassa.'),
               gap('Wo ', 'wohnt', ' ihr?', ['wohnt', 'wohnen', 'wohnst'], 'Where do you (all) live?'),
               gap('Meron ', 'arbeitet', ' in einem Café.', ['arbeitet', 'arbeitt', 'arbeiten'], 'Meron works in a café.',
                   why='The stem ends in t: arbeit + e + t.'),
               gap('Du ', 'arbeitest', ' viel.', ['arbeitest', 'arbeitst', 'arbeiten'], 'You work a lot.'),
               gap('Ihr ', 'habt', ' zwei Kinder.', ['habt', 'haben', 'hat'], 'You (all) have two children.'),
               gap('Dawit und Selam ', 'leben', ' zusammen.', ['leben', 'lebt', 'lebst'], 'Dawit and Selam live together.'),
               gap('', 'Lebt', ' ihr in Deutschland?', ['Lebt', 'Leben', 'Lebst'], 'Do you (all) live in Germany?'),
               gap('Sie ', 'haben', ' keine Kinder.', ['haben', 'hat', 'habt'], 'They have no children.'),
               order('Wir wohnen in Adama.', 'We live in Adama.'),
               order('Wo arbeitet ihr?', 'Where do you (all) work?'),
               write_de('We live together.', 'Wir leben zusammen.', alts=['Wir wohnen zusammen.']),
               write_de('Where do you live? (informal, one person)', 'Wo wohnst du?', alts=['Wo lebst du?']),
           ]),
    reading('g2-reading', 'R1', "Hanna's family", ['2.1', '2.14', '2.15'], READ_INTRO, 'Hanna und ihre Familie', [
        'Ich heiße Hanna Girma. Ich bin 27 Jahre alt und komme aus Äthiopien, aus Hawassa. Jetzt wohne ich in Frankfurt.',
        'Ich bin verheiratet. Mein Mann heißt Samuel. Er ist 31 und arbeitet als Ingenieur. Wir haben eine Tochter. '
        'Sie heißt Liya und ist drei Jahre alt.',
        'Meine Eltern leben in Hawassa. Mein Vater ist Lehrer, meine Mutter arbeitet in einem Krankenhaus. '
        'Ich habe zwei Brüder, aber keine Schwester.',
        'Ich spreche Amharisch, Englisch und ein bisschen Deutsch. Mein Bruder Yonas spricht sehr gut Deutsch. '
        'Er wohnt in Berlin.'],
        [('jetzt', 'now'), ('als Ingenieur', 'as an engineer'), ('das Krankenhaus', 'the hospital'), ('aber', 'but')], [
            tf('Hanna kommt aus Hawassa.', True),
            tf('Hanna wohnt in Hawassa.', False, why='Jetzt wohnt sie in Frankfurt.'),
            tf('Samuel ist Hannas Mann.', True),
            tf('Liya ist Hannas Schwester.', False, why='Liya ist Hannas Tochter.'),
            tf('Hanna hat zwei Brüder.', True),
            tf('Hannas Mutter ist Lehrerin.', False,
               why='Hannas Vater ist Lehrer. Ihre Mutter arbeitet in einem Krankenhaus.'),
            pick('Wie alt ist Liya?', 'drei Jahre', ['drei Jahre', '27 Jahre', '31 Jahre'], hint='How old is Liya?'),
            pick('Wer spricht sehr gut Deutsch?', 'Yonas', ['Yonas', 'Hanna', 'Samuel'], hint='Who speaks German very well?'),
            answer_de('Was ist Samuel von Beruf?', 'Er ist Ingenieur.', alts=['Ingenieur', 'Er arbeitet als Ingenieur.']),
            write_en('Wir haben eine Tochter.', 'We have a daughter.'),
        ]),
])

# ---------------------------------------------------------------- Unit 3 additions
extend(UNIT3, sections=[
    sec('3.16', 'I like … (mögen)', [
        ('mögen', 'to like'), ('ich mag', 'I like'), ('du magst', 'you like'), ('er mag', 'he likes'),
        ('Ich mag Kaffee.', 'I like coffee.'), ('Ich mag keinen Fisch.', "I don't like fish."), ('Ich auch.', 'Me too.'),
        ('Ich nicht.', "I don't."), ('Ich auch nicht.', 'Me neither.'), ('Ich schon.', 'I do.'),
        ('lecker', 'tasty, delicious'), ('Das schmeckt gut.', 'That tastes good.')]),
    sec('3.17', 'Breakfast & meals', [
        ('das Frühstück', 'the breakfast (n.)'), ('zum Frühstück', 'for breakfast'), ('das Abendessen', 'the dinner (n.)'),
        ('das Müsli', 'the muesli (n.)'), ('die Marmelade', 'the jam (f.)'), ('der Honig', 'the honey (m.)'),
        ('die Butter', 'the butter (f.)'), ('die Suppe', 'the soup (f.)'), ('der Salat', 'the salad (m.)'),
        ('die Nudeln', 'the pasta, noodles (pl.)'), ('das Eis', 'the ice cream (n.)'), ('die Tasse', 'the cup (f.)'),
        ('eine Tasse Kaffee', 'a cup of coffee'), ('Was isst du zum Frühstück?', 'What do you eat for breakfast?')]),
    sec('3.18', 'Compound nouns', [
        ('der Apfelkuchen', 'the apple cake (m.)'), ('der Apfelsaft', 'the apple juice (m.)'),
        ('der Schokoladenkuchen', 'the chocolate cake (m.)'), ('die Kartoffelsuppe', 'the potato soup (f.)'),
        ('die Tomatensuppe', 'the tomato soup (f.)'), ('das Käsebrot', 'the cheese sandwich (n.)'),
        ('der Obstsalat', 'the fruit salad (m.)'), ('die Kaffeetasse', 'the coffee cup (f.)')]),
], grammar=[
    lesson('g3-moegen', 'G5', 'mögen, möchten, nehmen', ['3.16', '3.15'],
           ['<em class="de">mögen</em> means to like, in general: <em class="de">Ich mag Kaffee.</em> '
            '<em class="de">möchten</em> means would like, now and politely: <em class="de">Ich möchte einen Kaffee, bitte.</em>',
            'In a café you will also hear <em class="de">nehmen</em> (to take, to have). Its vowel changes: '
            '<em class="de">du nimmst, er nimmt</em>.'],
           [{'step': 'The forms', 'title': 'Three verbs for food and drink',
             'table': {'head': ['Person', 'mögen', 'möchten', 'nehmen'],
                       'rows': [['ich', 'mag', 'möchte', 'nehme'], ['du', 'magst', 'möchtest', 'nimmst'],
                                ['er / sie / es', 'mag', 'möchte', 'nimmt'], ['wir', 'mögen', 'möchten', 'nehmen'],
                                ['ihr', 'mögt', 'möchtet', 'nehmt'], ['sie / Sie', 'mögen', 'möchten', 'nehmen']],
                       'say': ['ich mag, ich möchte, ich nehme', 'du magst, du möchtest, du nimmst',
                               'er mag, er möchte, er nimmt', 'wir mögen, wir möchten, wir nehmen',
                               'ihr mögt, ihr möchtet, ihr nehmt', 'sie mögen, sie möchten, sie nehmen']}},
            {'step': 'In sentences', 'title': 'Like, would like, take', 'examples': [
                ('Ich mag keinen Käse.', "I don't like cheese."), ('Magst du Injera?', 'Do you like injera?'),
                ('Wir möchten zwei Tee, bitte.', 'We would like two teas, please.'), ('Was nimmst du?', 'What are you having?'),
                ('Ich nehme die Suppe.', 'I will have the soup.'), ('Ich mag Fisch. – Ich auch!', 'I like fish. – Me too!')]}],
           [('mögen', 'like in general: Ich mag Tee.'), ('möchten', 'would like now: Ich möchte einen Tee.'),
            ('ich / er mag, möchte', 'no ending for ich and er'), ('nehmen', 'du nimmst, er nimmt')],
           'Like, would like or take?', [
               gap('Ich ', 'mag', ' Kaffee sehr.', ['mag', 'möchte', 'magst'], 'I like coffee a lot.'),
               gap('', 'Magst', ' du Fisch?', ['Magst', 'Mag', 'Möchtet'], 'Do you like fish?'),
               gap('Er ', 'mag', ' keine Tomaten.', ['mag', 'magt', 'mögt'], "He doesn't like tomatoes."),
               gap('Ihr ', 'mögt', ' Schokolade, oder?', ['mögt', 'mögen', 'mag'], 'You (all) like chocolate, right?'),
               gap('Guten Tag! Ich ', 'möchte', ' einen Tee, bitte.', ['möchte', 'mag', 'möchtest'],
                   'Hello! I would like a tea, please.', why='Ordering now: möchte.'),
               gap('Was ', 'möchten', ' Sie trinken?', ['möchten', 'möchtest', 'mögt'], 'What would you like to drink?'),
               gap('Was ', 'nimmst', ' du?', ['nimmst', 'nehmst', 'nimmt'], 'What are you having?'),
               gap('Sie ', 'nimmt', ' den Salat.', ['nimmt', 'nehmt', 'nehmen'], 'She is having the salad.'),
               pick('A friend says: Ich mag Kaffee. You like it too.', 'Ich auch!', ['Ich auch!', 'Ich auch nicht!', 'Ich schon!']),
               pick("A friend says: Ich mag keinen Fisch. You don't like fish either.", 'Ich auch nicht!',
                    ['Ich auch nicht!', 'Ich auch!', 'Ich schon!']),
               pick("A friend says: Ich mag keinen Käse. But you like cheese.", 'Ich schon!',
                    ['Ich schon!', 'Ich auch!', 'Ich auch nicht!'], why="Ich schon = I do (even if you don't)."),
               order('Ich möchte eine Tasse Kaffee.', 'I would like a cup of coffee.'),
               write_de('I like tea.', 'Ich mag Tee.', alts=['Ich trinke gern Tee.']),
           ]),
    lesson('g3-compounds', 'G6', 'Compound nouns: Apfel + Kuchen', ['3.18'],
           ['German loves joining nouns: <em class="de">der Apfel + der Kuchen = der Apfelkuchen</em> (apple cake).',
            'The <strong>last</strong> noun is the main word. It gives the meaning and the article: a '
            '<em class="de">Kaffeetasse</em> is a cup (die Tasse), so it is <em class="de">die Kaffeetasse</em>.',
            'Sometimes a small linking sound appears in the middle: '
            '<em class="de">Schokolade + Kuchen = Schokoladenkuchen</em>.'],
           [{'step': 'Building words', 'title': 'Two nouns, one word',
             'table': {'head': ['First word', 'Last word', 'Together'],
                       'rows': [['der Apfel', 'der Saft', 'der Apfelsaft'],
                                ['die Kartoffel', 'die Suppe', 'die Kartoffelsuppe'],
                                ['der Käse', 'das Brot', 'das Käsebrot'], ['der Kaffee', 'die Tasse', 'die Kaffeetasse'],
                                ['die Schokolade', 'der Kuchen', 'der Schokoladenkuchen']],
                       'say': ['der Apfelsaft', 'die Kartoffelsuppe', 'das Käsebrot', 'die Kaffeetasse',
                               'der Schokoladenkuchen'], 'highlight': 2}}],
           [('Last word = main word', 'an Apfelsaft is a juice'), ('Last word = article', 'die Tasse → die Kaffeetasse'),
            ('Linking -n-', 'Schokoladenkuchen, Tomatensuppe')],
           'der, die or das?', [
               gap('', 'der', ' Apfelkuchen', ['der', 'die', 'das'], 'the apple cake', why='der Kuchen → der Apfelkuchen.'),
               gap('', 'die', ' Kartoffelsuppe', ['der', 'die', 'das'], 'the potato soup', why='die Suppe.'),
               gap('', 'das', ' Käsebrot', ['der', 'die', 'das'], 'the cheese sandwich', why='das Brot.'),
               gap('', 'die', ' Kaffeetasse', ['der', 'die', 'das'], 'the coffee cup', why='die Tasse.'),
               gap('', 'der', ' Orangensaft', ['der', 'die', 'das'], 'the orange juice', why='der Saft.'),
               gap('', 'das', ' Mineralwasser', ['der', 'die', 'das'], 'the mineral water', why='das Wasser.'),
               gap('', 'der', ' Obstsalat', ['der', 'die', 'das'], 'the fruit salad', why='der Salat.'),
               pick('What is a Kaffeetasse?', 'a cup for coffee', ['a cup for coffee', 'coffee in a cup', 'a coffee shop'],
                    say='die Kaffeetasse', hint='The last word is the main word.'),
               pick('What is a Tomatensuppe?', 'a soup made with tomatoes',
                    ['a soup made with tomatoes', 'a tomato with soup', 'a soup bowl'], say='die Tomatensuppe'),
               pick('Schokolade + Kuchen = ?', 'der Schokoladenkuchen',
                    ['der Schokoladenkuchen', 'die Kuchenschokolade', 'der Schokoladekuchen'], why='With a linking -n-.'),
               write_de('the apple juice', 'der Apfelsaft'),
               write_de('the cheese sandwich', 'das Käsebrot'),
           ]),
    reading('g3-reading', 'R1', 'In the café', ['3.15', '3.16'], READ_INTRO, 'Im Café', [
        'Kellnerin: Guten Tag! Was möchten Sie?',
        'Dawit: Ich möchte einen Kaffee und einen Apfelkuchen, bitte.',
        'Kellnerin: Tut mir leid, wir haben keinen Apfelkuchen mehr. Möchten Sie einen Schokoladenkuchen?',
        'Dawit: Nein, danke. Ich mag keine Schokolade. Haben Sie Obstsalat?',
        'Kellnerin: Ja, natürlich. Ein Kaffee und ein Obstsalat. Und für Sie?',
        'Selam: Ich nehme einen Tee und ein Käsebrot, bitte.',
        'Kellnerin: Gern! Das macht zusammen 14 Euro 50.'],
        [('keinen … mehr', 'no more …'), ('natürlich', 'of course'), ('für Sie', 'for you'), ('zusammen', 'together')], [
            tf('Dawit möchte einen Apfelkuchen.', True, why='Ja, aber das Café hat keinen Apfelkuchen mehr.'),
            tf('Das Café hat noch Apfelkuchen.', False, why='Wir haben keinen Apfelkuchen mehr.'),
            tf('Dawit mag Schokolade.', False, why='Er sagt: Ich mag keine Schokolade.'),
            tf('Dawit nimmt einen Obstsalat.', True),
            tf('Selam trinkt Kaffee.', False, why='Selam nimmt einen Tee.'),
            pick('Was isst Selam?', 'ein Käsebrot', ['ein Käsebrot', 'einen Obstsalat', 'einen Schokoladenkuchen'],
                 hint='What does Selam eat?'),
            pick('Was kostet alles zusammen?', '14,50 Euro', ['14,50 Euro', '4,50 Euro', '40,50 Euro'],
                 say='14 Euro 50', hint='How much is it altogether?'),
            dialogue(['Guten Tag! Was möchten Sie?', 'Einen Tee, bitte.', 'Tut mir leid, wir haben keinen Tee mehr.',
                      'Schade! Dann nehme ich einen Kaffee.', 'Gern!'], 'Ordering in a café'),
            write_de('I would like a coffee, please.', 'Ich möchte einen Kaffee, bitte.',
                     alts=['Einen Kaffee, bitte.', 'Ich nehme einen Kaffee, bitte.']),
        ]),
])

# ---------------------------------------------------------------- Unit 4 additions
extend(UNIT4, sections=[
    sec('4.15', 'Everyday objects', [
        ('der Kugelschreiber', 'the pen (m.)'), ('der Kuli', 'the pen (m., short form)'), ('der Bleistift', 'the pencil (m.)'),
        ('die Brille', 'the glasses (f.)'), ('das Heft', 'the exercise book (n.)'), ('die Kamera', 'the camera (f.)'),
        ('die Kette', 'the necklace (f.)'), ('der Schlüssel', 'the key (m.)'), ('die Tasche', 'the bag (f.)'),
        ('das Handy', 'the mobile phone (n.)'), ('die Flasche', 'the bottle (f.)'), ('das Feuerzeug', 'the lighter (n.)'),
        ('der Regenschirm', 'the umbrella (m.)'), ('Was ist das?', 'What is that?'),
        ('Das ist ein Schlüssel.', 'That is a key.')]),
    sec('4.16', 'Materials', [
        ('das Holz', 'the wood (n.)'), ('das Plastik', 'the plastic (n.)'), ('das Papier', 'the paper (n.)'),
        ('das Metall', 'the metal (n.)'), ('das Glas', 'the glass (n.)'), ('der Stoff', 'the fabric (m.)'),
        ('das Leder', 'the leather (n.)'), ('aus Holz', 'made of wood'),
        ('Die Flasche ist aus Glas.', 'The bottle is made of glass.'),
        ('Die Tasche ist aus Leder.', 'The bag is made of leather.')]),
    sec('4.17', 'Words & email addresses', [
        ('Wie heißt das auf Deutsch?', 'What is that called in German?'), ('Das heißt …', 'It is called …'),
        ('Danke schön!', 'Thank you very much!'), ('Bitte schön!', "You're welcome!"), ('Kein Problem.', 'No problem.'),
        ('Sehr gern.', 'My pleasure.'), ('die E-Mail-Adresse', 'the email address (f.)'), ('der Punkt', 'the dot (m.)'),
        ('der Unterstrich', 'the underscore (m.)'), ('der Bindestrich', 'the hyphen (m.)'),
        ('Wie ist deine E-Mail-Adresse?', 'What is your email address?')]),
    sec('4.18', 'Shopping for furniture', [
        ('der Sessel', 'the armchair (m.)'), ('das Sonderangebot', 'the special offer (n.)'),
        ('günstig', 'cheap, good value'), ('modern', 'modern'), ('zu groß', 'too big'), ('zu klein', 'too small'),
        ('Schau mal!', 'Look!'), ('Wie findest du das Sofa?', 'What do you think of the sofa?'),
        ('Das finde ich auch.', 'I think so too.'), ('Das finde ich nicht.', "I don't think so."),
        ('Wie viel kostet der Stuhl?', 'How much is the chair?'), ('Er kostet 59 Euro.', 'It costs 59 euros.')]),
], grammar=[
    lesson('g4-prices', 'G4', 'Big numbers and prices', ['4.14', '4.18'],
           ['Big numbers are written as one word: 345 = <em class="de">dreihundertfünfundvierzig</em>. Say the hundreds '
            'first, then the last two digits just as you say 1–99: "five-and-forty".',
            'Prices: 9,99 € is said <em class="de">neun Euro neunundneunzig</em>. German writes a comma where English '
            'has a point, and a point or a space to group thousands: 1.500 or 1 500.'],
           [{'step': 'Numbers', 'title': 'From 100 to a million',
             'table': {'head': ['Number', 'German'],
                       'rows': [['100', '(ein)hundert'], ['101', 'hunderteins'], ['250', 'zweihundertfünfzig'],
                                ['999', 'neunhundertneunundneunzig'], ['1 000', '(ein)tausend'],
                                ['2 500', 'zweitausendfünfhundert'], ['10 000', 'zehntausend'], ['1 000 000', 'eine Million']],
                       'say': ['hundert', 'hunderteins', 'zweihundertfünfzig', 'neunhundertneunundneunzig', 'tausend',
                               'zweitausendfünfhundert', 'zehntausend', 'eine Million'], 'highlight': 1}},
            {'step': 'Prices', 'title': 'Euro and cent', 'examples': [
                ('Das kostet 4,50 €.', 'That costs 4 euros 50.'), ('9,99 € – neun Euro neunundneunzig', '9.99 euros'),
                ('0,80 € – achtzig Cent', '80 cents'), ('Der Sessel kostet 120 Euro.', 'The armchair costs 120 euros.'),
                ('Das ist aber günstig!', "That's really cheap!")]}],
           [('345', 'dreihundert + fünfundvierzig'), ('9,99 €', 'neun Euro neunundneunzig'),
            ('Comma', 'for decimals: 4,50'), ('1.000', 'a point groups thousands')],
           'Numbers and prices', [
               listen('250', ['250', '205', '520'], say='zweihundertfünfzig'),
               listen('317', ['317', '371', '713'], say='dreihundertsiebzehn'),
               listen('1.200', ['1.200', '2.100', '1.020'], say='tausendzweihundert'),
               listen('68', ['68', '86', '58'], say='achtundsechzig'),
               listen('9,99 €', ['9,99 €', '19,90 €', '9,90 €'], say='neun Euro neunundneunzig'),
               listen('4,50 €', ['4,50 €', '5,40 €', '14,50 €'], say='vier Euro fünfzig'),
               pick('How do you say 145?', 'hundertfünfundvierzig',
                    ['hundertfünfundvierzig', 'hundertvierundfünfzig', 'hundertvierzigfünf']),
               pick('How do you say 2 000?', 'zweitausend', ['zweitausend', 'zweihundert', 'zwanzigtausend']),
               pick('How do you say 0,80 €?', 'achtzig Cent', ['achtzig Cent', 'null Euro acht', 'acht Cent']),
               gap('Der Tisch kostet ', 'neunundneunzig', ' Euro.', ['neunundneunzig', 'neunzigneun', 'neunundneunzehn'],
                   'The table costs 99 euros.'),
               write_de('How much is the lamp?', 'Wie viel kostet die Lampe?', alts=['Was kostet die Lampe?']),
               dictation('vierhundertzwanzig', 'Write the number you hear as one word.', alts=['420']),
           ]),
    lesson('g4-things', 'G5', 'Was ist das? Describing things', ['4.15', '4.16', '4.12'],
           ['To name a thing, use <em class="de">ein / eine</em>: <em class="de">Das ist ein Schlüssel.</em> '
            'To say it is not, use <em class="de">kein / keine</em>: <em class="de">Das ist kein Schlüssel.</em>',
            'To describe it, say what it is made of with <strong>aus</strong> and give its colour: '
            '<em class="de">Die Tasche ist aus Leder. Sie ist braun.</em>'],
           [{'step': 'Naming', 'title': 'ein, kein and the pronoun',
             'table': {'head': ['', 'der', 'das', 'die'],
                       'rows': [['a', 'ein Schlüssel', 'ein Heft', 'eine Brille'],
                                ['not a', 'kein Schlüssel', 'kein Heft', 'keine Brille'], ['it', 'er', 'es', 'sie']],
                       'say': ['ein Schlüssel, ein Heft, eine Brille', 'kein Schlüssel, kein Heft, keine Brille',
                               'er, es, sie']}},
            {'step': 'Describing', 'title': 'Material and colour', 'examples': [
                ('Ist das ein Kuli? – Nein, das ist ein Bleistift.', 'Is that a pen? – No, it is a pencil.'),
                ('Die Flasche ist aus Glas. Sie ist grün.', 'The bottle is made of glass. It is green.'),
                ('Der Stuhl ist aus Holz.', 'The chair is made of wood.'),
                ('Wie heißt das auf Deutsch? – Das ist ein Regenschirm.', 'What is that in German? – That is an umbrella.')]}],
           [('ein / eine', 'a: ein Heft, eine Tasche'), ('kein / keine', 'not a: kein Heft'),
            ('aus + material', 'aus Holz, aus Glas'), ('der → er, das → es, die → sie', 'Die Tasche? Sie ist neu.')],
           'Name it and describe it', [
               gap('Das ist ', 'eine', ' Brille.', ['eine', 'ein', 'einen'], 'Those are glasses.'),
               gap('Ist das ', 'ein', ' Schlüssel?', ['ein', 'eine', 'einen'], 'Is that a key?'),
               gap('Nein, das ist ', 'kein', ' Feuerzeug.', ['kein', 'keine', 'nicht'], "No, that isn't a lighter."),
               gap('Das ist ', 'keine', ' Tasche, das ist ein Rucksack.', ['keine', 'kein', 'nicht'],
                   "That isn't a bag, it's a backpack."),
               gap('Die Flasche ist ', 'aus', ' Plastik.', ['aus', 'von', 'in'], 'The bottle is made of plastic.'),
               gap('Der Kuli ist neu. ', 'Er', ' ist blau.', ['Er', 'Es', 'Sie'], 'The pen is new. It is blue.'),
               gap('Das Heft ist alt. ', 'Es', ' ist aus Papier.', ['Es', 'Er', 'Sie'],
                   'The exercise book is old. It is made of paper.'),
               gap('Die Kette ist schön. ', 'Sie', ' ist aus Metall.', ['Sie', 'Er', 'Es'],
                   'The necklace is beautiful. It is made of metal.'),
               pick('What is an umbrella (Regenschirm) usually made of?', 'aus Stoff und Metall',
                    ['aus Stoff und Metall', 'aus Papier', 'aus Glas'], say='Der Regenschirm ist aus Stoff und Metall.'),
               order('Die Tasche ist aus Leder.', 'The bag is made of leather.'),
               order('Wie heißt das auf Deutsch?', 'What is that called in German?'),
               write_de('That is not a key.', 'Das ist kein Schlüssel.'),
           ]),
    reading('g4-reading', 'R1', 'A new room', ['4.9', '4.18'], READ_INTRO, 'Ein Zimmer in Leipzig', [
        'Yonas wohnt jetzt in Leipzig. Er hat ein Zimmer in einer WG. Das Zimmer ist klein, aber hell.',
        'Er braucht noch Möbel. Am Samstag geht er mit Lena in ein Möbelgeschäft.',
        'Lena: Schau mal, der Sessel! Er ist so schön. – Yonas: Ja, aber er ist zu groß für mein Zimmer.',
        'Yonas: Wie viel kostet der Tisch? – Verkäufer: Nur 49 Euro. Das ist ein Sonderangebot. Er ist aus Holz. – '
        'Yonas: Das ist aber günstig! Ich nehme den Tisch.'],
        [('die WG', 'the shared flat'), ('hell', 'bright'), ('noch', 'still'), ('die Möbel', 'the furniture (pl.)'),
         ('das Möbelgeschäft', 'the furniture shop'), ('der Verkäufer', 'the salesman')], [
            tf('Yonas wohnt in Leipzig.', True),
            tf('Das Zimmer ist groß.', False, why='Das Zimmer ist klein, aber hell.'),
            tf('Lena findet den Sessel schön.', True),
            tf('Yonas kauft den Sessel.', False, why='Der Sessel ist zu groß für sein Zimmer.'),
            tf('Der Tisch ist aus Metall.', False, why='Er ist aus Holz.'),
            pick('Wie viel kostet der Tisch?', '49 Euro', ['49 Euro', '94 Euro', '19 Euro'], hint='How much is the table?'),
            pick('Wann geht Yonas ins Möbelgeschäft?', 'am Samstag', ['am Samstag', 'am Sonntag', 'heute'],
                 hint='When does Yonas go to the furniture shop?'),
            answer_de('Was nimmt Yonas?', 'Er nimmt den Tisch.', alts=['den Tisch', 'Den Tisch.']),
            write_en('Das ist aber günstig!', "That's really cheap!",
                     alts=['That is cheap!', 'That is really cheap!', "That's cheap!", "That's good value!"]),
        ]),
])

# ---------------------------------------------------------------- Unit 5 additions
extend(UNIT5, sections=[
    sec('5.12', 'Times of day', [
        ('der Vormittag', 'the late morning (m.)'), ('der Mittag', 'midday (m.)'), ('der Nachmittag', 'the afternoon (m.)'),
        ('am Morgen', 'in the morning'), ('am Vormittag', 'in the late morning'), ('am Nachmittag', 'in the afternoon'),
        ('am Abend', 'in the evening'), ('in der Nacht', 'at night'), ('heute Abend', 'this evening'),
        ('morgen früh', 'tomorrow morning'), ('das Wochenende', 'the weekend (n.)'), ('am Wochenende', 'at the weekend')]),
    sec('5.13', 'Going out', [
        ('das Kino', 'the cinema (n.)'), ('das Museum', 'the museum (n.)'), ('das Theater', 'the theatre (n.)'),
        ('das Café', 'the café (n.)'), ('das Konzert', 'the concert (n.)'), ('das Restaurant', 'the restaurant (n.)'),
        ('das Fitnessstudio', 'the gym (n.)'), ('die Bar', 'the bar (f.)'), ('ins Kino gehen', 'to go to the cinema'),
        ('ins Konzert gehen', 'to go to a concert'), ('spazieren gehen', 'to go for a walk')]),
    sec('5.14', 'Making a date', [
        ('Hast du am Samstag Zeit?', 'Are you free on Saturday?'), ('Gehen wir ins Kino?', 'Shall we go to the cinema?'),
        ('Lust auf Kaffee?', 'Fancy a coffee?'), ('Gute Idee!', 'Good idea!'), ('Ja, gern.', "Yes, I'd like to."),
        ('Vielleicht.', 'Maybe.'), ('Tut mir leid, ich kann leider nicht.', "Sorry, I can't."),
        ('Am Abend habe ich keine Zeit.', "I'm not free in the evening."), ('Wann denn?', 'When, then?'),
        ('Um wie viel Uhr?', 'At what time?'), ('Bis dann!', 'See you then!')]),
    sec('5.15', 'wissen (to know)', [
        ('wissen', 'to know (a fact)'), ('ich weiß', 'I know'), ('du weißt', 'you know'), ('er weiß', 'he knows'),
        ('wir wissen', 'we know'), ('Das weiß ich noch nicht.', "I don't know yet."),
        ('Weißt du, wo das Kino ist?', 'Do you know where the cinema is?')]),
], grammar=[
    lesson('g5-am-um', 'G5', 'When? am, um, in der, im', ['5.12', '5.6'],
           ['Use <strong>am</strong> with days and parts of the day: <em class="de">am Montag, am Abend, am Wochenende</em>.',
            'Use <strong>um</strong> with clock times: <em class="de">um acht Uhr, um halb vier</em>.',
            'Two more to learn: <em class="de">in der Nacht</em> (at night), and <strong>im</strong> with months and '
            'seasons: <em class="de">im Mai, im Winter</em>.'],
           [{'step': 'Which word?', 'title': 'Time words at a glance',
             'table': {'head': ['Word', 'Use', 'Examples'],
                       'rows': [['am', 'days, parts of the day', 'am Freitag, am Nachmittag'],
                                ['um', 'clock times', 'um 9 Uhr, um Viertel nach drei'],
                                ['in der', 'the night', 'in der Nacht'], ['im', 'months, seasons', 'im Juli, im Sommer']],
                       'say': ['am Freitag, am Nachmittag', 'um 9 Uhr, um Viertel nach drei', 'in der Nacht',
                               'im Juli, im Sommer'], 'highlight': 0}},
            {'step': 'In sentences', 'title': 'Planning the week', 'examples': [
                ('Am Samstag gehe ich ins Kino.', 'On Saturday I am going to the cinema.'),
                ('Der Film beginnt um acht Uhr.', 'The film starts at eight.'),
                ('Am Montag um zehn habe ich einen Termin.', 'On Monday at ten I have an appointment.'),
                ('In der Nacht schlafe ich.', 'At night I sleep.'),
                ('Im Juli regnet es in Addis viel.', 'In July it rains a lot in Addis.')]}],
           [('am', 'Montag, Abend, Wochenende'), ('um', '8 Uhr, halb vier'), ('in der Nacht', 'the one exception'),
            ('im', 'Mai, Sommer')],
           'am, um, in der or im?', [
               gap('', 'Am', ' Montag habe ich Deutschkurs.', ['Am', 'Um', 'Im'], 'On Monday I have German class.'),
               gap('Der Kurs beginnt ', 'um', ' neun Uhr.', ['um', 'am', 'im'], 'The course starts at nine.'),
               gap('', 'Am', ' Abend sehe ich fern.', ['Am', 'Um', 'In der'], 'In the evening I watch TV.'),
               gap('', 'In der', ' Nacht schlafe ich.', ['In der', 'Am', 'Um'], 'At night I sleep.'),
               gap('Wir treffen uns ', 'um', ' halb vier.', ['um', 'am', 'im'], "We're meeting at half past three."),
               gap('Ich habe ', 'im', ' Mai Geburtstag.', ['im', 'am', 'um'], 'My birthday is in May.'),
               gap('Was machst du ', 'am', ' Wochenende?', ['am', 'im', 'um'], 'What are you doing at the weekend?'),
               gap('', 'Im', ' Sommer ist es heiß.', ['Im', 'Am', 'Um'], 'In summer it is hot.'),
               order('Am Samstag gehe ich ins Kino.', 'On Saturday I am going to the cinema.',
                     alts=['Ich gehe am Samstag ins Kino.']),
               order('Der Film beginnt um acht Uhr.', 'The film starts at eight.', alts=['Um acht Uhr beginnt der Film.']),
               order('Am Abend habe ich keine Zeit.', "I'm not free in the evening.", alts=['Ich habe am Abend keine Zeit.']),
               write_de('on Friday at seven', 'am Freitag um sieben',
                        alts=['am Freitag um sieben Uhr', 'am Freitag um 7', 'am Freitag um 7 Uhr']),
           ]),
    lesson('g5-plans', 'G6', 'Making plans: yes, no, maybe', ['5.14', '5.15'],
           ['To suggest something: <em class="de">Gehen wir ins Kino?</em>, <em class="de">Hast du am Samstag Zeit?</em> '
            'or, casually, <em class="de">Lust auf Kaffee?</em>',
            'Answer yes (<em class="de">Ja, gern! Gute Idee!</em>), maybe (<em class="de">Vielleicht. Das weiß ich noch '
            'nicht.</em>) or no, politely (<em class="de">Tut mir leid, ich kann leider nicht.</em>).',
            'The verb <em class="de">wissen</em> (to know a fact) is irregular: ich weiß, du weißt, er weiß.'],
           [{'step': 'The forms', 'title': 'wissen',
             'table': {'head': ['Person', 'wissen'],
                       'rows': [['ich', 'weiß'], ['du', 'weißt'], ['er / sie / es', 'weiß'], ['wir', 'wissen'],
                                ['ihr', 'wisst'], ['sie / Sie', 'wissen']],
                       'say': ['ich weiß', 'du weißt', 'er weiß', 'wir wissen', 'ihr wisst', 'sie wissen'], 'highlight': 1}},
            {'step': 'Listen', 'title': 'Suggest and answer', 'examples': [
                ('Hast du heute Abend Zeit? – Ja, gern!', "Are you free tonight? – Yes, I'd love to!"),
                ('Gehen wir ins Museum? – Gute Idee! Wann denn?', 'Shall we go to the museum? – Good idea! When?'),
                ('Lust auf Kaffee? – Tut mir leid, ich kann leider nicht.', "Fancy a coffee? – Sorry, I can't."),
                ('Was machst du am Sonntag? – Das weiß ich noch nicht.', "What are you doing on Sunday? – I don't know yet.")]}],
           [('Suggest', 'Gehen wir …? Hast du … Zeit?'), ('Yes', 'Ja, gern! Gute Idee!'),
            ('No', 'Tut mir leid, ich kann leider nicht.'), ('wissen', 'ich weiß, du weißt, er weiß')],
           'Make a plan', [
               pick('Your friend asks: Gehen wir ins Kino? You want to go.', 'Ja, gern! Gute Idee!',
                    ['Ja, gern! Gute Idee!', 'Tut mir leid, ich kann leider nicht.', 'Das weiß ich noch nicht.']),
               pick('You are not free. How do you say no politely?', 'Tut mir leid, ich habe leider keine Zeit.',
                    ['Tut mir leid, ich habe leider keine Zeit.', 'Nein. Keine Lust.', 'Gute Idee!']),
               pick("You don't know yet.", 'Das weiß ich noch nicht.',
                    ['Das weiß ich noch nicht.', 'Das weißt ich noch nicht.', 'Das wisse ich noch nicht.']),
               pick('How do you suggest going to a café?', 'Gehen wir ins Café?',
                    ['Gehen wir ins Café?', 'Wir gehen ins Café wir?', 'Gehen ins Café wir?']),
               gap('Ich ', 'weiß', ' es nicht.', ['weiß', 'weißt', 'wisse'], "I don't know."),
               gap('', 'Weißt', ' du, wo das Kino ist?', ['Weißt', 'Weiß', 'Wisst'], 'Do you know where the cinema is?'),
               gap('Wir ', 'wissen', ' das schon.', ['wissen', 'weiß', 'wisst'], 'We know that already.'),
               gap('Hast du am Freitag ', 'Zeit', '?', ['Zeit', 'Uhr', 'Lust'], 'Are you free on Friday?'),
               gap('', 'Lust', ' auf Kino?', ['Lust', 'Zeit', 'Idee'], 'Fancy the cinema?'),
               dialogue(['Hast du heute Abend Zeit?', 'Ja. Was machen wir?', 'Gehen wir ins Konzert?',
                         'Gute Idee! Wann denn?', 'Um acht Uhr.', 'Okay, bis dann!'], 'Making a plan'),
               dialogue(['Lust auf Kaffee?', 'Tut mir leid, heute habe ich keine Zeit.', 'Und morgen?',
                         'Morgen kann ich. Am Nachmittag?', 'Ja, um drei Uhr!'], 'Another day'),
               order('Hast du am Samstag Zeit?', 'Are you free on Saturday?'),
           ]),
    reading('g5-reading', 'R1', 'Messages', ['5.14', '5.12'], READ_INTRO, 'Selam und Dawit schreiben', [
        'Selam: Hallo Dawit! Hast du heute Nachmittag Zeit? Gehen wir ins Museum?',
        'Dawit: Tut mir leid, heute kann ich leider nicht. Am Nachmittag arbeite ich. Aber am Abend habe ich Zeit.',
        'Selam: Am Abend ist das Museum zu. Lust auf Kino? Der Film beginnt um Viertel nach acht.',
        'Dawit: Gute Idee! Ich hole dich um halb acht ab. Bis dann!'],
        [('zu', 'closed'), ('der Film', 'the film'), ('Ich hole dich ab.', "I'll pick you up.")], [
            tf('Selam möchte ins Museum gehen.', True),
            tf('Dawit hat am Nachmittag Zeit.', False, why='Am Nachmittag arbeitet er.'),
            tf('Am Abend ist das Museum offen.', False, why='Am Abend ist das Museum zu.'),
            tf('Selam und Dawit gehen am Abend ins Kino.', True),
            pick('Wann beginnt der Film?', 'um Viertel nach acht',
                 ['um Viertel nach acht', 'um halb acht', 'um Viertel vor acht'], hint='When does the film start?'),
            pick('Wann holt Dawit Selam ab?', 'um halb acht', ['um halb acht', 'um halb neun', 'um acht'],
                 hint='When does Dawit pick Selam up?'),
            answer_de('Was macht Dawit am Nachmittag?', 'Er arbeitet.', alts=['Er arbeitet am Nachmittag.']),
            write_en('Am Abend habe ich Zeit.', 'I am free in the evening.',
                     alts=['I have time in the evening.', 'In the evening I have time.', "I'm free in the evening.",
                           'In the evening I am free.']),
        ]),
])

# ---------------------------------------------------------------- Unit 6 additions
extend(UNIT6, sections=[
    sec('6.12', 'How often?', [
        ('immer', 'always'), ('manchmal', 'sometimes'), ('selten', 'rarely'), ('nie', 'never'),
        ('fast nie', 'hardly ever'), ('jeden Tag', 'every day'), ('Wie oft …?', 'How often …?'),
        ('Ich koche oft.', 'I often cook.'), ('Ich tanze nie.', 'I never dance.')]),
    sec('6.13', 'Compliments & opinions', [
        ('Du kannst toll tanzen!', 'You dance really well!'), ('Sie können super kochen!', 'You are a great cook! (formal)'),
        ('Vielen Dank!', 'Many thanks!'), ('Herzlichen Dank!', 'Thank you so much!'),
        ('Ich finde das toll.', 'I think that is great.'), ('Ich finde das lustig.', 'I think that is funny.'),
        ('Ich finde das komisch.', 'I think that is strange.'), ('Ich finde das blöd.', 'I think that is stupid.'),
        ('Das macht Spaß.', 'That is fun.'), ('wirklich', 'really')]),
    sec('6.14', 'More free-time activities', [
        ('singen', 'to sing'), ('backen', 'to bake'), ('reiten', 'to ride (a horse)'), ('fotografieren', 'to take photos'),
        ('Schach spielen', 'to play chess'), ('Ski fahren', 'to ski'), ('Rad fahren', 'to cycle'),
        ('Tennis spielen', 'to play tennis'), ('in der Freizeit', 'in your free time'),
        ('Mein Hobby ist Lesen.', 'My hobby is reading.'), ('Ich lese gern.', 'I like reading.')]),
], grammar=[
    lesson('g6-how-often', 'G2', 'How well and how often', ['6.12', '6.13'],
           ['To say how well you do something, add a word after the verb: <em class="de">Ich koche gut.</em> '
            'With können, it goes before the verb at the end: <em class="de">Ich kann gut kochen.</em>',
            'From worst to best: <em class="de">gar nicht → nicht so gut → ein bisschen → gut → sehr gut → super / toll</em>.',
            'How often: <em class="de">nie → selten → manchmal → oft → immer</em>. These words usually come right after '
            'the verb: <em class="de">Ich koche oft.</em>'],
           [{'step': 'How often?', 'title': 'From always to never',
             'table': {'head': ['', 'Word', 'Example'],
                       'rows': [['100 %', 'immer', 'Ich trinke immer Kaffee.'], ['', 'oft', 'Ich koche oft.'],
                                ['', 'manchmal', 'Ich tanze manchmal.'], ['', 'selten', 'Ich gehe selten ins Kino.'],
                                ['0 %', 'nie', 'Ich rauche nie.']],
                       'say': ['Ich trinke immer Kaffee.', 'Ich koche oft.', 'Ich tanze manchmal.',
                               'Ich gehe selten ins Kino.', 'Ich rauche nie.'], 'highlight': 1}},
            {'step': 'How well?', 'title': 'Talking about what you can do', 'examples': [
                ('Ich kann gar nicht singen.', "I can't sing at all."),
                ('Er kann ein bisschen Gitarre spielen.', 'He can play the guitar a little.'),
                ('Wir können sehr gut tanzen.', 'We can dance very well.'),
                ('Du kannst wirklich toll backen! – Oh, danke!', 'You bake really well! – Oh, thanks!')]}],
           [('How well', 'gar nicht → ein bisschen → gut → sehr gut'), ('How often', 'nie → manchmal → oft → immer'),
            ('Position', 'after the verb: Ich koche oft.'), ('Compliment', 'Du kannst toll …! – Danke!')],
           'How well? How often?', [
               pick('Which word means the most often?', 'immer', ['immer', 'oft', 'manchmal']),
               pick('Which word means "never"?', 'nie', ['nie', 'immer', 'selten']),
               pick('Which is the best?', 'sehr gut', ['sehr gut', 'ein bisschen', 'nicht so gut']),
               pick('Which means "not at all"?', 'gar nicht', ['gar nicht', 'nicht so gut', 'nie']),
               gap('Ich trinke ', 'nie', ' Kaffee. Ich mag keinen Kaffee.', ['nie', 'immer', 'oft'],
                   "I never drink coffee. I don't like coffee."),
               gap('Wir essen ', 'jeden Tag', ' Injera.', ['jeden Tag', 'nie', 'gar nicht'], 'We eat injera every day.'),
               gap('Du kannst wirklich ', 'toll', ' tanzen!', ['toll', 'nie', 'gar nicht'], 'You dance really well!'),
               pick('Your friend says: Du kannst super kochen! What do you answer?', 'Oh, danke!',
                    ['Oh, danke!', 'Bitte schön!', 'Gute Idee!']),
               order('Ich gehe oft ins Kino.', 'I often go to the cinema.'),
               order('Kannst du gut schwimmen?', 'Can you swim well?'),
               order('Er kann ein bisschen Gitarre spielen.', 'He can play the guitar a little.'),
               write_de('I never dance.', 'Ich tanze nie.'),
           ]),
    lesson('g6-vowel-e', 'G3', 'Verbs that change e → i or ie', ['6.14', '6.4'],
           ['Some common verbs change the vowel of their stem with <strong>du</strong> and <strong>er/sie/es</strong>. '
            'All the other forms stay regular.',
            '<em class="de">e → ie</em>: lesen (du liest), sehen (du siehst). <em class="de">e → i</em>: treffen '
            '(du triffst), essen (du isst), nehmen (du nimmst), sprechen (du sprichst).'],
           [{'step': 'The forms', 'title': 'lesen, treffen, essen',
             'table': {'head': ['Person', 'lesen', 'treffen', 'essen'],
                       'rows': [['ich', 'lese', 'treffe', 'esse'], ['du', 'liest', 'triffst', 'isst'],
                                ['er / sie / es', 'liest', 'trifft', 'isst'], ['wir', 'lesen', 'treffen', 'essen'],
                                ['ihr', 'lest', 'trefft', 'esst'], ['sie / Sie', 'lesen', 'treffen', 'essen']],
                       'say': ['ich lese, ich treffe, ich esse', 'du liest, du triffst, du isst',
                               'er liest, er trifft, er isst', 'wir lesen, wir treffen, wir essen',
                               'ihr lest, ihr trefft, ihr esst', 'sie lesen, sie treffen, sie essen']}},
            {'step': 'In sentences', 'title': 'Free time', 'examples': [
                ('Liest du gern?', 'Do you like reading?'), ('Er trifft am Samstag Freunde.', 'He is meeting friends on Saturday.'),
                ('Selam sieht gern Filme.', 'Selam likes watching films.'),
                ('Was isst du zum Frühstück?', 'What do you eat for breakfast?'),
                ('Sie spricht drei Sprachen.', 'She speaks three languages.')]}],
           [('e → ie', 'lesen: du liest; sehen: er sieht'), ('e → i', 'treffen: du triffst; essen: er isst'),
            ('Only du and er/sie/es', 'ich lese, wir lesen: no change')],
           'Choose the right form', [
               gap('', 'Liest', ' du gern Bücher?', ['Liest', 'Lest', 'Lesst'], 'Do you like reading books?'),
               gap('Er ', 'liest', ' die Zeitung.', ['liest', 'lest', 'lesen'], 'He reads the newspaper.'),
               gap('Ich ', 'lese', ' gern.', ['lese', 'liest', 'les'], 'I like reading.', why='ich: no vowel change.'),
               gap('Du ', 'triffst', ' Freunde.', ['triffst', 'treffst', 'triffs'], 'You are meeting friends.'),
               gap('Meron ', 'trifft', ' heute Hanna.', ['trifft', 'treffet', 'triffst'], 'Meron is meeting Hanna today.'),
               gap('Wir ', 'treffen', ' uns um acht.', ['treffen', 'trifft', 'triffen'], "We're meeting at eight."),
               gap('', 'Siehst', ' du den Bus?', ['Siehst', 'Sehst', 'Sieht'], 'Can you see the bus?'),
               gap('Dawit ', 'isst', ' gern Fisch.', ['isst', 'esst', 'ist'], 'Dawit likes eating fish.',
                   why='isst (eats) is not ist (is).'),
               gap('Was ', 'sprichst', ' du?', ['sprichst', 'sprechst', 'spricht'], 'Which language do you speak?'),
               gap('Ihr ', 'lest', ' viel.', ['lest', 'liest', 'lesen'], 'You (all) read a lot.', why='ihr: no vowel change.'),
               write_de('She reads a lot.', 'Sie liest viel.'),
               order('Er trifft am Samstag Freunde.', 'He is meeting friends on Saturday.',
                     alts=['Am Samstag trifft er Freunde.']),
           ]),
    reading('g6-reading', 'R1', 'Free time', ['6.4', '6.12'], READ_INTRO, 'Familie Abebe in der Freizeit', [
        'Tigist ist 34 und wohnt in Bahir Dar. Sie arbeitet als Krankenschwester. In der Freizeit liest sie gern und '
        'sie geht oft am See spazieren.',
        'Ihr Mann Abebe kann sehr gut kochen. Am Wochenende kocht er immer für die Familie. Tigist kocht nie, sie findet '
        'Kochen langweilig.',
        'Ihre Tochter Liya ist zwölf. Sie spielt Fußball und kann super schwimmen. Ihr Sohn Kaleb fotografiert gern. '
        'Er macht manchmal Fotos für eine Zeitung.'],
        [('die Krankenschwester', 'the nurse'), ('der See', 'the lake'), ('für die Familie', 'for the family'),
         ('langweilig', 'boring'), ('die Zeitung', 'the newspaper')], [
            tf('Tigist wohnt in Bahir Dar.', True),
            tf('Tigist kocht oft.', False, why='Tigist kocht nie.'),
            tf('Abebe kann sehr gut kochen.', True),
            tf('Liya kann nicht schwimmen.', False, why='Sie kann super schwimmen.'),
            tf('Kaleb fotografiert gern.', True),
            pick('Was macht Tigist in der Freizeit?', 'Sie liest und geht spazieren.',
                 ['Sie liest und geht spazieren.', 'Sie spielt Fußball.', 'Sie kocht.'],
                 hint='What does Tigist do in her free time?'),
            pick('Wie findet Tigist Kochen?', 'langweilig', ['langweilig', 'toll', 'lustig'],
                 hint='What does Tigist think of cooking?'),
            answer_de('Wie alt ist Liya?', 'Sie ist zwölf.', alts=['Zwölf.', 'Sie ist zwölf Jahre alt.', '12', 'Sie ist 12.']),
        ]),
])

# ---------------------------------------------------------------- Unit 7 additions
extend(UNIT7, sections=[
    sec('7.11', 'Talking about work', [
        ('Was sind Sie von Beruf?', 'What do you do? (formal)'), ('Was machst du beruflich?', 'What do you do for a living?'),
        ('Ich bin Lehrerin von Beruf.', 'I am a teacher by profession.'), ('Ich arbeite als Krankenpfleger.', 'I work as a nurse.'),
        ('Ich arbeite bei Ethiopian Airlines.', 'I work for Ethiopian Airlines.'), ('Ich studiere Medizin.', 'I study medicine.'),
        ('Ich mache eine Ausbildung.', 'I am doing vocational training.'), ('Ich mache ein Praktikum.', 'I am doing an internship.'),
        ('Ich arbeite im Moment nicht.', "I'm not working at the moment."), ('der Student', 'the student (m.)'),
        ('die Studentin', 'the student (f.)'), ('der Rentner', 'the pensioner (m.)'), ('die Rentnerin', 'the pensioner (f.)')]),
    sec('7.12', 'At the office', [
        ('der Computer', 'the computer (m.)'), ('der Laptop', 'the laptop (m.)'), ('der Drucker', 'the printer (m.)'),
        ('die Maus', 'the mouse (f.)'), ('die Tastatur', 'the keyboard (f.)'), ('der Bildschirm', 'the screen (m.)'),
        ('das Passwort', 'the password (n.)'), ('die Nachricht', 'the message (f.)'), ('der Termin', 'the appointment (m.)'),
        ('der Kalender', 'the calendar (m.)'), ('der Stift', 'the pen (m.)'), ('das Tablet', 'the tablet (n.)'),
        ('das WLAN', 'the Wi-Fi (n.)'), ('die Visitenkarte', 'the business card (f.)'), ('Ich brauche einen Stift.', 'I need a pen.')]),
    sec('7.13', 'On the phone', [
        ('Firma Kebede, guten Tag!', 'Kebede company, hello!'), ('Hier ist Selam Tesfaye.', 'This is Selam Tesfaye.'),
        ('Was kann ich für Sie tun?', 'What can I do for you?'), ('Ist Frau Bekele da?', 'Is Ms Bekele there?'),
        ('Einen Moment, bitte.', 'One moment, please.'), ('Sie ist leider nicht da.', "I'm afraid she isn't here."),
        ('Auf Wiederhören!', 'Goodbye! (on the phone)'), ('telefonieren', 'to make a phone call')]),
], grammar=[
    lesson('g7-jobs', 'G4', 'Jobs: -in, als and bei', ['7.1', '7.11'],
           ['Most jobs have a male and a female form. The female form usually adds <strong>-in</strong>: '
            '<em class="de">der Lehrer → die Lehrerin</em>. Some also get an umlaut: <em class="de">der Arzt → die Ärztin, '
            'der Koch → die Köchin</em>.',
            'When you say your job, you do not use ein/eine: <em class="de">Ich bin Lehrer.</em> (I am a teacher.)',
            '<strong>als</strong> = as (your role), <strong>bei</strong> = at, for (the company): '
            '<em class="de">Ich arbeite als Pilotin bei Ethiopian Airlines.</em>'],
           [{'step': 'Male and female', 'title': 'Add -in',
             'table': {'head': ['Male', 'Female'],
                       'rows': [['der Lehrer', 'die Lehrerin'], ['der Verkäufer', 'die Verkäuferin'],
                                ['der Student', 'die Studentin'], ['der Arzt', 'die Ärztin'], ['der Koch', 'die Köchin'],
                                ['der Krankenpfleger', 'die Krankenpflegerin']],
                       'say': ['der Lehrer, die Lehrerin', 'der Verkäufer, die Verkäuferin', 'der Student, die Studentin',
                               'der Arzt, die Ärztin', 'der Koch, die Köchin', 'der Krankenpfleger, die Krankenpflegerin'],
                       'highlight': 1}},
            {'step': 'In sentences', 'title': 'Talking about your job', 'examples': [
                ('Was sind Sie von Beruf? – Ich bin Ingenieurin.', 'What do you do? – I am an engineer.'),
                ('Ich arbeite als Kellner.', 'I work as a waiter.'), ('Sie arbeitet bei einer Bank.', 'She works at a bank.'),
                ('Er ist Student. Er studiert Informatik.', 'He is a student. He studies computer science.'),
                ('Ich arbeite im Moment nicht.', "I'm not working at the moment.")]}],
           [('-in', 'Lehrer → Lehrerin'), ('Umlaut', 'Arzt → Ärztin'), ('No ein', 'Ich bin Lehrer.'),
            ('als / bei', 'als Pilot bei Ethiopian Airlines')],
           'Jobs', [
               pick('The female form of der Lehrer:', 'die Lehrerin', ['die Lehrerin', 'die Lehrer', 'die Lehrerinne']),
               pick('The female form of der Arzt:', 'die Ärztin', ['die Ärztin', 'die Arztin', 'die Ärzte']),
               pick('The female form of der Koch:', 'die Köchin', ['die Köchin', 'die Kochin', 'die Köchen']),
               pick('How do you say "I am a teacher"?', 'Ich bin Lehrer.',
                    ['Ich bin Lehrer.', 'Ich bin als Lehrer.', 'Ich bin bei Lehrer.'], why='No ein/eine with jobs.'),
               gap('Ich arbeite ', 'als', ' Kellnerin.', ['als', 'bei', 'in'], 'I work as a waitress.'),
               gap('Er arbeitet ', 'bei', ' Siemens.', ['bei', 'als', 'in'], 'He works at Siemens.'),
               gap('Meron arbeitet als Ärztin ', 'in', ' einem Krankenhaus.', ['in', 'bei', 'als'],
                   'Meron works as a doctor in a hospital.'),
               gap('Ich bin Lehrerin ', 'von', ' Beruf.', ['von', 'als', 'bei'], 'I am a teacher by profession.'),
               gap('Was machst du ', 'beruflich', '?', ['beruflich', 'Beruf', 'arbeiten'], 'What do you do for a living?'),
               order('Ich arbeite als Krankenpfleger.', 'I work as a nurse.'),
               order('Was sind Sie von Beruf?', 'What do you do? (formal)'),
               write_de('I am a student. (said by a woman)', 'Ich bin Studentin.'),
           ]),
    lesson('g7-phone', 'G5', 'On the phone and at the office', ['7.13', '7.12'],
           ['Phone calls follow a fixed pattern. A company answers with its name: <em class="de">Firma Kebede, guten Tag!</em> '
            'You say who you are: <em class="de">Hier ist …</em> or <em class="de">Mein Name ist …</em>',
            'At the end you do not say Auf Wiedersehen ("see you again") but <strong>Auf Wiederhören</strong> '
            '("hear you again").',
            'Office words often come in the accusative: <em class="de">Ich brauche einen Stift. Haben Sie den Kalender?</em>'],
           [{'step': 'A call', 'title': 'Phone phrases', 'examples': [
               ('Firma Kebede, guten Tag!', 'Kebede company, hello!'),
               ('Guten Tag, hier ist Selam Tesfaye.', 'Hello, this is Selam Tesfaye.'),
               ('Was kann ich für Sie tun?', 'What can I do for you?'), ('Ist Herr Bekele da?', 'Is Mr Bekele there?'),
               ('Einen Moment, bitte. Er ist leider nicht da.', "One moment, please. I'm afraid he isn't here."),
               ('Vielen Dank. Auf Wiederhören!', 'Thank you. Goodbye!')]},
            {'step': 'At the office', 'title': 'Nominative and accusative',
             'table': {'head': ['', 'der', 'das', 'die'],
                       'rows': [['Wo ist …?', 'der Kalender', 'das Tablet', 'die Maus'],
                                ['Ich brauche …', 'den Kalender', 'das Tablet', 'die Maus'],
                                ['Ich habe …', 'einen Stift', 'ein Tablet', 'eine Maus'],
                                ['Ich habe …', 'keinen Stift', 'kein Passwort', 'keine Maus']],
                       'say': ['der Kalender, das Tablet, die Maus', 'den Kalender, das Tablet, die Maus',
                               'einen Stift, ein Tablet, eine Maus', 'keinen Stift, kein Passwort, keine Maus'],
                       'highlight': 1}}],
           [('Answer', 'Firma …, guten Tag!'), ('Introduce yourself', 'Hier ist … / Mein Name ist …'),
            ('Goodbye', 'Auf Wiederhören!'), ('der → den / einen', 'Ich brauche einen Stift.')],
           'Phone and office', [
               dialogue(['Firma Kebede, guten Tag!', 'Guten Tag, hier ist Selam Tesfaye.',
                         'Guten Tag, Frau Tesfaye. Was kann ich für Sie tun?', 'Ist Herr Bekele da?',
                         'Einen Moment, bitte … Herr Bekele ist leider nicht da.', 'Okay, vielen Dank. Auf Wiederhören!'],
                        'A phone call to a company'),
               pick('How do you end a phone call?', 'Auf Wiederhören!', ['Auf Wiederhören!', 'Auf Wiedersehen!', 'Gute Nacht!']),
               pick('You call a company. How do you introduce yourself?', 'Hier ist Dawit Girma.',
                    ['Hier ist Dawit Girma.', 'Da ist Dawit Girma.', 'Ich heiße hier Dawit Girma.']),
               pick('The person is not there. What does the secretary say?', 'Sie ist leider nicht da.',
                    ['Sie ist leider nicht da.', 'Sie ist leider kein da.', 'Sie ist leider da nicht.']),
               gap('Ich brauche ', 'einen', ' Stift.', ['einen', 'ein', 'eine'], 'I need a pen.',
                   why='der Stift → einen Stift (accusative).'),
               gap('Haben Sie ', 'den', ' Kalender?', ['den', 'der', 'dem'], 'Do you have the calendar?'),
               gap('Ich habe ', 'kein', ' Passwort.', ['kein', 'keinen', 'keine'], "I don't have a password.",
                   why='das Passwort → kein Passwort (no change).'),
               gap('Wo ist ', 'die', ' Maus?', ['die', 'den', 'der'], 'Where is the mouse?', why='Wo ist …? takes the nominative.'),
               gap('Wir haben morgen ', 'einen', ' Termin.', ['einen', 'ein', 'eine'], 'We have an appointment tomorrow.'),
               gap('Ich komme nicht ins ', 'WLAN', '.', ['WLAN', 'Passwort', 'Drucker'], "I can't get onto the Wi-Fi."),
               pick('The plural of der Termin:', 'die Termine', ['die Termine', 'die Terminen', 'die Termins']),
               pick('The plural of das Passwort:', 'die Passwörter', ['die Passwörter', 'die Passworte', 'die Passworts']),
           ]),
    reading('g7-reading', 'R1', 'A day at the office', ['7.12', '7.13'], READ_INTRO, 'Ein Montag im Büro', [
        'Meron Haile arbeitet als Assistentin bei einer Firma in Addis Abeba. Heute ist Montag und sie hat viel Arbeit.',
        'Um neun Uhr hat sie einen Termin mit Jan Weber aus Deutschland. Aber wo ist der Kalender? Und ihr Passwort ist falsch!',
        'Ihr Kollege Samuel hilft: „Das Passwort ist neu. Hier ist es.“ Dann ruft Jan Weber an: „Guten Tag, Frau Haile. '
        'Ich komme leider zu spät. Ich bin im Taxi.“',
        'Meron sagt: „Kein Problem. Bis gleich!“ Jetzt braucht sie einen Kaffee.'],
        [('die Firma', 'the company'), ('viel Arbeit', 'a lot of work'), ('falsch', 'wrong'),
         ('der Kollege', 'the colleague'), ('hilft', 'helps'), ('zu spät', 'late'), ('Bis gleich!', 'See you soon!')], [
            tf('Meron arbeitet bei einer Firma in Addis Abeba.', True),
            tf('Der Termin ist um zehn Uhr.', False, why='Der Termin ist um neun Uhr.'),
            tf('Merons Passwort ist neu.', True),
            tf('Jan Weber kommt pünktlich.', False, why='Er kommt zu spät. Er ist im Taxi.'),
            tf('Meron braucht einen Tee.', False, why='Sie braucht einen Kaffee.'),
            pick('Wer hilft Meron?', 'Samuel', ['Samuel', 'Jan Weber', 'Frau Haile'], hint='Who helps Meron?'),
            pick('Woher kommt Jan Weber?', 'aus Deutschland', ['aus Deutschland', 'aus Äthiopien', 'aus Österreich'],
                 hint='Where is Jan Weber from?'),
            write_en('Ich komme leider zu spät.', "Unfortunately, I'm late.",
                     alts=["I'm afraid I'm late.", "Sorry, I'm late.", 'Unfortunately I am late.',
                           'Unfortunately I am coming too late.', "I'm sorry, I'm late."]),
        ]),
])

# ---------------------------------------------------------------- Unit 8: Travel & transport
UNIT8 = {
    'id': 8,
    'title': 'Travel & transport',
    'sections': [
        sec('8.1', 'Getting around', [
            ('der Bus', 'the bus (m.)'), ('der Zug', 'the train (m.)'), ('die U-Bahn', 'the underground (f.)'),
            ('die S-Bahn', 'the suburban train (f.)'), ('die Straßenbahn', 'the tram (f.)'), ('das Taxi', 'the taxi (n.)'),
            ('das Auto', 'the car (n.)'), ('das Fahrrad', 'the bicycle (n.)'), ('das Flugzeug', 'the plane (n.)'),
            ('mit dem Bus', 'by bus'), ('mit dem Zug', 'by train'), ('mit der U-Bahn', 'by underground'),
            ('zu Fuß', 'on foot')]),
        sec('8.2', 'Station & airport', [
            ('der Bahnhof', 'the station (m.)'), ('der Hauptbahnhof', 'the main station (m.)'),
            ('der Flughafen', 'the airport (m.)'), ('die Haltestelle', 'the stop (f.)'), ('das Gleis', 'the track (n.)'),
            ('der Bahnsteig', 'the platform (m.)'), ('die Fahrkarte', 'the ticket (f.)'), ('der Flug', 'the flight (m.)'),
            ('die Verspätung', 'the delay (f.)'), ('der Ausgang', 'the exit, the gate (m.)'),
            ('die Abfahrt', 'the departure (f.)'), ('die Ankunft', 'the arrival (f.)')]),
        sec('8.3', 'Luggage', [
            ('das Gepäck', 'the luggage (n.)'), ('der Koffer', 'the suitcase (m.)'), ('der Rucksack', 'the backpack (m.)'),
            ('der Pass', 'the passport (m.)'), ('das Visum', 'the visa (n.)'), ('der Akku', 'the battery (m.)'),
            ('das Ladegerät', 'the charger (n.)')]),
        sec('8.4', 'Travel verbs', [
            ('abfahren', 'to depart'), ('ankommen', 'to arrive'), ('abfliegen', 'to fly out, take off'),
            ('abholen', 'to pick up'), ('einsteigen', 'to get on'), ('aussteigen', 'to get off'),
            ('umsteigen', 'to change (trains)'), ('fliegen', 'to fly'), ('landen', 'to land'),
            ('Ich steige in Frankfurt um.', 'I change in Frankfurt.')]),
        sec('8.5', 'On the way', [
            ('Wann kommst du an?', 'When do you arrive?'), ('Wann fliegst du ab?', 'When does your flight leave?'),
            ('Kannst du mich abholen?', 'Can you pick me up?'), ('Natürlich hole ich dich ab.', 'Of course I will pick you up.'),
            ('Hoffentlich haben wir keine Verspätung.', "Hopefully we won't be delayed."),
            ('Ich freue mich auf dich!', "I'm looking forward to seeing you!"), ('Verstehe!', 'I see!'),
            ('Alles klar!', 'All right!'), ('Bist du sicher?', 'Are you sure?'), ('Gute Reise!', 'Have a good trip!')]),
        sec('8.6', 'Announcements', [
            ('Achtung!', 'Attention!'), ('Bitte Vorsicht!', 'Please be careful!'),
            ('Der Zug fährt von Gleis 4 ab.', 'The train departs from platform 4.'),
            ('Der nächste Halt ist Frankfurt Hauptbahnhof.', 'The next stop is Frankfurt main station.'),
            ('Das Flugzeug landet um 6:40 Uhr.', 'The plane lands at 6:40.'), ('Bitte steigen Sie ein.', 'Please get on.'),
            ('die Endstation', 'the last stop (f.)')]),
    ],
    'grammar': [
        lesson('g8-separable', 'G1', 'Separable verbs on the move', ['8.4', '8.5'],
               ['Many travel verbs are separable: <em class="de">an|kommen, ab|fahren, ab|holen, ein|steigen, um|steigen</em>. '
                'In a normal sentence the small first part goes to the <strong>end</strong>: '
                '<em class="de">Ich komme um acht Uhr an.</em>',
                'The same in questions: <em class="de">Wann kommst du an? Holst du mich ab?</em>',
                'With a modal verb (können, möchten …) the verb stays in one piece at the end: '
                '<em class="de">Kannst du mich abholen?</em>'],
               [{'step': 'The bracket', 'title': 'The small part goes to the end',
                 'table': {'head': ['Start', 'Verb', 'Middle', 'End'],
                           'rows': [['Ich', 'komme', 'um acht Uhr', 'an.'], ['Wann', 'fährt', 'der Zug', 'ab?'],
                                    ['—', 'Holst', 'du mich', 'ab?'], ['Wir', 'steigen', 'in Frankfurt', 'um.'],
                                    ['—', 'Kannst', 'du mich', 'abholen?']],
                           'say': ['Ich komme um acht Uhr an.', 'Wann fährt der Zug ab?', 'Holst du mich ab?',
                                   'Wir steigen in Frankfurt um.', 'Kannst du mich abholen?'], 'highlight': 3}},
                {'step': 'In sentences', 'title': 'On the way', 'examples': [
                    ('Der Zug fährt um 7:15 Uhr ab.', 'The train leaves at 7:15.'),
                    ('Ich steige am Hauptbahnhof aus.', 'I get off at the main station.'),
                    ('Rufst du mich aus Frankfurt an?', 'Will you call me from Frankfurt?'),
                    ('Ich möchte am Freitag ankommen.', 'I would like to arrive on Friday.')]}],
               [('Statement', 'Ich komme um 8 an.'), ('Question', 'Wann kommst du an?'),
                ('With a modal verb', 'Kannst du mich abholen?'), ('Infinitive', 'one word: abholen')],
               'Separable verbs', [
                   order('Ich komme um acht Uhr an.', 'I arrive at eight.', alts=['Um acht Uhr komme ich an.']),
                   order('Wann fährt der Zug ab?', 'When does the train leave?'),
                   order('Holst du mich ab?', 'Will you pick me up?'),
                   order('Wir steigen in Frankfurt um.', 'We change in Frankfurt.', alts=['In Frankfurt steigen wir um.']),
                   order('Kannst du mich abholen?', 'Can you pick me up?'),
                   order('Der Bus fährt um zehn Uhr ab.', 'The bus leaves at ten.', alts=['Um zehn Uhr fährt der Bus ab.']),
                   gap('Wann kommst du in Berlin ', 'an', '?', ['an', 'ab', 'um'], 'When do you arrive in Berlin?'),
                   gap('Ich hole dich am Flughafen ', 'ab', '.', ['ab', 'an', 'aus'], "I'll pick you up at the airport."),
                   gap('Bitte steigen Sie hier ', 'aus', '.', ['aus', 'ein', 'um'], 'Please get off here.'),
                   gap('Wir müssen in Köln ', 'umsteigen', '.', ['umsteigen', 'steigen um', 'um steigen'],
                       'We have to change in Cologne.', why='With a modal verb, the verb stays in one piece at the end.'),
                   gap('Mein Flug ', 'fliegt', ' um 22 Uhr ab.', ['fliegt', 'fliegen', 'abfliegt'], 'My flight leaves at 10 pm.'),
                   write_de('When do you arrive?', 'Wann kommst du an?', alts=['Wann kommen Sie an?']),
                   write_de('Can you pick me up?', 'Kannst du mich abholen?', alts=['Können Sie mich abholen?']),
                   dictation('Der Zug fährt von Gleis drei ab.', 'An announcement at the station.',
                             alts=['Der Zug fährt von Gleis 3 ab.']),
               ]),
        lesson('g8-mit', 'G2', 'mit dem Bus, mit der U-Bahn', ['8.1'],
               ['To say how you travel, use <strong>mit</strong> + the vehicle. After mit, <em class="de">der</em> and '
                '<em class="de">das</em> become <strong>dem</strong>, and <em class="de">die</em> becomes <strong>der</strong>. '
                '(This is the dative case. For now, just learn these phrases.)',
                'Walking is different: <em class="de">zu Fuß</em> (on foot).'],
               [{'step': 'How?', 'title': 'mit + vehicle',
                 'table': {'head': ['Vehicle', 'How?'],
                           'rows': [['der Bus', 'mit dem Bus'], ['der Zug', 'mit dem Zug'], ['das Auto', 'mit dem Auto'],
                                    ['das Fahrrad', 'mit dem Fahrrad'], ['das Taxi', 'mit dem Taxi'],
                                    ['die U-Bahn', 'mit der U-Bahn'], ['die Straßenbahn', 'mit der Straßenbahn'],
                                    ['—', 'zu Fuß']],
                           'say': ['mit dem Bus', 'mit dem Zug', 'mit dem Auto', 'mit dem Fahrrad', 'mit dem Taxi',
                                   'mit der U-Bahn', 'mit der Straßenbahn', 'zu Fuß'], 'highlight': 1}},
                {'step': 'In sentences', 'title': 'Getting around', 'examples': [
                    ('Ich fahre mit dem Bus zur Arbeit.', 'I go to work by bus.'),
                    ('Fährst du mit dem Zug nach Hamburg?', 'Are you going to Hamburg by train?'),
                    ('Wir fliegen mit Ethiopian Airlines.', 'We are flying with Ethiopian Airlines.'),
                    ('Ich gehe zu Fuß.', 'I am walking.')]}],
               [('der → dem', 'mit dem Zug'), ('das → dem', 'mit dem Auto'), ('die → der', 'mit der U-Bahn'),
                ('Walking', 'zu Fuß')],
               'How do you travel?', [
                   gap('Ich fahre mit ', 'dem', ' Bus.', ['dem', 'der', 'den'], 'I go by bus.'),
                   gap('Sie fährt mit ', 'der', ' U-Bahn.', ['der', 'dem', 'die'], 'She goes by underground.'),
                   gap('Wir fahren mit ', 'dem', ' Auto nach Adama.', ['dem', 'der', 'das'], 'We are driving to Adama.'),
                   gap('Fährst du mit ', 'dem', ' Fahrrad?', ['dem', 'der', 'den'], 'Are you cycling?'),
                   gap('Ich fahre mit ', 'der', ' Straßenbahn.', ['der', 'dem', 'die'], 'I take the tram.'),
                   gap('Er kommt mit ', 'dem', ' Taxi.', ['dem', 'der', 'das'], 'He is coming by taxi.'),
                   gap('Ich gehe zu ', 'Fuß', '.', ['Fuß', 'Füße', 'Fuße'], 'I am walking.'),
                   pick('How do you say "by train"?', 'mit dem Zug', ['mit dem Zug', 'mit der Zug', 'mit den Zug']),
                   pick('How do you say "by plane"?', 'mit dem Flugzeug',
                        ['mit dem Flugzeug', 'mit der Flugzeug', 'mit das Flugzeug']),
                   order('Ich fahre mit dem Bus zur Arbeit.', 'I go to work by bus.',
                         alts=['Ich fahre zur Arbeit mit dem Bus.']),
                   write_de('by underground', 'mit der U-Bahn'),
                   write_de('on foot', 'zu Fuß'),
               ]),
        reading('g8-reading', 'R1', 'Dawit flies to Germany', ['8.5', '8.2'], READ_INTRO, 'Dawit fliegt nach Deutschland', [
            'Dawit: Hallo Lena! Mein Flug startet heute um 22:30 Uhr in Addis Abeba. Ich fliege über Frankfurt.',
            'Lena: Super! Wann kommst du in Frankfurt an?',
            'Dawit: Um 5:40 Uhr. Dann steige ich in den Zug nach Leipzig um. Ich komme um 9:15 Uhr am Hauptbahnhof an. '
            'Kannst du mich abholen?',
            'Lena: Natürlich hole ich dich ab! Ich freue mich so auf dich. Hoffentlich hast du keine Verspätung!',
            'Dawit: Ich hoffe es auch. Bis morgen!'],
            [('der Flug startet', 'the flight takes off'), ('über Frankfurt', 'via Frankfurt'),
             ('Ich hoffe es auch.', 'I hope so too.'), ('Bis morgen!', 'See you tomorrow!')], [
                tf('Dawits Flug startet in Addis Abeba.', True),
                tf('Dawit fliegt direkt nach Leipzig.', False,
                   why='Er fliegt nach Frankfurt und fährt dann mit dem Zug nach Leipzig.'),
                tf('Dawit kommt um 5:40 Uhr in Frankfurt an.', True),
                tf('Lena holt Dawit am Flughafen ab.', False, why='Sie holt ihn am Hauptbahnhof in Leipzig ab.'),
                tf('Lena freut sich auf Dawit.', True),
                pick('Wo steigt Dawit um?', 'in Frankfurt', ['in Frankfurt', 'in Leipzig', 'in Addis Abeba'],
                     hint='Where does Dawit change?'),
                pick('Wann kommt Dawit in Leipzig an?', 'um 9:15 Uhr', ['um 9:15 Uhr', 'um 5:40 Uhr', 'um 22:30 Uhr'],
                     hint='When does Dawit arrive in Leipzig?'),
                answer_de('Wer holt Dawit ab?', 'Lena holt ihn ab.', alts=['Lena.', 'Lena holt Dawit ab.']),
            ]),
    ],
}
extend(UNIT8)

# ---------------------------------------------------------------- Unit 9: Yesterday & last year
UNIT9 = {
    'id': 9,
    'title': 'Yesterday & last year',
    'sections': [
        sec('9.1', 'Past time words', [
            ('gestern', 'yesterday'), ('vorgestern', 'the day before yesterday'),
            ('gestern Abend', 'yesterday evening, last night'), ('letzte Woche', 'last week'),
            ('letzten Montag', 'last Monday'), ('letztes Wochenende', 'last weekend'), ('letztes Jahr', 'last year'),
            ('zuerst', 'first'), ('dann', 'then'), ('danach', 'after that'), ('später', 'later')]),
        sec('9.2', 'What did you do?', [
            ('Was hast du gestern gemacht?', 'What did you do yesterday?'), ('Ich habe gearbeitet.', 'I worked.'),
            ('Ich habe eingekauft.', 'I went shopping.'), ('Ich habe gekocht.', 'I cooked.'),
            ('Ich habe Kaffee getrunken.', 'I drank coffee.'), ('Ich habe ein Buch gelesen.', 'I read a book.'),
            ('Ich habe ferngesehen.', 'I watched TV.'), ('Ich habe aufgeräumt.', 'I tidied up.'),
            ('Ich habe lange geschlafen.', 'I slept in.'), ('Ich habe telefoniert.', 'I was on the phone.'),
            ('Ich habe fotografiert.', 'I took photos.'), ('Ich habe Freunde getroffen.', 'I met friends.')]),
        sec('9.3', 'Where did you go?', [
            ('Ich bin nach Hause gegangen.', 'I went home.'), ('Ich bin nach Hawassa gefahren.', 'I went to Hawassa.'),
            ('Ich bin nach Rom geflogen.', 'I flew to Rome.'), ('Ich bin spät angekommen.', 'I arrived late.'),
            ('Ich bin zu Hause geblieben.', 'I stayed at home.'), ('Ich bin gelaufen.', 'I ran.'),
            ('Er ist gekommen.', 'He came.'), ('Was ist passiert?', 'What happened?')]),
        sec('9.4', 'war and hatte', [
            ('ich war', 'I was'), ('du warst', 'you were'), ('er war', 'he was'), ('wir waren', 'we were'),
            ('ich hatte', 'I had'), ('du hattest', 'you had'), ('wir hatten', 'we had'),
            ('Wie war die Reise?', 'How was the trip?'), ('Die Reise war schön.', 'The trip was nice.'),
            ('Ich hatte Glück mit dem Wetter.', 'I was lucky with the weather.'), ('Wir hatten viel Spaß.', 'We had a lot of fun.')]),
        sec('9.5', 'Opening hours', [
            ('die Öffnungszeiten', 'the opening hours (pl.)'), ('geöffnet', 'open'), ('geschlossen', 'closed'),
            ('die Praxis', "the doctor's surgery (f.)"), ('die Bank', 'the bank (f.)'), ('die Apotheke', 'the pharmacy (f.)'),
            ('Wann ist die Praxis geöffnet?', 'When is the surgery open?'), ('von Montag bis Freitag', 'from Monday to Friday'),
            ('von 9 bis 17 Uhr', 'from 9 am to 5 pm'), ('ab 8 Uhr', "from 8 o'clock")]),
        sec('9.6', 'Festivals & trips', [
            ('das Fest', 'the festival (n.)'), ('feiern', 'to celebrate'), ('Weihnachten', 'Christmas'),
            ('Silvester', "New Year's Eve"), ('Ostern', 'Easter'), ('das Neujahr', "New Year's Day (n.)"),
            ('Wann hast du Geburtstag?', 'When is your birthday?'), ('Ich habe im März Geburtstag.', 'My birthday is in March.'),
            ('nach Deutschland', 'to Germany'), ('in die Schweiz', 'to Switzerland'), ('eine Reise machen', 'to go on a trip'),
            ('Freunde besuchen', 'to visit friends')]),
    ],
    'grammar': [
        lesson('g9-perfect-haben', 'G1', 'The perfect with haben', ['9.2', '9.1'],
               ['To talk about the past in spoken German you mostly use the perfect: <strong>haben</strong> in position 2 + '
                'the <strong>participle</strong> at the end: <em class="de">Ich habe Kaffee getrunken.</em>',
                'Regular verbs: <strong>ge- … -t</strong>: machen → gemacht, kaufen → gekauft. Many irregular verbs: '
                '<strong>ge- … -en</strong>, often with a new vowel: trinken → getrunken, lesen → gelesen.',
                'Separable verbs put ge in the middle: einkaufen → ein<strong>ge</strong>kauft. Verbs ending in '
                '<strong>-ieren</strong> have no ge: telefonieren → telefoniert.'],
               [{'step': 'Participles', 'title': 'Four patterns',
                 'table': {'head': ['Pattern', 'Infinitive', 'Participle'],
                           'rows': [['ge- … -t', 'machen', 'gemacht'], ['ge- … -t', 'arbeiten', 'gearbeitet'],
                                    ['ge- … -en', 'trinken', 'getrunken'], ['ge- … -en', 'lesen', 'gelesen'],
                                    ['separable', 'einkaufen', 'eingekauft'], ['separable', 'fernsehen', 'ferngesehen'],
                                    ['-ieren', 'telefonieren', 'telefoniert']],
                           'say': ['machen, gemacht', 'arbeiten, gearbeitet', 'trinken, getrunken', 'lesen, gelesen',
                                   'einkaufen, eingekauft', 'fernsehen, ferngesehen', 'telefonieren, telefoniert'],
                           'highlight': 2}},
                {'step': 'In sentences', 'title': 'Yesterday', 'examples': [
                    ('Was hast du gestern gemacht?', 'What did you do yesterday?'),
                    ('Ich habe den ganzen Tag gearbeitet.', 'I worked all day.'),
                    ('Wir haben Injera gegessen.', 'We ate injera.'),
                    ('Hast du schon eingekauft?', 'Have you done the shopping yet?'),
                    ('Am Abend habe ich ferngesehen.', 'In the evening I watched TV.')]}],
               [('haben + participle', 'Ich habe … gemacht.'), ('ge- … -t', 'gemacht, gekauft, gearbeitet'),
                ('ge- … -en', 'getrunken, gelesen, geschlafen'), ('Separable / -ieren', 'eingekauft / telefoniert')],
               'What did you do?', [
                   gap('Ich habe gestern viel ', 'gearbeitet', '.', ['gearbeitet', 'gearbeit', 'arbeitet'],
                       'I worked a lot yesterday.'),
                   gap('Wir haben Kaffee ', 'getrunken', '.', ['getrunken', 'getrinkt', 'trinken'], 'We drank coffee.'),
                   gap('Hast du die Zeitung ', 'gelesen', '?', ['gelesen', 'gelest', 'geliest'], 'Did you read the newspaper?'),
                   gap('Sie hat im Supermarkt ', 'eingekauft', '.', ['eingekauft', 'geeinkauft', 'einkaufen'],
                       'She did the shopping at the supermarket.', why='Separable: ge goes in the middle.'),
                   gap('Ich habe lange ', 'telefoniert', '.', ['telefoniert', 'getelefoniert', 'telefonieren'],
                       'I was on the phone for a long time.', why='-ieren verbs have no ge.'),
                   gap('Am Abend haben wir ', 'ferngesehen', '.', ['ferngesehen', 'gefernsehen', 'ferngeseht'],
                       'In the evening we watched TV.'),
                   gap('Was ', 'hast', ' du am Sonntag gemacht?', ['hast', 'bist', 'hat'], 'What did you do on Sunday?'),
                   gap('Er hat ein Foto ', 'gemacht', '.', ['gemacht', 'gemachen', 'macht'], 'He took a photo.'),
                   pick('The participle of schlafen:', 'geschlafen', ['geschlafen', 'geschlaft', 'geschlief']),
                   pick('The participle of kaufen:', 'gekauft', ['gekauft', 'gekaufen', 'kauft']),
                   order('Ich habe gestern Zeitung gelesen.', 'I read the newspaper yesterday.',
                         alts=['Gestern habe ich Zeitung gelesen.']),
                   order('Was hast du am Wochenende gemacht?', 'What did you do at the weekend?'),
                   write_de('I cooked.', 'Ich habe gekocht.'),
                   write_de('We went shopping.', 'Wir haben eingekauft.'),
               ]),
        lesson('g9-sein-haben', 'G2', 'haben or sein?', ['9.3'],
               ['Most verbs make their perfect with haben. But verbs of <strong>movement from A to B</strong> use '
                '<strong>sein</strong>: gehen, fahren, fliegen, kommen, laufen, ankommen.',
                'Also with sein: <em class="de">bleiben</em> (to stay), <em class="de">passieren</em> (to happen) and '
                '<em class="de">sein</em> itself: <em class="de">Ich bin in Berlin gewesen.</em>'],
               [{'step': 'With sein', 'title': 'Movement and change',
                 'table': {'head': ['Infinitive', 'Perfect'],
                           'rows': [['gehen', 'ich bin gegangen'], ['fahren', 'ich bin gefahren'],
                                    ['fliegen', 'ich bin geflogen'], ['kommen', 'ich bin gekommen'],
                                    ['ankommen', 'ich bin angekommen'], ['laufen', 'ich bin gelaufen'],
                                    ['bleiben', 'ich bin geblieben']],
                           'say': ['ich bin gegangen', 'ich bin gefahren', 'ich bin geflogen', 'ich bin gekommen',
                                   'ich bin angekommen', 'ich bin gelaufen', 'ich bin geblieben'], 'highlight': 1}},
                {'step': 'In sentences', 'title': 'Where did you go?', 'examples': [
                    ('Ich bin nach Hawassa gefahren.', 'I went to Hawassa.'),
                    ('Wir sind spät nach Hause gekommen.', 'We came home late.'),
                    ('Bist du schon einmal geflogen?', 'Have you ever flown?'),
                    ('Er ist zu Hause geblieben.', 'He stayed at home.'), ('Was ist passiert?', 'What happened?')]}],
               [('sein', 'movement A → B: gehen, fahren, fliegen'), ('sein', 'also bleiben and passieren'),
                ('haben', 'everything else: gegessen, gearbeitet'), ('Participles', 'gegangen, gefahren, geflogen')],
               'haben or sein?', [
                   gap('Ich ', 'bin', ' nach Adama gefahren.', ['bin', 'habe', 'ist'], 'I went to Adama.'),
                   gap('Wir ', 'haben', ' Pizza gegessen.', ['haben', 'sind', 'hat'], 'We ate pizza.'),
                   gap('', 'Bist', ' du schon einmal geflogen?', ['Bist', 'Hast', 'Ist'], 'Have you ever flown?'),
                   gap('Sie ', 'ist', ' zu Hause geblieben.', ['ist', 'hat', 'sind'], 'She stayed at home.'),
                   gap('Er ', 'hat', ' lange geschlafen.', ['hat', 'ist', 'haben'], 'He slept for a long time.'),
                   gap('Wann ', 'bist', ' du angekommen?', ['bist', 'hast', 'ist'], 'When did you arrive?'),
                   gap('Was ', 'ist', ' passiert?', ['ist', 'hat', 'sind'], 'What happened?'),
                   gap('Ihr ', 'habt', ' viel gelernt.', ['habt', 'seid', 'haben'], 'You (all) learned a lot.'),
                   gap('Ich bin nach Hause ', 'gegangen', '.', ['gegangen', 'gegeht', 'gegangt'], 'I went home.'),
                   gap('Wir sind nach Frankfurt ', 'geflogen', '.', ['geflogen', 'gefliegt', 'gefliegen'],
                       'We flew to Frankfurt.'),
                   order('Ich bin spät nach Hause gekommen.', 'I came home late.'),
                   order('Bist du mit dem Zug gefahren?', 'Did you go by train?'),
                   write_de('I stayed at home.', 'Ich bin zu Hause geblieben.'),
                   write_de('He flew to Germany.', 'Er ist nach Deutschland geflogen.'),
               ]),
        lesson('g9-war-hatte', 'G3', 'war and hatte', ['9.4'],
               ['For <em class="de">sein</em> and <em class="de">haben</em>, German prefers a short past form, even when '
                'speaking: <strong>war</strong> (was) and <strong>hatte</strong> (had).',
                '<em class="de">Ich bin in Berlin gewesen</em> is correct, but <em class="de">Ich war in Berlin</em> is '
                'what you will usually hear.'],
               [{'step': 'The forms', 'title': 'sein and haben in the past',
                 'table': {'head': ['Person', 'sein', 'haben'],
                           'rows': [['ich', 'war', 'hatte'], ['du', 'warst', 'hattest'], ['er / sie / es', 'war', 'hatte'],
                                    ['wir', 'waren', 'hatten'], ['ihr', 'wart', 'hattet'], ['sie / Sie', 'waren', 'hatten']],
                           'say': ['ich war, ich hatte', 'du warst, du hattest', 'er war, er hatte', 'wir waren, wir hatten',
                                   'ihr wart, ihr hattet', 'sie waren, sie hatten']}},
                {'step': 'In sentences', 'title': 'Telling about a trip', 'examples': [
                    ('Wie war die Reise? – Sie war super!', 'How was the trip? – It was great!'),
                    ('Letztes Jahr war ich in Lalibela.', 'Last year I was in Lalibela.'),
                    ('Wir hatten viel Spaß.', 'We had a lot of fun.'),
                    ('Hattest du Glück mit dem Wetter?', 'Were you lucky with the weather?'),
                    ('Gestern war ich krank.', 'Yesterday I was ill.')]}],
               [('ich / er war', 'no ending'), ('du warst, ihr wart', 'you were'), ('ich / er hatte', 'no ending'),
                ('wir / sie waren, hatten', 'we / they were, had')],
               'war or hatte?', [
                   gap('Gestern ', 'war', ' ich krank.', ['war', 'hatte', 'bin'], 'Yesterday I was ill.'),
                   gap('Wie ', 'war', ' die Reise?', ['war', 'waren', 'hatte'], 'How was the trip?'),
                   gap('Wir ', 'hatten', ' viel Spaß.', ['hatten', 'waren', 'hattet'], 'We had a lot of fun.'),
                   gap('', 'Warst', ' du schon in Gondar?', ['Warst', 'War', 'Wart'], 'Have you ever been to Gondar?'),
                   gap('Ihr ', 'wart', ' sehr müde.', ['wart', 'waren', 'warst'], 'You (all) were very tired.'),
                   gap('Ich ', 'hatte', ' keine Zeit.', ['hatte', 'hattest', 'war'], "I didn't have time."),
                   gap('Meine Eltern ', 'waren', ' im Urlaub.', ['waren', 'war', 'hatten'], 'My parents were on holiday.'),
                   gap('', 'Hattest', ' du Glück mit dem Wetter?', ['Hattest', 'Hatte', 'Warst'],
                       'Were you lucky with the weather?'),
                   pick('A shorter way to say "Ich bin in Rom gewesen":', 'Ich war in Rom.',
                        ['Ich war in Rom.', 'Ich hatte in Rom.', 'Ich bin in Rom war.']),
                   order('Letztes Jahr war ich in Lalibela.', 'Last year I was in Lalibela.',
                         alts=['Ich war letztes Jahr in Lalibela.']),
                   write_de('The trip was nice.', 'Die Reise war schön.'),
                   write_de('We had a lot of fun.', 'Wir hatten viel Spaß.'),
               ]),
        lesson('g9-time', 'G4', 'von … bis, ab, im, seit, nach', ['9.5', '9.6'],
               ['<strong>von … bis</strong>: from … to: <em class="de">von 9 bis 17 Uhr</em>. <strong>ab</strong>: from … on: '
                '<em class="de">ab 8 Uhr</em>.',
                '<strong>im</strong> with months and seasons: <em class="de">im März, im Winter</em>. <strong>seit</strong>: '
                'since, for: <em class="de">seit 2015</em>.',
                'Where to? Cities and most countries take <strong>nach</strong>: <em class="de">nach Berlin, nach '
                'Deutschland</em>. Countries with an article take <strong>in die</strong>: <em class="de">in die Schweiz, '
                'in die Türkei, in die USA</em>.'],
               [{'step': 'Overview', 'title': 'Small words for time and place',
                 'table': {'head': ['Word', 'Meaning', 'Example'],
                           'rows': [['von … bis', 'from … to', 'von Montag bis Freitag'], ['ab', 'from … on', 'ab 8 Uhr'],
                                    ['im', 'in (month, season)', 'im August'], ['seit', 'since', 'seit 1977'],
                                    ['nach', 'to (city, country)', 'nach Hamburg'],
                                    ['in die', 'to (country with die)', 'in die Schweiz']],
                           'say': ['von Montag bis Freitag', 'ab 8 Uhr', 'im August', 'seit 1977', 'nach Hamburg',
                                   'in die Schweiz'], 'highlight': 0}},
                {'step': 'In sentences', 'title': 'Opening hours and festivals', 'examples': [
                    ('Die Praxis ist von Montag bis Freitag geöffnet.', 'The surgery is open from Monday to Friday.'),
                    ('Ab 18 Uhr ist die Bank geschlossen.', 'From 6 pm the bank is closed.'),
                    ('Im September feiern wir Enkutatash.', 'In September we celebrate Enkutatash.'),
                    ('Das Oktoberfest gibt es seit 1810.', 'The Oktoberfest has existed since 1810.'),
                    ('Letztes Jahr bin ich nach Deutschland geflogen.', 'Last year I flew to Germany.')]}],
               [('von … bis', 'von 9 bis 17 Uhr'), ('ab', 'ab 8 Uhr'), ('im / seit', 'im Mai, seit 2015'),
                ('nach / in die', 'nach Berlin, in die Schweiz')],
               'Time and place', [
                   gap('Die Bank ist ', 'von', ' 9 bis 16 Uhr geöffnet.', ['von', 'ab', 'seit'], 'The bank is open from 9 to 4.'),
                   gap('', 'Ab', ' 20 Uhr ist die Apotheke geschlossen.', ['Ab', 'Seit', 'Im'],
                       'From 8 pm the pharmacy is closed.'),
                   gap('Ich habe ', 'im', ' April Geburtstag.', ['im', 'am', 'um'], 'My birthday is in April.'),
                   gap('Das Fest gibt es ', 'seit', ' 1810.', ['seit', 'ab', 'im'], 'The festival has existed since 1810.'),
                   gap('Wir fahren ', 'nach', ' Hamburg.', ['nach', 'in die', 'zu'], 'We are going to Hamburg.'),
                   gap('Sie fliegt ', 'in die', ' Schweiz.', ['in die', 'nach', 'nach die'], 'She is flying to Switzerland.'),
                   gap('Ich fliege ', 'nach', ' Äthiopien.', ['nach', 'in die', 'in'], 'I am flying to Ethiopia.'),
                   gap('', 'Im', ' Winter ist es in Berlin kalt.', ['Im', 'Am', 'Seit'], 'In winter it is cold in Berlin.'),
                   gap('Ich lerne ', 'seit', ' drei Monaten Deutsch.', ['seit', 'ab', 'von'],
                       'I have been learning German for three months.'),
                   pick('The shop is open from 8 am to 8 pm:', 'von 8 bis 20 Uhr',
                        ['von 8 bis 20 Uhr', 'ab 8 bis 20 Uhr', 'seit 8 bis 20 Uhr']),
                   order('Die Praxis ist am Montag geschlossen.', 'The surgery is closed on Monday.',
                         alts=['Am Montag ist die Praxis geschlossen.']),
                   write_de('When is the bank open?', 'Wann ist die Bank geöffnet?', alts=['Wann hat die Bank geöffnet?']),
               ]),
        reading('g9-reading', 'R1', "Selam's year", ['9.6', '9.4'], READ_INTRO, 'Mein Jahr in Deutschland', [
            'Hallo aus Leipzig! Ich bin Selam und ich wohne seit einem Jahr in Deutschland. Hier ist mein Jahr in vier '
            'Jahreszeiten.',
            'Im Frühling war ich in Hamburg. Ich bin mit dem Zug gefahren und habe den Hafen gesehen. Das Wetter war '
            'leider schlecht, aber ich hatte viel Spaß.',
            'Im Sommer bin ich nach Addis Abeba geflogen. Ich habe meine Familie besucht und wir haben zusammen gekocht '
            'und gegessen. Im September haben wir Enkutatash gefeiert, das äthiopische Neujahr.',
            'Im Winter bin ich in Leipzig geblieben. Weihnachten habe ich mit Freunden gefeiert. Es war kalt, aber sehr schön!'],
            [('seit einem Jahr', 'for a year'), ('die Jahreszeiten', 'the seasons'), ('der Hafen', 'the port'),
             ('besuchen', 'to visit'), ('äthiopisch', 'Ethiopian')], [
                tf('Selam wohnt seit einem Jahr in Deutschland.', True),
                tf('Im Frühling ist Selam nach Hamburg geflogen.', False, why='Sie ist mit dem Zug gefahren.'),
                tf('In Hamburg war das Wetter gut.', False, why='Das Wetter war leider schlecht.'),
                tf('Im Sommer hat Selam ihre Familie besucht.', True),
                tf('Enkutatash ist das äthiopische Neujahr.', True),
                tf('Weihnachten war Selam in Addis Abeba.', False, why='Im Winter ist sie in Leipzig geblieben.'),
                pick('Was hat Selam in Hamburg gesehen?', 'den Hafen', ['den Hafen', 'das Meer', 'ihre Familie'],
                     hint='What did Selam see in Hamburg?'),
                answer_de('Wann feiert man Enkutatash?', 'im September',
                          alts=['Im September.', 'Man feiert Enkutatash im September.']),
                write_en('Ich hatte viel Spaß.', 'I had a lot of fun.', alts=['I had lots of fun.', 'I had great fun.']),
            ]),
    ],
}
extend(UNIT9)


COURSE = {'units': [UNIT0, UNIT1, UNIT2, UNIT3, UNIT4, UNIT5, UNIT6, UNIT7, UNIT8, UNIT9]}


def check(course):
    keys = set()
    for unit in course['units']:
        for s in unit['sections']:
            assert s['key'] not in keys, s['key']
            keys.add(s['key'])
            assert s['words'], s['key']
        for g in unit['grammar']:
            assert g['key'] not in keys, g['key']
            keys.add(g['key'])
            if 'quiz' in g:
                assert len(g['quiz']['items']) >= 8, g['key']
                for it in g['quiz']['items']:
                    if it.get('type') == 'order':
                        assert len(it['tiles']) >= 2, (g['key'], it)
                        for alt in it.get('alts', []):
                            assert sorted(alt.rstrip('.?!').lower().split()) == sorted(t.lower() for t in it['tiles']), (g['key'], alt)
                    elif it.get('type') == 'write':
                        assert it['answer'] and it['say'], (g['key'], it)
                    else:
                        assert it['answer'] in it['options'], (g['key'], it)
                        assert len(set(it['options'])) == len(it['options']), (g['key'], it)
            for ch in g['chapters']:
                assert any(s['key'] == ch for s in unit['sections']), (g['key'], ch)


def picture_files(emoji):
    """Twemoji file names for a string of emoji: one per picture, e.g. '🍎+🧃' -> ['1f34e', '+', '1f9c3'].
    Like Twemoji itself, the variation selector FE0F is dropped except inside ZWJ sequences."""
    cps, files, i = [ord(c) for c in emoji], [], 0
    while i < len(cps):
        if cps[i] == ord('+'):  # compound word: shown as "🍎 + 🍰"
            files.append('+')
            i += 1
            continue
        flag = 0x1F1E6 <= cps[i] <= 0x1F1FF and i + 1 < len(cps) and 0x1F1E6 <= cps[i + 1] <= 0x1F1FF
        seq = cps[i:i + 2] if flag else [cps[i]]
        i += len(seq)
        while i < len(cps):
            if cps[i] in (0xFE0F, 0x20E3) or 0x1F3FB <= cps[i] <= 0x1F3FF:
                seq.append(cps[i])
                i += 1
            elif cps[i] == 0x200D and i + 1 < len(cps):
                seq += cps[i:i + 2]
                i += 2
            else:
                break
        if 0x200D not in seq:
            seq = [c for c in seq if c != 0xFE0F]
        files.append('-'.join(f'{c:x}' for c in seq))
    return files


def add_pictures(course):
    known = {w['german'] for u in course['units'] for s in u['sections'] for w in s['words']}
    unknown = set(PICTURES) - known
    assert not unknown, f'word_pictures.py names words that are not in the course: {sorted(unknown)}'
    for unit in course['units']:
        for section in unit['sections']:
            for word in section['words']:
                if word['german'] in PICTURES:
                    word['pic'] = picture_files(PICTURES[word['german']])


AM_DIR = Path(__file__).resolve().parent / 'course_am'


def read_am(path):
    """`English ||| Amharic` lines (German words for words.txt); # starts a comment."""
    pairs = {}
    for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip() or line.startswith('#'):
            continue
        source, sep, target = line.partition(' ||| ')
        assert sep and target.strip(), f'{path.name}:{number}: expected "English ||| Amharic"'
        assert source not in pairs or pairs[source] == target, f'{path.name}:{number}: two translations of {source!r}'
        pairs[source] = target.strip()
    return pairs


def build_amharic(course):
    """The Amharic course content for the Amharic interface: word meanings by German word, and the
    English lesson texts by their English. German stays German: it is what the course teaches."""
    from course_am_strings import course_strings

    words = {}
    for path in sorted(AM_DIR.glob('words*.txt')):
        words.update(read_am(path))
    text = {}
    for path in sorted(AM_DIR.glob('u[0-9]*.txt')):
        for source, target in read_am(path).items():
            assert text.get(source, target) == target, f'{path.name}: two translations of {source!r}'
            text[source] = target
    german = {w['german'] for u in course['units'] for s in u['sections'] for w in s['words']}
    needed = course_strings(course)
    missing_words = sorted(german - set(words))
    missing_text = [t for t in needed if t not in text]
    if missing_words or missing_text:
        print(f'Amharic: {len(missing_words)} word meanings and {len(missing_text)} lesson texts still in English')
    return {'words': {g: words[g] for g in sorted(german & set(words))}, 'text': text}


if __name__ == '__main__':
    check(COURSE)
    add_pictures(COURSE)
    am = build_amharic(COURSE)
    (Path(__file__).resolve().parent.parent / 'static' / 'course' / 'js' / 'course-am.js').write_text(
        '/* Amharic meanings and lesson texts for the Amharic interface. Generated from tools/course_am/. */\n'
        'window.COURSE_AM = ' + json.dumps(am, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    out = Path(__file__).resolve().parent.parent / 'static' / 'course' / 'js' / 'course-data.js'
    out.write_text('/* German A1.1, Start unit and Units 1-9. Generated from tools/course_content.py. */\n'
                   'window.COURSE = ' + json.dumps(COURSE, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    words = sum(len(s['words']) for u in COURSE['units'] for s in u['sections'])
    lessons = sum(len(u['grammar']) for u in COURSE['units'])
    print(f'{len(COURSE["units"])} units, {words} vocabulary entries, {lessons} grammar lessons -> {out}')
