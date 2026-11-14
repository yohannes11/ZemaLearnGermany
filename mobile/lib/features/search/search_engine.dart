/// Course search: words (German, meanings, example sentences, spelled any way: "schoen", "tschuess", or German
/// written in Ethiopic letters, ዳንኬ), grammar lessons, chapters and the search topics that catch plain questions
/// like "how to order food". Runs on the phone, so it works offline.
///
/// The same rules as the website's web/static/course/js/search.js; both are checked against
/// web/apps/course/tests/search_cases.json (test/search_test.dart), so change them together.
library;

import 'dart:math' as math;

import '../../core/api/models.dart';

// Dropped from a question when something else is left: "how to order food at a restaurant" → order food restaurant.
final _stop = ('a an the to of for in on at by with and or is are am be been how what which who whom do does did '
        'i you your my me we us our words word phrase phrases sentence sentences used use using about some something '
        'that this these those it its there get say saying said into from '
        'እንዴት ምን ምንድን ነው ለ ስለ')
    .split(' ')
    .toSet();

const _plain = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'å': 'a', 'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', //
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ý': 'y',
};

/// Lower case, ß → ss, umlauts and their ae / oe / ue spellings to the plain vowel, other accents dropped.
String fold(String text) {
  final s = StringBuffer();
  for (final rune in text.toLowerCase().runes) {
    final ch = String.fromCharCode(rune);
    s.write(switch (ch) { 'ß' => 'ss', 'ä' => 'a', 'ö' => 'o', 'ü' => 'u', _ => _plain[ch] ?? ch });
  }
  return s.toString().replaceAll('ae', 'a').replaceAll('oe', 'o').replaceAll('ue', 'u');
}

// Ethiopic syllables to Latin as an Amharic speaker hears German: ጉተን ታግ → guten tag. Each row of eight letters is
// one consonant; the place in the row is the vowel.
const _rows = {
  0x1200: 'h', 0x1208: 'l', 0x1210: 'h', 0x1218: 'm', 0x1220: 's', 0x1228: 'r', 0x1230: 's', 0x1238: 'sch', //
  0x1240: 'k', 0x1248: 'kw', 0x1250: 'k', 0x1260: 'b', 0x1268: 'w', 0x1270: 't', 0x1278: 'tsch', 0x1280: 'h', 0x1288: 'hw',
  0x1290: 'n', 0x1298: 'nj', 0x12A0: '', 0x12A8: 'k', 0x12B0: 'kw', 0x12B8: 'ch', 0x12C0: 'chw', 0x12C8: 'w', 0x12D0: '',
  0x12D8: 's', 0x12E0: 'sch', 0x12E8: 'j', 0x12F0: 'd', 0x12F8: 'd', 0x1300: 'dsch', 0x1308: 'g', 0x1310: 'gw', 0x1318: 'g',
  0x1320: 't', 0x1328: 'tsch', 0x1330: 'p', 0x1338: 'z', 0x1340: 'z', 0x1348: 'f', 0x1350: 'p',
};
const _vowels = ['e', 'u', 'i', 'a', 'e', '', 'o', 'wa'];
const _carrier = ['a', 'u', 'i', 'a', 'e', 'i', 'o', 'wa']; // አ and ዐ carry a bare vowel

String transliterate(String text) {
  final out = StringBuffer();
  for (final code in text.runes) {
    final base = code - code % 8;
    final row = _rows[base];
    if (code < 0x1200 || code > 0x135a || row == null) {
      out.writeCharCode(code);
      continue;
    }
    final order = code - base;
    out.write(row + (row.isEmpty ? _carrier[order] : _vowels[order]));
  }
  return out.toString();
}

final _ethiopic = RegExp(r'^[ሀ-ፚ]');
final _token = RegExp(r'[a-z0-9]+|[ሀ-ፚ]+');
final _tag = RegExp(r'<[^>]+>');
final _digit = RegExp(r'^[0-9]');

List<String> tokens(String text) => [for (final m in _token.allMatches(fold(text.replaceAll(_tag, ' ')))) m[0]!];

/// English endings, so "ordering", "orders" and "ordered" all find "order".
String stem(String t) {
  if (_digit.hasMatch(t)) return t;
  if (t.length > 4 && t.endsWith('ies')) {
    t = '${t.substring(0, t.length - 3)}y';
  } else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us') && !t.endsWith('is')) {
    t = t.substring(0, t.length - 1);
  }
  if (t.length > 5 && t.endsWith('ing')) {
    t = t.substring(0, t.length - 3);
  } else if (t.length > 4 && t.endsWith('ed')) {
    t = t.substring(0, t.length - 2);
  }
  return t;
}

