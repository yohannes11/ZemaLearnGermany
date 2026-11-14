# Course search

How learners search the course on the website and in the app: what they can find, how the screen is laid out,
where the index lives and why, and the data behind it.

| Part | Website | App |
| --- | --- | --- |
| Engine | `web/static/course/js/search.js` | `mobile/lib/features/search/search_engine.dart` |
| Screen | search window in `web/templates/course/index.html`, code in `course.js` (`openSearch`) | `mobile/lib/features/search/search_screen.dart` |
| Shared tests | `web/apps/course/tests/search_cases.json` (run by `test_search.py` with Node, and `mobile/test/search_test.dart`) | |
| Topics | `web/tools/search_topics.txt`, built into `course-data.js` by `tools/course_content.py` | |

The two engines are line-for-line ports of each other and must stay so: change both, then run both test suites.

## What learners can search

**Vocabulary.** German entries, their English and Amharic meanings, and every example sentence (in German, English
and Amharic). Spelling does not have to be exact:

- umlauts and ß can be left out or written out: `schon`, `schoen`, `strasse`, `tschuess`;
- words are also matched by how they sound: `gooten tag` finds *Guten Tag*, `fielen dank` *Vielen Dank*,
  `nain` *nein*;
- German typed in Ethiopic letters is read as sounds: `ዳንኬ` finds *Danke*, `ጉተን ታግ` *Guten Tag*;
- one typo in a word of four letters or more, two in a word of seven or more: `Wohnnung`, `kuchn`;
- a word inside a compound: `kuchen` finds *Apfelkuchen*.

**Grammar and topics.** Grammar lesson titles and text, chapter titles, and the search topics: grammar categories
("accusative case", "verb conjugation", "past tense", "articles") and everyday situations.

**Plain questions.** "how to order food at a restaurant", "words used for expressing doubt", "ምግብ ማዘዝ". These are
answered by the topic index (below), not by an AI model: each topic lists the ways learners ask for it, in English
and Amharic, and links the chapters, lessons and words that answer it. This was chosen over vector search so the
search works offline in the app, costs nothing per query and needs nothing new on the server; the price is that a
question is understood only when it is close to a phrasing a topic lists. Adding phrasings is a one-line edit.

**Filters.** Show (words, grammar lessons, reading texts, word lists, topics), word type (nouns, verbs, adjectives
and adverbs, phrases, numbers, small words), unit and level. Filters work with or without words typed: with none,
they list everything that fits in course order ("every verb in Unit 5").

