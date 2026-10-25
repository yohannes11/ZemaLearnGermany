/// The stick-strikeout streak tally, ported line for line from the website's web/static/core/js/tally.js, so the
/// streak, the sticks, their positions, colours and timing are identical on both. Change both together; the
/// website's own tests are repeated in test/tally_test.dart.
///
/// One stick per day of the current streak:
/// - a day the learner practised keeps the streak alive: a stick ("kept");
/// - a day they reached their daily goal: the stick gets a bold diagonal strikeout ("met");
/// - today, until its goal is reached: a glowing stick ("today"), counted in the streak once practised;
/// - a missed day covered by a streak freeze: an icy stick ("frozen");
/// - the day a streak broke: one muted stick before the new streak ("missed").
/// Sticks are bundled in fives; a bundle whose five days all reached the goal is bound with a gold band.
/// Every five goal days in a streak earn a freeze (at most two), and a freeze covers one missed day by itself.
///
/// Everything is computed from the synced facts (days practised, XP per day, the daily goal's history), never
/// stored, so every device shows the same tally. Days are the learner's own calendar days (YYYY-MM-DD).
library;

import '../../core/sync/rules.dart' show GoalChange;

const _dayMs = 86400000;
const defaultGoal = 50;
const bundle = 5;
const maxFreezes = 2;
// A broken streak shows the day it broke only while it is recent.
const _showBreakDays = 2;

String _pad(int n) => n.toString().padLeft(2, '0');
// Calendar arithmetic in UTC, so daylight-saving changes can never skip or repeat a day.
int _parse(String day) {
  final p = day.split('-').map(int.parse).toList();
  return DateTime.utc(p[0], p[1], p[2]).millisecondsSinceEpoch;
}

String _key(int ms) {
  final d = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
  return '${d.year}-${_pad(d.month)}-${_pad(d.day)}';
}

String addDays(String day, int n) => _key(_parse(day) + n * _dayMs);

/// The learner's calendar day now (the phone's time zone).
String today([DateTime? date]) {
  final d = date ?? DateTime.now();
  return '${d.year}-${_pad(d.month)}-${_pad(d.day)}';
}

/// The daily goal in force on `day`: the latest change made on or before it.
int goalOn(List<GoalChange> goals, String day, int fallback) {
  GoalChange? best;
  for (final g in goals) {
    if (g.day.compareTo(day) > 0) continue;
    if (best == null || g.at > best.at || (g.at == best.at && g.id.compareTo(best.id) > 0)) best = g;
  }
  return best?.xp ?? fallback;
}

enum Mark { met, kept, today, frozen, missed }

class TallyMark {
  const TallyMark(this.day, this.state, this.isToday);
  final String day;
  final Mark state;
  final bool isToday;
}

class Timeline {
  const Timeline({
    required this.streak,
    required this.freezes,
    required this.goal,
    required this.todayXp,
    required this.todayMet,
    required this.marks,
    required this.broken,
  });

  final int streak;
  final int freezes;
  final int goal;
  final int todayXp;
  final bool todayMet;
  final List<TallyMark> marks;

  /// The day the last streak broke, while recent; null otherwise.
  final String? broken;
}

/// The streak and its marks.
Timeline timeline({
  List<String> days = const [],
  Map<String, int> xp = const {},
  List<GoalChange> goals = const [],
  String? now,
  int fallback = defaultGoal,
}) {
  final day0 = now ?? today();
  final practised = days.toSet();
  bool met(String day) => (xp[day] ?? 0) >= goalOn(goals, day, fallback);

  final before = practised.where((d) => d.compareTo(day0) < 0).toList()..sort();
  var run = <TallyMark>[];
  var freezes = 0;
  var metInRun = 0;
  String? broken;
  for (var day = before.isEmpty ? null : before.first; day != null && day.compareTo(day0) < 0; day = addDays(day, 1)) {
    if (practised.contains(day)) {
      final m = met(day);
      run.add(TallyMark(day, m ? Mark.met : Mark.kept, false));
      if (m && ++metInRun % bundle == 0) freezes = (freezes + 1).clamp(0, maxFreezes);
    } else if (freezes > 0) {
      freezes--;
      run.add(TallyMark(day, Mark.frozen, false));
    } else {
      if (run.isNotEmpty) broken = day;
      run = [];
      metInRun = 0;
      freezes = 0;
    }
  }
  final todayMet = met(day0);
  // Today glows until its goal is reached; practising already keeps the streak going, so it counts.
  run.add(TallyMark(day0, todayMet ? Mark.met : Mark.today, true));
  final streak = run.where((m) => m.state == Mark.met || m.state == Mark.kept).length +
      (practised.contains(day0) && !todayMet ? 1 : 0);
  final recentBreak =
      broken != null && run.length == 1 && broken.compareTo(addDays(day0, -_showBreakDays)) >= 0 ? broken : null;
  return Timeline(
    streak: streak,
    freezes: freezes,
    goal: goalOn(goals, day0, fallback),
    todayXp: xp[day0] ?? 0,
    todayMet: todayMet,
    marks: run,
    broken: recentBreak,
  );
}

