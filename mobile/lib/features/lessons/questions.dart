import 'dart:math';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/offline/audio.dart';
import '../progress/progress.dart';

final _random = Random();

List<T> shuffle<T>(Iterable<T> items) => [...items]..shuffle(_random);

enum QuestionType { choice, order, write }

/// One question of any kind, as the website builds it (course.js: forLanguage, withChoices, buildOrder, buildWrite,
/// makeQuestions, reviewQuestions).
class Question {
  Question({
    required this.type,
    this.prompt = '',
    this.hint,
    required this.answer,
    this.say,
    this.listen = false,
    this.shown,
    this.why,
    this.whyIfWrong,
    this.options = const [],
    this.label,
    this.before,
    this.after,
    this.tiles = const [],
    this.lines = false,
    this.alts = const [],
    this.text,
    this.toGerman = false,
    this.answerLabel,
  });

  final QuestionType type;
  final String prompt;
  final String? hint;

  /// The right answer, as the options carry it (shown through [label]).
  final String answer;

  /// German to play: before answering for listening questions, after answering otherwise.
  final String? say;
  final bool listen;

  /// Shown as the answer afterwards (the item's `show`, else `say`).
  final String? shown;
  final String? why;

  /// An explanation shown only after a wrong answer (verb endings).
  final String? whyIfWrong;
  final List<String> options;
  final String Function(String option)? label;

  /// A gap in a sentence: before ___ after.
  final String? before;
  final String? after;

  /// Word tiles (or dialogue lines) put in order.
  final List<String> tiles;
  final bool lines;
  final List<String> alts;

  /// A typed answer: the text to translate or the dictation.
  final String? text;
  final bool toGerman;

  /// What the answer under the feedback is called: "Correct form", "You heard", "The word", "Answer".
  final String? answerLabel;

  String show(String option) => label?.call(option) ?? course.t(option);
}

String _feedbackLabel(QuizItem item) {
  if (item.type == 'listen') return T('You heard');
  if (item.type == 'order' || item.type == 'write' || item.say == null) return T('Answer');
  if (item.say != item.answer && item.type == 'choose') return T('The word');
  return T('Correct form');
}

/// "What does it mean in English?" asks for an Amharic meaning in Amharic: typed Amharic has too many right
/// wordings to check fairly, so it becomes a choice between this meaning and two from the same unit.
Question? _amharicChoice(QuizItem item, Unit unit) {
  final am = course.bundle?.amharic;
  if (am == null || course.lang != 'am' || item.type != 'write' || item.raw['lang'] != 'en') return null;
  String amharic(QuizItem i) => am.words['${i.raw['text']}'] ?? course.t(i.answer);
  final right = amharic(item);
  final fromUnit = [for (final g in unit.grammar) for (final i in g.quiz) if (i.type == 'write' && i.raw['lang'] == 'en') amharic(i)];
  final fromWords = unit.words.map(course.meaning);
  final others = {...shuffle(fromUnit), ...shuffle(fromWords)}.where((o) => o != right).take(2);
  return Question(
    type: QuestionType.choice,
    prompt: T('What does “{word}” mean?', {'word': item.raw['text']}),
    answer: right,
    options: shuffle([right, ...others]),
    label: (o) => o,
    say: item.say,
    shown: right,
    answerLabel: T('Answer'),
  );
}