**Autocomplete.** While typing, up to five suggestions (the best matches' names) appear above the results; one tap
completes the query. Because suggestions come from the matching itself, they also correct typos.

**Global and in context.** On the website a search box sits in the header, drawn as a search field with its example text ("A word, a sentence, grammar or a question") so learners see they can search: in the middle of the bar on computers, a full-width row of its own on tablets and phones, and it stays at the top while the page scrolls. It opens the search window; `/` or Ctrl/⌘ K do too. It searches the whole course. In a
chapter, "Search this chapter" opens the same search limited to it, listing the chapter's words at once; the scope
bar shows where it searches, with a button to search the whole course.

## Layout

Website (a dialog; the whole screen on phones). App: the same parts in one scrolling screen, opened from the search
field at the top of Home, Words and Lessons, or "Search this chapter" in a chapter.

```
┌ Search the course ─────────────────────────────── ✕ Close ┐
│ 🔍 [ how to order food                          ] [Clear] │
│ Type in German, English or Amharic. The spelling …        │
│ ┌ Only in: Unit 3 · At the restaurant   [Search the whole course] ┐   (scoped only)
│ Suggestions: (Ordering food at a restaurant) (bestellen) … │   (while typing)
│ ▸ Filters (1)                                              │   (closed by default)
│     Show:      (All) (Words) (Grammar) (Reading) (Word lists) (Topics)
│     Word type: (All) (Nouns) (Verbs) (Adjectives & adverbs) (Phrases) …
│     Unit:      [All units ▾]     Level: [▾] (once the course has 2+ levels)
│                                                            │
│ TOPICS 1                                                   │
│ ┌ TOPIC · Ordering food at a restaurant ───────────────┐   │
│ │ (Unit 3 · mögen, möchten, nehmen) (Unit 3 · At the restaurant) … │
│ WORDS 13                                                   │
│ (🔊) bestellen · to order · Unit 3 · At the restaurant · Verb │
│      Ich möchte bestellen, bitte. — I would like to order, please. │ (the example that matched)
│ LESSONS 2 … CHAPTERS 2 …                                   │
└────────────────────────────────────────────────────────────┘
```

Groups are ordered by their best result. Every control has a word on it, not only an icon (many learners are new
to computers), and everything is in English and Amharic. Choosing a word opens it in Learn at that word; a lesson or
chapter opens it.

## Where the index lives, and why

The index is built **on the learner's device** from the course data both platforms already download
(`course-data.js` / the API's course bundle), in about 50 ms, and queried in a few milliseconds.

| Option | Fit for this course today |
| --- | --- |
| **On the device (chosen)** | ~1,400 documents, ~6,000 distinct tokens. Works offline in the app (a requirement), no server load or cost, instant as-you-type results, same rules on web and app. |
| PostgreSQL full-text search (+ `pg_trgm`, `unaccent`) | The natural server option when one is needed: no new service, ranking with `ts_rank`, typos with trigrams. Needs a connection; German/Amharic phonetics and Ethiopic transliteration would still be our own code. Production runs SQLite today, so it would also mean moving to PostgreSQL. |
| Meilisearch | Excellent typo tolerance and filters out of the box, small to run. A new service to deploy and keep in sync on a single VPS, online only. Worth it with many courses or user-made content. |
| Elasticsearch / OpenSearch | Built for millions of documents and log-scale analytics; far more than this needs, and memory-hungry on a small VPS. |
| Algolia | Hosted and fast, but per-search pricing, learners' queries leave our servers, online only. |

**When to move to the server:** if the course grows past roughly 50,000 entries (the download and phone memory become
the limit), if search must cover content that is not in the course bundle (forum posts, user decks), or for true
semantic search. The documents below map one-to-one onto a server table, and the shared test cases stay the
acceptance tests for whatever serves them.

## How matching works

1. **Tokens.** Text is lower-cased, HTML removed; `ß → ss`, `ä ö ü → a o u`, `ae oe ue → a o u`, other accents
   dropped. Tokens are runs of Latin letters/digits or of Ethiopic letters. A question's filler words ("how", "to",
   "the", "words", "እንዴት" …) are dropped when something else is left.
2. **Per token**, the best match against every index token: exact (1.0), English stem (0.95: order/ordering/orders),
   sounds the same (0.75), prefix (0.7, 0.6 for two letters), sound prefix (0.6), inside a compound (0.5), one or two
   typos (0.55/0.45). Ethiopic tokens match Amharic text exactly, by prefix or inside a word, and, read as sounds,
   German text (0.7/0.55/0.45).
3. **Per document**, each token's best match times the field's weight: German 10, meaning 7 (English and Amharic),
   example German 3, example meanings 2; chapter, lesson and topic titles 8–9; topic phrasings 8; lesson text 2.
   One or two tokens must all match; longer questions need half. Bonuses: the whole query as a phrase in a field, a
   field that equals the query, a field whose every word was asked for.
4. **Topics** that match lend half their score to everything they link, and count 1.5×: they are the answer card.
5. **Filters** apply last, so a topic can still bring in the words it links when only words are shown.
6. **Order:** score, then the shorter entry (a word before a sentence containing it), then by id. At most 4 topics,
   6 lessons, 6 chapters and 40 words (browsing: 300 words).

## Data

### Course data the index reads

```jsonc
// units[i]
{ "id": 3, "title": "Food & shopping", "level": "A1",
  "sections": [{ "key": "3.15", "title": "At the restaurant",
                 "words": [{ "german": "bestellen", "english": "to order", "pos": "verb",
                             "examples": [["Ich möchte bestellen, bitte.", "I would like to order, please."]] }] }],
  "grammar": [{ "key": "g3-moegen", "title": "mögen, möchten, nehmen", "chapters": ["3.15", "3.16"],
                "intro": ["…"], "blocks": [{ "title": "…", "text": "…", "reading": [] }] }] }
// topics[i]  (from tools/search_topics.txt)
{ "title": "Ordering food at a restaurant", "kind": "topic",
  "en": ["order food", "restaurant", "menu", "bill", …], "am": ["ምግብ ማዘዝ", "ምግብ ቤት", …],
  "chapters": ["3.15", "3.8"], "lessons": ["g3-moegen"], "words": ["bestellen", "die Rechnung", …] }
```

`pos` and `level` are set by `course_content.py` (`add_word_types`): German nouns are capitalised, English meanings
of verbs start with "to", numbers come from the number chapters, and pronouns, articles and particles are listed.
Amharic meanings and example translations come from `course-am.js` (the website loads it with the search, so
learners can type Amharic in the English interface too; the app has it when set to Amharic).

### The index (in memory)

```text
documents[]   one per word (deduplicated across chapters), chapter, lesson (not unit tests) and topic
  kind        word | chapter | lesson | topic
  type        word | chapter | grammar | reading | topic          (the "Show" filter)
  id          German entry, chapter or lesson key, or topic title
  units[], sections[], levels[]                                   (scope and filters; a word in three chapters is in all three)
  pos         noun | verb | adjective | phrase | number | small    (words)
  links[]     documents a topic points to
  fields[]    { name, weight, german?, size, joined }             (german: Ethiopic-as-sound may match it)
vocabulary    token → { stem, sound key, postings: [document, field, document, field, …] }
```

Each query token is compared with the ~6,000 distinct tokens once, then scores are added up through the postings.

### If it moves to a server

```sql
CREATE TABLE search_document (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('word', 'chapter', 'lesson', 'topic')),
  type        text NOT NULL,                       -- word | chapter | grammar | reading | topic
  ref         text NOT NULL,                       -- German entry, chapter/lesson key, topic title
  units       int[]  NOT NULL DEFAULT '{}',
  sections    text[] NOT NULL DEFAULT '{}',
  levels      text[] NOT NULL DEFAULT '{}',
  pos         text,
  german      text,                                -- weight A
  meanings    text,                                -- English and Amharic, weight B
  examples    text,                                -- weight C
  body        text,                                -- lesson text, topic phrasings, weight D
  sound_keys  text[],                              -- phonetic keys of German tokens (computed as today)
  doc         tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', unaccent(coalesce(german, ''))), 'A') ||
                setweight(to_tsvector('simple', coalesce(meanings, '')), 'B') ||
                setweight(to_tsvector('simple', unaccent(coalesce(examples, ''))), 'C') ||
                setweight(to_tsvector('simple', coalesce(body, '')), 'D')) STORED,
  embedding   vector(384)                          -- optional, pgvector, for true semantic search
);
CREATE INDEX ON search_document USING gin (doc);
CREATE INDEX ON search_document USING gin (german gin_trgm_ops);   -- typos
CREATE INDEX ON search_document USING gin (sound_keys);
CREATE INDEX ON search_document USING gin (units);
CREATE INDEX ON search_document (type, pos);
```

The table would be rebuilt from the course on each content release (as `course-data.js` is), so no learner data is
involved.

## Changing it

- New grammar point or situation learners ask about: add a topic to `web/tools/search_topics.txt` (English and
  Amharic phrasings, links), add its title's Amharic to `web/locale/am.json` (`course` section), rebuild with
  `cd web/tools && ../../.venv/bin/python course_content.py`. The build fails on a link to a chapter, lesson or word
  that does not exist.
- A rule change: change `search.js` and `search_engine.dart` together, add a case to `search_cases.json`, then run
  `manage.py test apps.course.tests.test_search` and `flutter test test/search_test.dart`.
- New interface text: through `T()`; `manage.py i18n_missing` lists what still needs Amharic.