// How a German word sounds, so spellings by ear meet: gooten → guten, shoen → schön, vas → was, nain → nein.
const _diphthongs = {'ei': '1', 'ai': '1', 'ay': '1', 'ey': '1', 'eu': '2', 'oi': '2', 'oy': '2', 'au': '3', 'ie': 'i', 'ee': 'e', 'oo': 'u', 'ou': 'u', 'aa': 'a'};
final _diphthong = RegExp('ei|ai|ay|ey|eu|oi|oy|au|ie|ee|oo|ou|aa');
const _consonants = [
  ('tsch', 'C'), ('sch', 'S'), ('sh', 'S'), ('ch', 'K'), ('kh', 'K'), ('ck', 'K'), ('ph', 'F'), ('th', 'T'), //
  ('tz', 'Z'), ('ts', 'Z'), ('z', 'Z'), ('qu', 'KF'), ('q', 'K'), ('x', 'KS'), ('c', 'K'), ('k', 'K'), ('v', 'F'), ('w', 'F'),
  ('f', 'F'), ('j', 'Y'), ('y', 'Y'),
];
const _final = {'d': 't', 'b': 'p', 'g': 'K'};
final _sVowel = RegExp('^s(?=[aeiou123])');
final _silentH = RegExp('([aeiou123])h');
final _double = RegExp(r'(.)\1+');

String phonetic(String t) {
  var s = t.replaceAllMapped(_diphthong, (m) => _diphthongs[m[0]]!);
  s = s.replaceFirst(_sVowel, 'Z'); // s before a vowel sounds like z: Sohn, zon
  for (final (from, to) in _consonants) {
    s = s.replaceAll(from, to);
  }
  s = s.replaceAllMapped(_silentH, (m) => m[1]!); // the h in "geht", "Sohn" is not said
  if (s.isNotEmpty && _final.containsKey(s[s.length - 1])) s = s.substring(0, s.length - 1) + _final[s[s.length - 1]]!;
  return s.replaceAllMapped(_double, (m) => m[1]!);
}

