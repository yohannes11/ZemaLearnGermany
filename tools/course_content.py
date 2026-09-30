"""Source for course-data.js: German A1.1 Units 1-7 (vocabulary sheets + unit recaps from 11percent.de).

Run this file to regenerate /Users/jo/Documents/LearnGerman/course-data.js.
"""
import json
from pathlib import Path


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
            ('Wie gehts?', 'How are you? (informal, short)'), ('Wie geht es dir?', 'How are you? (informal)'),
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

COURSE = {'units': [UNIT1, UNIT2, UNIT3, UNIT4, UNIT5, UNIT6, UNIT7]}


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
                    assert it['answer'] in it['options'], (g['key'], it)
            for ch in g['chapters']:
                assert any(s['key'] == ch for s in unit['sections']), (g['key'], ch)


if __name__ == '__main__':
    check(COURSE)
    out = Path('/Users/jo/Documents/LearnGerman/course-data.js')
    out.write_text('/* German A1.1, Units 1-7. Generated from course_content.py: vocabulary sheets and unit recaps (11percent.de). */\n'
                   'window.COURSE = ' + json.dumps(COURSE, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    words = sum(len(s['words']) for u in COURSE['units'] for s in u['sections'])
    lessons = sum(len(u['grammar']) for u in COURSE['units'])
    print(f'{len(COURSE["units"])} units, {words} vocabulary entries, {lessons} grammar lessons -> {out}')