class TallySize {
  const TallySize(this.height, this.pitch, this.gap, this.stroke, this.strike, this.maxSticks, this.pad);
  final double height, pitch, gap, stroke, strike;
  final int maxSticks;
  final double pad;
}

/// Sizes for a tally: "full" (Home, profile, results) and "compact" (top bars).
const sizes = {
  'full': TallySize(30, 12, 14, 3.2, 3.6, 20, 6),
  'compact': TallySize(16, 7, 7, 2.2, 2.4, 5, 3),
};

class Stick {
  const Stick(this.x, this.y1, this.y2, this.state, this.day, this.isToday);
  final double x, y1, y2;
  final Mark state;
  final String day;
  final bool isToday;
}

class Strike {
  const Strike(this.x1, this.y1, this.x2, this.y2, this.day);
  final double x1, y1, x2, y2;
  final String day;
}

class Band {
  const Band(this.x1, this.x2, this.y);
  final double x1, x2, y;
}

class TallyLayout {
  const TallyLayout(this.width, this.height, this.sticks, this.strikes, this.bands, this.hidden, this.size);
  final double width, height;
  final List<Stick> sticks;
  final List<Strike> strikes;
  final List<Band> bands;

  /// Days in bundles too old to show (shown as "+n"); the newest days are always visible.
  final int hidden;
  final TallySize size;
}

/// Where everything goes, in drawing units.
TallyLayout layout(Timeline model, [String sizeName = 'full']) {
  final s = sizes[sizeName] ?? sizes['full']!;
  final marks = model.marks;
  final firstBundle = ((marks.length - s.maxSticks) / bundle).ceil().clamp(0, 1 << 30);
  final hidden = firstBundle * bundle;
  final top = s.pad;
  final bottom = top + s.height;
  var x0 = s.pad + s.stroke;
  final sticks = <Stick>[];
  final strikes = <Strike>[];
  final bands = <Band>[];
  if (model.broken != null) {
    sticks.add(Stick(x0, top, bottom, Mark.missed, model.broken!, false));
    x0 += s.pitch + s.gap;
  }
  double bundleX(int b) => x0 + (b - firstBundle) * (bundle * s.pitch + s.gap);
  for (var i = hidden; i < marks.length; i++) {
    final b = i ~/ bundle;
    final x = bundleX(b) + (i % bundle) * s.pitch;
    sticks.add(Stick(x, top, bottom, marks[i].state, marks[i].day, marks[i].isToday));
    if (marks[i].state == Mark.met) {
      // Each strike crosses its own stick only, so every day stays readable.
      final half = s.pitch * 0.36;
      strikes.add(Strike(x - half, top + s.height * 0.78, x + half, top + s.height * 0.22, marks[i].day));
    }
  }
  for (var bi = firstBundle; bi * bundle + bundle <= marks.length; bi++) {
    var all = true;
    for (var j = 0; j < bundle; j++) {
      all = all && marks[bi * bundle + j].state == Mark.met;
    }
    if (all) bands.add(Band(bundleX(bi) - s.stroke, bundleX(bi) + (bundle - 1) * s.pitch + s.stroke, bottom + s.stroke + 1));
  }
  final last = sticks.isNotEmpty ? sticks.last.x : x0;
  return TallyLayout(last + s.stroke + s.pad + s.pitch * 0.36, bottom + s.stroke * 2 + 3 + s.pad, sticks, strikes, bands,
      hidden, s);
}

/// Motion, shared with the website: the strikeout draws itself, today's stick glows.
const strikeMs = 420;
const strikeStaggerMs = 90;
const glowMs = 1600;