/// Edit distance, giving up past [max].
int distance(String a, String b, int max) {
  if ((a.length - b.length).abs() > max) return max + 1;
  var prev = List<int>.generate(b.length + 1, (i) => i);
  for (var i = 1; i <= a.length; i++) {
    final row = List<int>.filled(b.length + 1, 0)..[0] = i;
    var best = i;
    for (var j = 1; j <= b.length; j++) {
      row[j] = math.min(math.min(prev[j] + 1, row[j - 1] + 1), prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
      if (row[j] < best) best = row[j];
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

class _Entry {
  _Entry(this.t)
      : ethiopic = _ethiopic.hasMatch(t),
        stemmed = _ethiopic.hasMatch(t) ? t : stem(t),
        key = _ethiopic.hasMatch(t) ? '' : phonetic(t);
  final String t;
  final bool ethiopic;
  final String stemmed;
  final String key;

  /// Pairs: document, field.
  final post = <int>[];
}

/// A query token: Latin (with its stem and sound) or Ethiopic (and how it sounds in Latin letters).
class _Query {
  _Query(this.t)
      : ethiopic = _ethiopic.hasMatch(t),
        latin = _ethiopic.hasMatch(t) ? fold(transliterate(t)).replaceAll(RegExp('[^a-z]'), '') : '',
        stemmed = _ethiopic.hasMatch(t) ? t : stem(t) {
    key = phonetic(ethiopic ? latin : t);
  }
  final String t;
  final bool ethiopic;
  final String latin;
  final String stemmed;
  late final String key;
}

/// How well a query token matches a token of the index: 1 is the same word. The flag marks a match that only
/// counts in German text (Ethiopic letters read as German sounds).
(double, bool) _quality(_Query q, _Entry e) {
  if (q.ethiopic) {
    if (e.ethiopic) {
      if (e.t == q.t) return (1, false);
      if (q.t.length >= 2 && e.t.startsWith(q.t)) return (0.8, false);
      if (q.t.length >= 2 && e.t.contains(q.t)) return (0.6, false);
      return (0, false);
    }
    if (q.key.length < 2) return (0, false);
    if (e.key == q.key) return (0.7, true);
    if (q.key.length >= 3 && e.key.startsWith(q.key)) return (0.55, true);
    if (q.key.length >= 4 && e.key.isNotEmpty && e.key[0] == q.key[0] && distance(q.key, e.key, 1) <= 1) return (0.45, true);
    return (0, false);
  }
  if (e.ethiopic) return (0, false);
  if (e.t == q.t) return (1, false);
  if (e.stemmed == q.stemmed) return (0.95, false);
  if (q.t.length >= 2 && e.t.startsWith(q.t)) return (q.t.length >= 3 ? 0.7 : 0.6, false); // a beginning: below a word that sounds the same
  if (_digit.hasMatch(q.t)) return (0, false);
  if (q.key.length >= 2 && e.key == q.key) return (0.75, false);
  if (q.key.length >= 3 && e.key.startsWith(q.key)) return (0.6, false);
  if (q.t.length >= 4 && e.t.contains(q.t)) return (0.5, false); // inside a compound: kuchen in Apfelkuchen
  if (q.t.length >= 4 && e.t[0] == q.t[0]) {
    // One slip in a word of four letters or more, two in a long one.
    final max = q.t.length >= 7 ? 2 : 1;
    final d = distance(q.t, e.t, max);
    if (d <= 1) return (0.55, false);
    if (d <= max) return (0.45, false);
  }
  return (0, false);
}

class _Field {
  _Field(this.name, this.weight, this.german, this.size, this.joined);
  final String name;
  final double weight;
  final bool german;

  /// How many tokens the field has.
  final int size;

  /// The field's tokens between spaces, for whole-phrase matches.
  final String joined;
}

enum SearchKind { topic, word, lesson, chapter }

class _Doc {
  _Doc(this.kind, this.type, this.id, this.unit, {this.section, this.word, this.title, this.topic, this.links = const []});
  final SearchKind kind;

  /// word, grammar, reading, chapter or topic (see [searchTypes]).
  final String type;
  final String id;
  final int? unit;
  final String? section;
  final Word? word;
  final String? title;
  final Topic? topic;
  final List<int> links;
  late final List<_Field> fields;

  // Where it belongs, for the filters: every unit and chapter it appears in, and their levels.
  var units = <int>[];
  var sections = <String>[];
  var levels = <String>[];
}

/// Result types for the filters: a word, a grammar (or pronunciation) lesson, a reading text, a chapter's word list,
/// a topic. Word types (noun, verb, adjective, phrase, number, small) come with the course ([Word.pos]).
const searchTypes = ['word', 'grammar', 'reading', 'chapter', 'topic'];

/// What a search is narrowed to; with no words typed, it browses everything that fits, in course order.
class SearchFilters {
  const SearchFilters({this.types = const [], this.pos = const [], this.unit, this.section, this.level});
  final List<String> types;
  final List<String> pos;
  final int? unit;
  final String? section;
  final String? level;

  bool get active => types.isNotEmpty || pos.isNotEmpty || unit != null || (section ?? '').isNotEmpty || (level ?? '').isNotEmpty;

  factory SearchFilters.fromJson(Map<String, dynamic> j) => SearchFilters(
        types: [...?(j['types'] as List?)?.cast<String>()],
        pos: [...?(j['pos'] as List?)?.cast<String>()],
        unit: (j['unit'] as num?)?.toInt(),
        section: j['section'] as String?,
        level: j['level'] as String?,
      );
}

class SearchResult {
  const SearchResult({
    required this.kind,
    required this.type,
    required this.id,
    required this.unit,
    required this.score,
    this.units = const [],
    this.sections = const [],
    this.levels = const [],
    this.section,
    this.word,
    this.pos = '',
    this.example,
    this.title,
    this.topic,
    this.via,
  });
  final SearchKind kind;
  final String type;
  final List<int> units;
  final List<String> sections;
  final List<String> levels;
  final String pos;

  /// The German entry, a lesson or chapter key, or a topic's title.
  final String id;
  final int? unit;
  final double score;
  final String? section;
  final Word? word;

  /// Which of the word's example sentences matched best.
  final int? example;

  /// English, as in the course (show it through the course's translation).
  final String? title;
  final Topic? topic;

  /// The topic that brought this result in, when nothing else matched.
  final String? via;
}

const searchLimits = {SearchKind.topic: 4, SearchKind.lesson: 6, SearchKind.chapter: 6, SearchKind.word: 40};
const _browseLimits = {SearchKind.topic: 50, SearchKind.lesson: 50, SearchKind.chapter: 50, SearchKind.word: 300};

class SearchIndex {
  /// [title] gives the interface's name for a chapter, lesson or topic title (its Amharic), if any.
  SearchIndex(List<Unit> units, List<Topic> topics, {Amharic? amharic, String Function(String)? title}) {
    String tr(String text) => title == null ? text : title(text);
    String other(String text) => tr(text) == text ? '' : tr(text);

    final wordDoc = <String, int>{};
    final chapterDoc = <String, int>{};
    final lessonDoc = <String, int>{};
    final levelOf = {for (final u in units) u.id: u.level};
    void place(_Doc doc, List<int> units, List<String> sections) {
      doc
        ..units = units.toSet().toList()
        ..sections = sections.toSet().toList()
        ..levels = {for (final u in units) levelOf[u] ?? ''}.toList();
    }

    for (final unit in units) {
      for (final section in unit.sections) {
        chapterDoc[section.key] = _add(_Doc(SearchKind.chapter, 'chapter', section.key, unit.id, title: section.title),
            [('title', 8, false, section.title), ('title-am', 8, false, other(section.title))]);
        place(_docs.last, [unit.id], [section.key]);
        for (final word in section.words) {
          if (wordDoc[word.german] case final known?) {
            final doc = _docs[known];
            place(doc, [...doc.units, unit.id], [...doc.sections, section.key]);
            continue;
          }
          final fields = <(String, double, bool, String)>[
            ('german', 10, true, word.german),
            ('meaning', 7, false, word.english),
            ('meaning-am', 7, false, amharic?.words[word.german] ?? ''),
          ];
          for (var i = 0; i < word.examples.length; i++) {
            final (de, en) = word.examples[i];
            fields
              ..add(('ex$i', 3, true, de))
              ..add(('ex$i-en', 2, false, en))
              ..add(('ex$i-am', 2, false, amharic?.examples[de] ?? ''));
          }
          wordDoc[word.german] = _add(_Doc(SearchKind.word, 'word', word.german, unit.id, section: section.key, word: word), fields);
          place(_docs.last, [unit.id], [section.key]);
        }
      }
      for (final lesson in unit.grammar) {
        if (lesson.key.startsWith('test-')) continue;
        final text = [...lesson.intro, for (final b in lesson.blocks) ...[?b.step, ?b.title, ?b.text]].join(' ');
        final type = lesson.blocks.any((b) => b.reading.isNotEmpty) ? 'reading' : 'grammar';
        lessonDoc[lesson.key] = _add(_Doc(SearchKind.lesson, type, lesson.key, unit.id, title: lesson.title),
            [('title', 8, false, lesson.title), ('title-am', 8, false, other(lesson.title)), ('text', 2, false, text)]);
        place(_docs.last, [unit.id], lesson.chapters);
      }
    }
    for (final topic in topics) {
      final links = [
        for (final k in topic.chapters) ?chapterDoc[k],
        for (final k in topic.lessons) ?lessonDoc[k],
        for (final g in topic.words) ?wordDoc[g],
      ];
      _add(_Doc(SearchKind.topic, 'topic', topic.title, null, title: topic.title, topic: topic, links: links), [
        ('title', 9, false, topic.title),
        ('title-am', 9, false, other(topic.title)),
        ('terms', 8, false, topic.en.join(' , ')),
        ('terms-am', 8, false, topic.am.join(' , ')),
      ]);
      place(_docs.last, [for (final i in links) ..._docs[i].units], topic.chapters);
    }
  }

  static bool _fits(_Doc doc, SearchFilters f) {
    if (f.types.isNotEmpty && !f.types.contains(doc.type)) return false;
    if (f.pos.isNotEmpty && !(doc.kind == SearchKind.word && f.pos.contains(doc.word!.pos))) return false;
    if (f.unit != null && !doc.units.contains(f.unit)) return false;
    if ((f.section ?? '').isNotEmpty && !doc.sections.contains(f.section)) return false;
    if ((f.level ?? '').isNotEmpty && !doc.levels.contains(f.level)) return false;
    return true;
  }

  static SearchResult _result(_Doc doc, double total, {int? example, String? via}) => SearchResult(
        kind: doc.kind,
        type: doc.type,
        id: doc.id,
        unit: doc.unit,
        units: doc.units,
        sections: doc.sections,
        levels: doc.levels,
        score: (total * 100).round() / 100,
        section: doc.section,
        word: doc.word,
        pos: doc.word?.pos ?? '',
        example: example,
        title: doc.kind == SearchKind.word ? null : doc.title,
        topic: doc.topic,
        via: via,
      );

  static List<SearchResult> _limited(List<SearchResult> results, Map<SearchKind, int> limits) {
    final counts = <SearchKind, int>{};
    return [
      for (final r in results)
        if ((counts[r.kind] = (counts[r.kind] ?? 0) + 1) <= (limits[r.kind] ?? 1 << 30)) r,
    ];
  }

  final _docs = <_Doc>[];
  final _vocab = <String, _Entry>{};

  int _add(_Doc doc, List<(String, double, bool, String)> fields) {
    final index = _docs.length;
    doc.fields = [
      for (var f = 0; f < fields.length; f++)
        () {
          final (name, weight, german, text) = fields[f];
          final toks = tokens(text);
          for (final t in toks) {
            (_vocab[t] ??= _Entry(t)).post.addAll([index, f]);
          }
          return _Field(name, weight, german, toks.length, ' ${toks.join(' ')} ');
        }(),
    ];
    _docs.add(doc);
    return index;
  }

  List<SearchResult> search(String query, {Map<SearchKind, int> limits = searchLimits, SearchFilters filters = const SearchFilters()}) {
    var words = tokens(query);
    final kept = words.where((t) => !_stop.contains(t)).toList();
    if (kept.isNotEmpty) words = kept;
    words = words.toSet().toList();
    if (words.isEmpty) {
      if (!filters.active) return const [];
      // Browsing: no topics unless asked for, everything else in course order.
      return _limited([
        for (final d in _docs)
          if (_fits(d, filters) && (d.kind != SearchKind.topic || filters.types.contains('topic'))) _result(d, 0),
      ], _browseLimits);
    }
    final qs = [for (final w in words) _Query(w)];
    final n = qs.length;
    final phrase = ' ${words.join(' ')} ';

    // best[doc][token] = (score, field)
    final best = <int, List<(double, int)?>>{};
    for (var qi = 0; qi < n; qi++) {
      final q = qs[qi];
      for (final entry in _vocab.values) {
        final (score, germanOnly) = _quality(q, entry);
        if (score == 0) continue;
        for (var p = 0; p < entry.post.length; p += 2) {
          final d = entry.post[p];
          final f = entry.post[p + 1];
          final field = _docs[d].fields[f];
          if (germanOnly && !field.german) continue;
          final s = score * field.weight;
          final row = best.putIfAbsent(d, () => List<(double, int)?>.filled(n, null));
          final hit = row[qi];
          if (hit == null || s > hit.$1) row[qi] = (s, f);
        }
      }
    }

    final scores = <int, ({double total, List<(double, int)?> row, String? via})>{};
    best.forEach((d, row) {
      final matched = row.where((hit) => hit != null).length;
      if (n <= 2 ? matched < n : matched < (n / 2).ceil()) return;
      final doc = _docs[d];
      var total = row.fold<double>(0, (sum, hit) => sum + (hit?.$1 ?? 0)) * (matched / n) * (matched / n);
      for (var f = 0; f < doc.fields.length; f++) {
        final field = doc.fields[f];
        if (n >= 2 && field.joined.contains(phrase)) total += field.weight * n * 0.5;
        if (field.joined == phrase) total += field.weight * 1.5;
        // Everything in the field was asked for, if spelled differently: schön before "Bitte schön!" for "shoen".
        final here = row.where((hit) => hit != null && hit.$2 == f && hit.$1 >= field.weight * 0.75).length; // whole words, not beginnings
        if (here > 0 && here == field.size) total += field.weight * 0.3;
      }
      scores[d] = (total: total, row: row, via: null);
    });
    // A topic that matches lends its weight to what it links, and comes first among them: it is the answer card.
    for (final MapEntry(key: d, value: hit) in scores.entries.toList()) {
      final doc = _docs[d];
      if (doc.kind != SearchKind.topic) continue;
      for (final link in doc.links) {
        final linked = scores[link];
        scores[link] = linked != null
            ? (total: linked.total + hit.total * 0.5, row: linked.row, via: linked.via)
            : (total: hit.total * 0.5, row: const [], via: doc.title);
      }
      scores[d] = (total: hit.total * 1.5, row: hit.row, via: hit.via);
    }

    final results = [
      for (final MapEntry(key: d, value: (:total, :row, :via)) in scores.entries)
        if (_fits(_docs[d], filters))
        () {
          final doc = _docs[d];
          int? example;
          if (doc.kind == SearchKind.word) {
            // The example sentence that matched best, to show under the word.
            (double, int)? top;
            for (final hit in row) {
              if (hit == null || !RegExp(r'^ex\d').hasMatch(doc.fields[hit.$2].name)) continue;
              if (top == null || hit.$1 > top.$1) top = hit;
            }
            if (top != null) example = int.parse(RegExp(r'^ex(\d+)').firstMatch(doc.fields[top.$2].name)![1]!);
          }
          return _result(doc, total, example: example, via: via);
        }(),
    // Ties: the shorter entry (a word before a sentence with it), then by id.
    ]..sort((a, b) => a.score != b.score
        ? b.score.compareTo(a.score)
        : a.id.length != b.id.length
            ? a.id.length.compareTo(b.id.length)
            : a.id.compareTo(b.id));
    return _limited(results, limits);
  }
}