/// One quiz item as a question.
Question fromItem(QuizItem item, Unit unit) {
  final amharic = _amharicChoice(item, unit);
  if (amharic != null) return amharic;
  final raw = item.raw;
  final t = course.t;
  final listen = item.type == 'listen' || raw['listen'] == true;
  final shown = raw['show'] is String ? raw['show'] as String : item.say;
  final alts = [...?(raw['alts'] as List?)?.map((a) => '$a')];
  final hint = item.hint == null || item.hint!.isEmpty ? null : t(item.hint!);
  final why = item.why == null || item.why!.isEmpty ? null : t(item.why!);
  final label = _feedbackLabel(item);

  switch (item.type) {
    case 'order':
      return Question(
        type: QuestionType.order,
        prompt: t(item.prompt ?? ''),
        hint: hint,
        answer: item.answer,
        say: item.say,
        shown: shown,
        why: why,
        tiles: [...?(raw['tiles'] as List?)?.map((a) => '$a')],
        lines: raw['mode'] == 'lines',
        alts: alts,
        answerLabel: label,
      );
    case 'write':
      return Question(
        type: QuestionType.write,
        prompt: t(item.prompt ?? ''),
        hint: hint,
        answer: item.answer,
        say: item.say,
        listen: listen,
        shown: shown,
        why: why,
        text: raw['text'] is String ? t(raw['text'] as String) : null,
        toGerman: raw['lang'] == 'de',
        alts: alts,
        answerLabel: label,
      );
    case 'gap':
      return Question(
        type: QuestionType.choice,
        prompt: listen ? T('Listen and fill the gap') : T('Fill the gap'),
        hint: hint,
        answer: item.answer,
        say: item.say,
        listen: listen,
        shown: shown,
        why: why,
        options: shuffle(item.options),
        before: '${raw['before'] ?? ''}',
        after: '${raw['after'] ?? ''}',
        answerLabel: label,
      );
    default: // choose, listen
      return Question(
        type: QuestionType.choice,
        prompt: t(item.prompt ?? ''),
        hint: hint ?? (item.type == 'choose' ? T('Choose the correct German sentence.') : null),
        answer: item.answer,
        say: item.say,
        listen: listen,
        shown: shown,
        why: why,
        options: shuffle(item.options),
        answerLabel: label,
      );
  }
}

/// A lesson's exercise: its quiz items drawn at random (or the items an exercise saved on another device), as
/// item numbers, so any device can rebuild the very same questions.
({List<int> items, List<Question> questions}) lessonQuestions(Lesson lesson, Unit unit, [List<int>? saved]) {
  final all = lesson.quiz;
  final picked = saved != null
      ? saved.where((i) => i >= 0 && i < all.length).toList()
      : shuffle(List.generate(all.length, (i) => i)).take(sizeOf(lesson)).toList();
  return (items: picked, questions: [for (final i in picked) fromItem(all[i], unit)]);
}

/// The unit test: questions from every lesson of the unit, plus vocabulary in both directions (12 in all).
List<Question> reviewQuestions(Unit unit) {
  final pool = shuffle([for (final g in unit.grammar) if (g.custom == null) ...g.quiz]).map((i) => fromItem(i, unit)).toList();
  final fromLessons = pool.take(min(pool.length, reviewSize - 4)).toList();
  final words = shuffle(unit.words.where((w) => w.german.length <= 40));
  final fromWords = <Question>[];
  for (var i = 0; i < reviewSize - fromLessons.length && i < words.length; i++) {
    final w = words[i];
    final others = shuffle(words.where((o) => o.german != w.german && course.meaning(o) != course.meaning(w))).take(2).toList();
    fromWords.add(i.isOdd
        ? Question(
            type: QuestionType.choice,
            prompt: T('What does “{word}” mean?', {'word': w.german}),
            hint: T('Choose the English meaning.'),
            answer: course.meaning(w),
            options: shuffle([course.meaning(w), ...others.map(course.meaning)]),
            label: (o) => o,
            say: w.german,
            answerLabel: T('The word'),
            shown: w.german,
          )
        : Question(
            type: QuestionType.choice,
            prompt: T('How do you say “{word}” in German?', {'word': course.meaning(w)}),
            hint: T('Choose the German.'),
            answer: w.german,
            options: shuffle([w.german, ...others.map((o) => o.german)]),
            label: (o) => o,
            say: w.german,
            answerLabel: T('Correct form'),
          ));
  }
  return shuffle([...fromLessons, ...fromWords]);
}

/* The verb-endings lesson ("present") and the countries lesson, which the website builds from these tables. */

class Verb {
  const Verb(this.inf, this.stem, this.en);
  final String inf, stem, en;
}

List<Verb> get verbs => [
      Verb('machen', 'mach', T('to do / make')),
      Verb('kochen', 'koch', T('to cook')),
      Verb('kommen', 'komm', T('to come')),
      Verb('heißen', 'heiß', T('to be called')),
    ];

/// Table rows: label, pronoun used for audio, ending, meaning.
List<(String, String, String, String)> get persons => [
      ('ich', 'ich', 'e', T('I')),
      ('du', 'du', 'st', T('you')),
      ('er / sie / es', 'er', 't', T('he / she / it')),
      ('wir', 'wir', 'en', T('we')),
      ('ihr', 'ihr', 't', T('you all')),
      ('sie / Sie', 'sie', 'en', T('they / you (formal)')),
    ];

