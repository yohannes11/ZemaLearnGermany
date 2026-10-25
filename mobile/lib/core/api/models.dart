/// The API's data, as served by web/apps/api (version 1). The course shapes come from
/// web/tools/course_content.py (the same file the website's course page loads); keep these in step when it changes.
library;

List<String> _strings(Object? list) => [...?(list as List?)?.map((e) => '$e')];
List<(String, String)> _pairs(Object? list) =>
    [...?(list as List?)?.map((p) => ('${(p as List)[0]}', '${p.length > 1 ? p[1] : ''}'))];

class Word {
  const Word({required this.german, required this.english, this.pic = const []});
  final String german;
  final String english;

  /// Twemoji picture codes; compound words show their parts.
  final List<String> pic;

  factory Word.fromJson(Map<String, dynamic> j) =>
      Word(german: j['german'] as String, english: j['english'] as String? ?? '', pic: _strings(j['pic']));
}

class Section {
  const Section({required this.key, required this.title, required this.words});
  final String key;
  final String title;
  final List<Word> words;

  factory Section.fromJson(Map<String, dynamic> j) => Section(
        key: '${j['key']}',
        title: j['title'] as String? ?? '',
        words: [for (final w in j['words'] as List? ?? []) Word.fromJson((w as Map).cast())],
      );
}

class LessonTable {
  const LessonTable({required this.head, required this.rows, this.say = const [], this.highlight});
  final List<String> head;
  final List<List<String>> rows;
  final List<String> say;
  final int? highlight;

  factory LessonTable.fromJson(Map<String, dynamic> j) => LessonTable(
        head: _strings(j['head']),
        rows: [for (final r in j['rows'] as List? ?? []) _strings(r)],
        say: _strings(j['say']),
        highlight: (j['highlight'] as num?)?.toInt(),
      );
}

class Block {
  const Block({this.step, this.title, this.text, this.table, this.examples = const [], this.reading = const [], this.glossary = const []});
  final String? step;
  final String? title;
  final String? text;
  final LessonTable? table;

  /// (German, meaning)
  final List<(String, String)> examples;

  /// Paragraphs of a reading text.
  final List<String> reading;

  /// (German, meaning)
  final List<(String, String)> glossary;

  factory Block.fromJson(Map<String, dynamic> j) => Block(
        step: j['step'] as String?,
        title: j['title'] as String?,
        text: j['text'] as String?,
        table: j['table'] == null ? null : LessonTable.fromJson((j['table'] as Map).cast()),
        examples: _pairs(j['examples']),
        reading: _strings(j['reading']),
        glossary: _pairs(j['glossary']),
      );
}

/// A quiz item: choose, listen, gap, order or write. The fields differ by type, so the item keeps its JSON;
/// features/lessons/questions.dart turns it into a question.
class QuizItem {
  const QuizItem(this.raw);
  final Map<String, dynamic> raw;

  String get type => raw['type'] as String? ?? 'choose';
  String get answer => '${raw['answer'] ?? ''}';
  String? get say => raw['say'] as String?;
  String? get prompt => raw['prompt'] as String?;
  String? get hint => raw['hint'] as String?;
  String? get why => raw['why'] as String?;
  List<String> get options => _strings(raw['options']);
}

class Lesson {
  const Lesson({
    required this.key,
    required this.code,
    required this.title,
    this.chapters = const [],
    this.intro = const [],
    this.blocks = const [],
    this.rules = const [],
    this.quizTitle,
    this.quiz = const [],
    this.custom,
  });

  final String key;
  final String code;
  final String title;
  final List<String> chapters;
  final List<String> intro;
  final List<Block> blocks;

  /// (rule, example)
  final List<(String, String)> rules;
  final String? quizTitle;
  final List<QuizItem> quiz;

  /// A lesson built by the app itself: "review" (the unit test), "present" (verb endings), "countries".
  final String? custom;

  factory Lesson.fromJson(Map<String, dynamic> j) {
    final quiz = (j['quiz'] as Map?)?.cast<String, dynamic>();
    return Lesson(
      key: '${j['key']}',
      code: '${j['code'] ?? ''}',
      title: j['title'] as String? ?? '',
      chapters: _strings(j['chapters']),
      intro: _strings(j['intro']),
      blocks: [for (final b in j['blocks'] as List? ?? []) Block.fromJson((b as Map).cast())],
      rules: _pairs(j['rules']),
      quizTitle: quiz?['title'] as String?,
      quiz: [for (final i in quiz?['items'] as List? ?? []) QuizItem((i as Map).cast())],
      custom: j['custom'] as String?,
    );
  }
}

class Unit {
  const Unit({required this.id, this.label, required this.title, this.lessonsLabel, required this.sections, required this.grammar});
  final int id;
  final String? label;
  final String title;

  /// What this unit calls its lessons (the Start unit's are "Pronunciation").
  final String? lessonsLabel;
  final List<Section> sections;
  final List<Lesson> grammar;

  factory Unit.fromJson(Map<String, dynamic> j) => Unit(
        id: (j['id'] as num).toInt(),
        label: j['label'] as String?,
        title: j['title'] as String? ?? '',
        lessonsLabel: j['lessonsLabel'] as String?,
        sections: [for (final s in j['sections'] as List? ?? []) Section.fromJson((s as Map).cast())],
        grammar: [for (final g in j['grammar'] as List? ?? []) Lesson.fromJson((g as Map).cast())],
      );

