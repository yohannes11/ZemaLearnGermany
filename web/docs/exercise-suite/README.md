# ZemaLearn exercise suite: A1.1, chapter by chapter

A design specification for short, varied practice games, one set per chapter of the A1.1 syllabus.
Each chapter has at least 16 exercises spread across four interaction families. Every data set
and answer key below is written for ZemaLearn. The reference textbook is used for **syllabus and
exercise formats only**: no texts, dialogues or images from it are reproduced.

- [Chapter 1 · Hello! Names, greetings, origins](ch01-hello.md)
- [Chapter 2 · Work and personal details](ch02-work.md)
- [Chapter 3 · Family and languages](ch03-family.md)
- [Chapter 4 · Furniture, prices and opinions](ch04-furniture.md)
- [Chapter 5 · Things, colours and materials](ch05-things.md)
- [Chapter 6 · At the office](ch06-office.md)
- [Chapter 7 · Hobbies and abilities](ch07-hobbies.md)
- [Chapter 8 · Time and making plans](ch08-time.md)
- [Chapter 9 · Food and the café](ch09-food.md)
- [Chapter 10 · Travel and transport](ch10-travel.md)
- [Chapter 11 · Yesterday: the perfect with haben](ch11-yesterday.md)
- [Chapter 12 · Seasons, trips and festivals](ch12-seasons.md)

---

## 1. Source analysis

**Reference material:** *Momente A1.1* course book (Kursbuch, 12 lessons in 4 modules) and its
workbook (Arbeitsbuch, 118 pages: exercises per lesson, pronunciation strands, “Fokus Beruf” work
pages, exam training, tests and a learning-vocabulary list per lesson).

| Ch | Topic | Grammar | Communication | App unit |
|---|---|---|---|---|
| 1 | Greetings, names, origins, alphabet | Singular of kommen, lernen, heißen, sein; W-questions; statements; aus | Greet, say goodbye, ask how someone is, introduce yourself and others, say where you are from | 1 (+ Start) |
| 2 | Jobs, marital status, numbers 1–100 | Plural forms of wohnen, leben, haben, sein, arbeiten; nicht; als, bei, in; -in | Talk about work and yourself, say where you live | 2, 7 |
| 3 | Family, languages | Names + s (Jans Mutter); ja / nein / doch; mein / dein; sprechen | Talk about your family and languages | 2 |
| 4 | Furniture, prices, numbers to 1 000 000 | der / das / die; er / es / sie; adjectives | Ask and give prices, give opinions | 4, 3 |
| 5 | Objects, colours, materials | ein / kein; aus + material; sehen | Describe things, ask for words, ask for repetition, say thanks, give an email address | 4 |
| 6 | Office, computers | Plural; accusative with der / ein / kein | Phone strategies | 7 |
| 7 | Hobbies, compliments | können; the sentence bracket; lesen, treffen, fahren | Compliment, thank, say what you can do and how often | 6, 7 |
| 8 | Week, times of day, clock times | Verb in position 2; am, um; wissen | Make and decline plans, ask the time | 5 |
| 9 | Food | mögen, essen, möchte, nehmen; compound nouns | Likes and eating habits, ordering | 3 |
| 10 | Transport, travel | Separable verbs | Get information, express hope and joy, show understanding | 8 |
| 11 | Daily activities in the past | Perfect with haben; von … bis, ab; letzt- | Talk about the past, ask for opening hours | 9 |
| 12 | Seasons, months, trips, festivals | Perfect with sein; war / hatte; im, seit; nach | Talk about trips and festivals | 9 |

**Exercise formats used in the workbook**, and the engine that adapts each one (section 2):

| Workbook format | Engine |
|---|---|
| Ordnen Sie zu · Verbinden Sie (match) | DRAG-MATCH, MEMORY |
| Ergänzen Sie (complete) | GAP-DRAG, GAP-TYPE |
| Kreuzen Sie an (tick) | QUICK-PICK, BLITZ |
| Sortieren Sie das Gespräch | DIALOGUE-SORT |
| Schreiben Sie Sätze (word lists → sentences) | BUILDER |
| Wörter in einer Buchstabenschlange finden | SNAKE |
| Silben zu Wörtern bilden · Buchstabensalat | SYLLABLES, SCRAMBLE |
| Alles falsch: richtig antworten | TF-JUSTIFY |
| Satzmelodie · Wortakzent · Satzakzent | MELODY, STRESS |
| Audiotraining (hear and answer) | SPEAK |
| Formular ausfüllen · Visitenkarte · Warenkorb | FORM |
| Kursspaziergang, Rätsel, Kettenspiel | BRANCH, MEMORY-CHAIN, DEDUCE |
| Lesen / Hören + richtig/falsch (tests, exam training) | READ-EXPLORER, LISTEN-PICK |

## 2. Engines

Every exercise uses one of these engines. Engines marked ✅ already exist in the app (grammar
quiz types `choose`, `gap`, `listen`, `order`, `write`, plus the Speak, Match and Flashcards modes);
🆕 engines are new and need building.