List<(String, int, String)> get _quizPronouns => [
      ('ich', 0, T('I')),
      ('du', 1, T('you')),
      ('er', 2, T('he')),
      ('sie', 2, T('she')),
      ('es', 2, T('it')),
      ('wir', 3, T('we')),
      ('ihr', 4, T('you all')),
      ('sie', 5, T('they')),
      ('Sie', 5, T('you (formal)')),
    ];

/// du adds only -t when the stem already ends in an s-sound (heiß → du heißt).
String endingFor(Verb verb, int person) => person == 1 && RegExp(r'[sßzx]$').hasMatch(verb.stem) ? 't' : persons[person].$3;

class Country {
  const Country(this.nom, this.gender, this.aus, this.rest, this.en);
  final String nom, gender, aus, rest, en;
}

List<Country> get countries => [
      Country('die Schweiz', T('feminine'), 'aus der', 'Schweiz', T('Switzerland')),
      Country('die Türkei', T('feminine'), 'aus der', 'Türkei', T('Turkey')),
      Country('die Vereinigten Staaten', T('plural'), 'aus den', 'Vereinigten Staaten', T('the United States')),
      Country('die Niederlande', T('plural'), 'aus den', 'Niederlanden', T('the Netherlands')),
      Country('die Vereinigten Arabischen Emirate', T('plural'), 'aus den', 'Vereinigten Arabischen Emiraten', T('the UAE')),
    ];

List<(String, String)> get _noArticle => [('Deutschland', T('Germany')), ('Äthiopien', T('Ethiopia')), ('Österreich', T('Austria'))];

/// The website's custom exercises: verb endings or aus / aus der / aus den, 8 questions each.
List<Question> customQuestions(String kind) {
  if (kind == 'present') {
    final all = <Question>[];
    for (final v in verbs) {
      for (final (p, person, en) in _quizPronouns) {
        final ending = endingFor(v, person);
        all.add(Question(
          type: QuestionType.choice,
          prompt: T('Choose the right ending'),
          before: '$p ${v.stem}',
          after: '',
          hint: '${v.inf} · $en',
          answer: ending,
          options: const ['e', 'st', 't', 'en'],
          label: (o) => '-$o',
          say: '$p ${v.stem}$ending',
          answerLabel: T('Correct form'),
          whyIfWrong: p == 'du' && ending == 't'
              ? T('The stem ends in ß, so du only adds -t.')
              : T('{who} always takes -{ending}.', {'who': p, 'ending': ending}),
        ));
      }
    }
    return shuffle(all).take(quizSize).toList();
  }
  final items = [
    for (final c in countries) (c.aus, c.rest, c.en),
    for (final (rest, en) in _noArticle) ('aus', rest, en),
  ];
  return [
    for (final (answer, rest, en) in shuffle(items).take(quizSize))
      Question(
        type: QuestionType.choice,
        prompt: T('aus, aus der or aus den?'),
        before: 'Ich komme ',
        after: ' $rest.',
        hint: T('I come from {country}.', {'country': en}),
        answer: answer,
        options: const ['aus', 'aus der', 'aus den'],
        label: (o) => o,
        say: 'Ich komme $answer $rest.',
        answerLabel: T('Correct form'),
        why: answer == 'aus'
            ? T('No article: this country is used without one.')
            : answer == 'aus der'
                ? T('Feminine country: die → der after aus.')
                : T('Plural country: die → den after aus.'),
      ),
  ];
}

const listeningSize = 10;

/// Listening practice for a unit: hear a word or phrase and pick what was said, among others from the same unit,
/// plus the unit's own listening items. Needs the recordings (saved, or streamed online).
List<Question> listeningQuestions(Unit unit) {
  final words = unit.words.where((w) => audio.hasClip(w.german)).toList();
  final fromWords = [
    for (final word in shuffle(words).take(listeningSize))
      Question(
        type: QuestionType.choice,
        prompt: T('What do you hear?'),
        options: shuffle([word.german, ...shuffle(words.where((w) => w.german != word.german)).take(3).map((w) => w.german)]),
        label: (o) => o,
        answer: word.german,
        say: word.german,
        listen: true,
        why: '${word.german} = ${course.meaning(word)}',
        answerLabel: T('You heard'),
      ),
  ];
  final fromLessons = [
    for (final g in unit.grammar)
      for (final item in g.quiz)
        if (item.type == 'listen' && item.say != null && audio.hasClip(item.say!)) fromItem(item, unit),
  ];
  return shuffle([...fromWords, ...shuffle(fromLessons).take(4)]).take(listeningSize).toList();
}