  /// Every word of the unit once, in course order.
  List<Word> get words {
    final seen = <String>{};
    return [for (final s in sections) for (final w in s.words) if (seen.add(w.german)) w];
  }
}

class Amharic {
  const Amharic({required this.words, required this.text});
  final Map<String, String> words;
  final Map<String, String> text;

  factory Amharic.fromJson(Map<String, dynamic> j) => Amharic(
        words: {...?(j['words'] as Map?)?.map((k, v) => MapEntry('$k', '$v'))},
        text: {...?(j['text'] as Map?)?.map((k, v) => MapEntry('$k', '$v'))},
      );
}

class CourseBundle {
  const CourseBundle({required this.version, required this.lang, required this.units, this.amharic, this.texts = const {}});

  /// Changes whenever the course, its Amharic or an admin's published text changes.
  final String version;
  final String lang;
  final List<Unit> units;
  final Amharic? amharic;

  /// Text admins changed on the site: wherever `key` would be shown, show the value instead.
  final Map<String, String> texts;

  factory CourseBundle.fromJson(Map<String, dynamic> j) => CourseBundle(
        version: j['version'] as String? ?? '',
        lang: j['lang'] as String? ?? 'en',
        units: [for (final u in ((j['course'] as Map)['units'] as List)) Unit.fromJson((u as Map).cast())],
        amharic: j['amharic'] == null ? null : Amharic.fromJson((j['amharic'] as Map).cast()),
        texts: {...?(j['texts'] as Map?)?.map((k, v) => MapEntry('$k', '$v'))},
      );
}

class ApiIndex {
  const ApiIndex({required this.minAppVersion, required this.audioBase, required this.audioManifest, required this.pictureBase});
  final String minAppVersion;
  final String audioBase;
  final String audioManifest;
  final String pictureBase;

  factory ApiIndex.fromJson(Map<String, dynamic> j) {
    final audio = (j['audio'] as Map).cast<String, dynamic>();
    return ApiIndex(
      minAppVersion: j['minAppVersion'] as String? ?? '0',
      audioBase: audio['base'] as String,
      audioManifest: audio['manifest'] as String,
      pictureBase: j['pictureBase'] as String,
    );
  }
}

class User {
  const User({required this.id, required this.username, required this.email, required this.name, required this.role});
  final int id;
  final String username;
  final String email;
  final String name;
  final String role;

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: (j['id'] as num).toInt(),
        username: j['username'] as String? ?? '',
        email: j['email'] as String? ?? '',
        name: j['name'] as String? ?? '',
        role: j['role'] as String? ?? 'learner',
      );

  Map<String, dynamic> toJson() => {'id': id, 'username': username, 'email': email, 'name': name, 'role': role};

  String get firstName => name.trim().isEmpty ? username : name.trim().split(' ').first;
}

class Source {
  const Source({required this.publisher, required this.title, required this.date, required this.url});
  final String publisher, title, date, url;
  factory Source.fromJson(Map<String, dynamic> j) =>
      Source(publisher: '${j['publisher']}', title: '${j['title']}', date: '${j['date']}', url: '${j['url']}');
}

class WhyStat {
  const WhyStat({required this.display, required this.label, required this.detail, required this.source});
  final String display, label, detail;
  final Source source;
  factory WhyStat.fromJson(Map<String, dynamic> j) => WhyStat(
      display: '${j['display']}', label: '${j['label']}', detail: '${j['detail']}', source: Source.fromJson((j['source'] as Map).cast()));
}

class WhyImage {
  const WhyImage({required this.url, required this.credit, required this.width, required this.height});
  final String url, credit;
  final int width, height;
}

class WhyPath {
  const WhyPath({required this.key, required this.title, required this.body, this.needs, this.image, required this.sources, required this.stats});
  final String key, title, body;
  final String? needs;
  final WhyImage? image;
  final List<Source> sources;

  /// Indexes into the figures that back this reason.
  final List<int> stats;

  factory WhyPath.fromJson(Map<String, dynamic> j) {
    final image = (j['image'] as Map?)?.cast<String, dynamic>();
    return WhyPath(
      key: '${j['key']}',
      title: '${j['title']}',
      body: '${j['body']}',
      needs: j['needs'] as String?,
      image: image == null
          ? null
          : WhyImage(
              url: '${image['url']}',
              credit: '${image['credit']}',
              width: (image['width'] as num).toInt(),
              height: (image['height'] as num).toInt()),
      sources: [for (final s in j['sources'] as List? ?? []) Source.fromJson((s as Map).cast())],
      stats: [for (final i in j['stats'] as List? ?? []) (i as num).toInt()],
    );
  }
}

/// Why learn German: the website's landing page figures, each with its official source.
class WhyGerman {
  const WhyGerman({required this.lang, required this.stats, required this.paths});
  final String lang;
  final List<WhyStat> stats;
  final List<WhyPath> paths;
  factory WhyGerman.fromJson(Map<String, dynamic> j) => WhyGerman(
        lang: '${j['lang']}',
        stats: [for (final s in j['stats'] as List? ?? []) WhyStat.fromJson((s as Map).cast())],
        paths: [for (final p in j['paths'] as List? ?? []) WhyPath.fromJson((p as Map).cast())],
      );
}
