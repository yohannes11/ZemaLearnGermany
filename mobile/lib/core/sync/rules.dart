/// Progress sync rules: the same as the server's (web/apps/course/sync.py), so the app can show the result of its
/// own changes at once, offline too. Both are checked against web/apps/course/tests/sync_cases.json
/// (test/sync_rules_test.dart).
///
/// - word, review, session: the latest change wins (by `at`, then by id).
/// - score: the best score is kept.
/// - xp: every operation adds its points once.
/// - days practised: every word, review, score and xp operation marks its `day`.
/// - goal: every change is kept, in time order (the streak tally judges each day by the goal in force then).
///
/// Operations travel as JSON maps exactly as the server takes them: `{id, kind, at, day, ...fields}`.
library;

typedef Op = Map<String, dynamic>;

/// A word's review schedule. `at`/`id` decide which review wins.
class Review {
  const Review({required this.box, required this.due, this.at = 0, this.id = ''});

  final int box;
  final String due;
  final int at;
  final String id;

  factory Review.fromJson(Map<String, dynamic> json) => Review(
        box: (json['box'] as num?)?.toInt() ?? 0,
        due: json['due'] as String? ?? '',
        at: (json['at'] as num?)?.toInt() ?? 0,
        id: json['id'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {'box': box, 'due': due, 'at': at, 'id': id};
}

/// A daily goal change: the day it was made, when, the goal in XP, and its operation id.
class GoalChange {
  const GoalChange(this.day, this.at, this.xp, this.id);

  final String day;
  final int at;
  final int xp;
  final String id;

  factory GoalChange.fromJson(List<dynamic> json) =>
      GoalChange(json[0] as String, (json[1] as num).toInt(), (json[2] as num).toInt(), json[3] as String);

  List<dynamic> toJson() => [day, at, xp, id];
}

/// The learner's whole state, as the server sends it (`GET /api/v1/sync/`), plus two fields kept only here.
class SyncState {
  const SyncState({
    this.revision = 0,
    this.learned = const [],
    this.grammar = const {},
    this.days = const [],
    this.xp = const {},
    this.srs = const {},
    this.goals = const [],
    this.session,
    this.wordLog = const {},
    this.sessionStamp,
  });

  final int revision;
  final List<String> learned;
  final Map<String, int> grammar;
  final List<String> days;
  final Map<String, int> xp;
  final Map<String, Review> srs;

  /// Daily goal changes, oldest first. The goal in force on a day is the latest made on or before it.
  final List<GoalChange> goals;

  /// The open exercise, or null: {kind, ref, items, answers, position, done, platform, device, at, id}.
  final Map<String, dynamic>? session;

  /// When each word last changed here: (learned, at, id). Not sent by the server; only for local ordering.
  final Map<String, (bool, int, String)> wordLog;

  /// A cleared session's stamp, so an older position can't bring it back.
  final (int, String)? sessionStamp;

  static const empty = SyncState();

  factory SyncState.fromJson(Map<String, dynamic> json) => SyncState(
        revision: (json['revision'] as num?)?.toInt() ?? 0,
        learned: [...?(json['learned'] as List?)?.cast<String>()],
        grammar: {...?(json['grammar'] as Map?)?.map((k, v) => MapEntry(k as String, (v as num).toInt()))},
        days: [...?(json['days'] as List?)?.cast<String>()],
        xp: {...?(json['xp'] as Map?)?.map((k, v) => MapEntry(k as String, (v as num).toInt()))},
        srs: {
          ...?(json['srs'] as Map?)
              ?.map((k, v) => MapEntry(k as String, Review.fromJson((v as Map).cast<String, dynamic>()))),
        },
        goals: [...?(json['goals'] as List?)?.map((g) => GoalChange.fromJson(g as List))],
        session: (json['session'] as Map?)?.cast<String, dynamic>(),
      );

  /// What the server sends: everything but the two local fields.
  Map<String, dynamic> toJson() => {
        'revision': revision,
        'learned': learned,
        'grammar': grammar,
        'days': days,
        'xp': xp,
        'srs': srs.map((k, v) => MapEntry(k, v.toJson())),
        'goals': [for (final g in goals) g.toJson()],
        'session': session,
      };

  SyncState copyWith({
    List<String>? learned,
    Map<String, int>? grammar,
    List<String>? days,
    Map<String, int>? xp,
    Map<String, Review>? srs,
    List<GoalChange>? goals,
    Map<String, dynamic>? Function()? session,
    Map<String, (bool, int, String)>? wordLog,
    (int, String)? sessionStamp,
  }) =>
      SyncState(
        revision: revision,
        learned: learned ?? this.learned,
        grammar: grammar ?? this.grammar,
        days: days ?? this.days,
        xp: xp ?? this.xp,
        srs: srs ?? this.srs,
        goals: goals ?? this.goals,
        session: session != null ? session() : this.session,
        wordLog: wordLog ?? this.wordLog,
        sessionStamp: sessionStamp ?? this.sessionStamp,
      );
}

const _practice = {'word', 'review', 'score', 'xp'};

int _at(Op op) => (op['at'] as num).toInt();
String _id(Op op) => op['id'] as String;

bool _newer(int at, String id, (int, String)? current) {
  if (current == null) return true;
  return at != current.$1 ? at > current.$1 : id.compareTo(current.$2) > 0;
}

/// Time order, then id: the order the server applies a batch in.
int compareOps(Op a, Op b) {
  final byTime = _at(a).compareTo(_at(b));
  return byTime != 0 ? byTime : _id(a).compareTo(_id(b));
}

/// `op` applied to `state`, as a new state (the input is not changed).
SyncState apply(SyncState state, Op op) {
  final kind = op['kind'] as String;
  final at = _at(op);
  final id = _id(op);
  final day = op['day'] as String;
  var next = state;
  if (_practice.contains(kind) && !state.days.contains(day)) next = next.copyWith(days: [...state.days, day]..sort());

  switch (kind) {
    case 'word':
      final german = op['german'] as String;
      final learned = op['learned'] as bool;
      final log = state.wordLog[german];
      if (_newer(at, id, log == null ? null : (log.$2, log.$3))) {
        final others = state.learned.where((w) => w != german).toList();
        next = next.copyWith(
          wordLog: {...state.wordLog, german: (learned, at, id)},
          learned: learned ? [...others, german] : others,
        );
      }
    case 'review':
      final german = op['german'] as String;
      final current = state.srs[german];
      if (_newer(at, id, current == null ? null : (current.at, current.id))) {
        next = next.copyWith(srs: {
          ...state.srs,
          german: Review(box: (op['box'] as num).toInt(), due: op['due'] as String, at: at, id: id),
        });
      }
    case 'score':
      final lesson = op['lesson'] as String;
      final score = (op['score'] as num).toInt();
      final best = state.grammar[lesson];
      if (best == null || score > best) next = next.copyWith(grammar: {...state.grammar, lesson: score});
    case 'xp':
      next = next.copyWith(xp: {...state.xp, day: (state.xp[day] ?? 0) + (op['amount'] as num).toInt()});
    case 'goal':
      if (!state.goals.any((g) => g.id == id)) {
        final goals = [...state.goals, GoalChange(day, at, (op['xp'] as num).toInt(), id)]
          ..sort((a, b) => a.at != b.at ? a.at.compareTo(b.at) : a.id.compareTo(b.id));
        next = next.copyWith(goals: goals);
      }
    case 'session':
      final open = state.session;
      final stamp = open != null && open['at'] != null
          ? ((open['at'] as num).toInt(), open['id'] as String? ?? '')
          : state.sessionStamp;
      if (_newer(at, id, stamp)) {
        final session = (op['session'] as Map?)?.cast<String, dynamic>();
        next = next.copyWith(
          session: () => session == null ? null : {...session, 'done': session['done'] ?? false, 'at': at, 'id': id},
          sessionStamp: (at, id),
        );
      }
  }
  return next;
}

/// Operations applied in time order, each id once: what the server would arrive at.
SyncState applyAll(SyncState state, Iterable<Op> ops) {
  final seen = <String>{};
  final unique = [for (final op in ops) if (seen.add(_id(op))) op]..sort(compareOps);
  return unique.fold(state, apply);
}