| Engine | Family | Status | Interaction |
|---|---|---|---|
| BUILDER | Kinesthetic | ✅ `order` | Drag or tap word tiles into a line. Accepts alternative word orders. |
| DIALOGUE-SORT | Kinesthetic | ✅ `order` (lines) | Drag lines of a conversation into order. |
| GAP-DRAG | Kinesthetic | 🆕 | Drag chips from a word bank into slots in a paragraph or dialogue. Every chip is used once; one decoy. |
| BUCKETS | Kinesthetic | 🆕 | Drag cards into 2–6 labelled buckets (der / das / die, Nom. / Akk., …). |
| DRAG-MATCH | Kinesthetic | 🆕 (Match mode exists for vocabulary) | Connect left and right items: word ↔ meaning, picture, audio or answer. |
| SNAKE | Quick-touch | 🆕 | Swipe across a chain of letters to find hidden words. |
| SYLLABLES / SCRAMBLE | Quick-touch | 🆕 | Tap syllables or letters to build words. |
| ERROR-HUNT | Quick-touch | 🆕 | Tap the wrong word, then fix it (pick or type). Some sentences are correct: tap ✓. |
| HOTSPOT | Quick-touch | 🆕 | Tap words in a text (all verbs, every article …) or regions of an illustration. |
| MEMORY | Quick-touch | 🆕 | Flip cards to find pairs; 6–8 pairs; each pair is spoken when found. |
| QUICK-PICK | Quick-touch | ✅ `choose` / `gap` | One tap from 2–4 options. Used sparingly. |
| GAP-TYPE | Production | ✅ `write` | Type the missing word or form. |
| TRANSLATE | Production | ✅ `write` | Typed translation in both directions, lenient checking (umlauts as ae/oe/ue are accepted with a hint). |
| BRANCH | Production | 🆕 | Chat-style situational dialogue; each choice leads to a different reply; a wrong register (du/Sie) or an off answer gets a natural in-story reaction and a second chance. |
| SPEAK | Production | ✅ Speak mode | Say a target sentence; speech recognition marks recognised words; the learner can replay their recording next to the model. |
| FORM | Production | 🆕 | Fill fields of a form, business card or shopping basket from a text. |
| BLITZ | Assessment | 🆕 | 60 seconds, as many quick taps as possible; combo multiplier; no penalty screen, only a summary. |
| LISTEN-PICK / DICTATION | Assessment | ✅ `listen` / `write` + listen | Hear and choose, or hear and type. |
| READ-EXPLORER | Assessment | ✅ reading lessons (inline checks 🆕) | A short text with tappable glossary words and checks embedded between paragraphs. |
| TF-JUSTIFY | Assessment | 🆕 (extends `tf`) | Richtig / falsch; for “falsch”, tap the sentence in the text that proves it, then correct the statement. |
| MELODY / STRESS | Assessment (pronunciation) | 🆕 | Hear a sentence and choose ↗ or ↘, or tap the stressed syllable / word. |
| DEDUCE | Logic | 🆕 | Twenty-questions style game: ask yes/no questions by tapping, narrow down the answer. |
| MEMORY-CHAIN | Logic | 🆕 | A growing chain (“Ich packe einen Laptop, …”): rebuild the whole chain each round. |

## 3. Game layer (all engines)

- **Score:** 10 points per correct item; first-try bonus +5; hints cost 5.
- **Combo multiplier:** ×1 → ×2 after 3 in a row → ×3 after 6 in a row. A miss resets to ×1
  (the multiplier chip drops with a short fall animation, never a red screen).
- **Streak:** days in a row with at least one finished exercise; shown as a flame next to the
  progress ring; a “freeze” is earned every 7 days.
- **Progress:** a slim bar per exercise; a ring per chapter (exercises completed / total); chapter
  mastery at 80 % of exercises with ≥ 75 % score.
- **Spaced repetition:** missed items return 1, 3 and 7 days later in a daily 3-minute mix.
- **Encouragement:** short German phrases with an English gloss (“Super!”, “Fast!” = almost,
  “Weiter so!” = keep going), never more than one per 3 items.

**Feedback states (shared tokens from `static/course/css/course.css`):**

| State | Visual | Motion | Sound / haptics |
|---|---|---|---|
| Correct | `--green` border and fill, check icon | 150 ms scale 1 → 1.04 → 1 | soft rising two-note chime; `navigator.vibrate(15)` |
| Almost (accepted) | green with amber note (“Watch the umlaut”) | same | same chime, lower volume |
| Wrong | `--red` border, red-soft fill, × icon; correct answer revealed in green | 300 ms horizontal shake (±6 px, 3 cycles) | low single tone; `vibrate([20, 40, 20])` |
| Drag hover over a valid target | target lifts (shadow), dashed border turns solid | 120 ms | — |
| Drop rejected | chip springs back to the bank | 250 ms ease-out | — |

All motion respects `prefers-reduced-motion` (animations become instant colour changes). Every
interaction also works by tap-to-select + tap-to-place, so drag is never the only way (keyboard
and screen-reader users, small phones).

**Article colours** (used in BUCKETS, cards and vocabulary chips; a common convention in German
teaching): **der** = blue, **das** = green, **die** = red, **plural die** = gold. Colour is never
the only cue: the article is always printed too.

**Visual identity:** ZemaLearn's own palette and manuscript-style ornaments are kept. The
textbook's branding, layout and illustrations are not copied.

## 4. Coverage check

Each chapter file ends with a coverage table. Every chapter has at least 16 exercises and at
least 3 in each family (kinesthetic, quick-touch, production, assessment). Plain multiple choice
(QUICK-PICK) is never a stand-alone exercise; it only appears inside BLITZ rounds.
