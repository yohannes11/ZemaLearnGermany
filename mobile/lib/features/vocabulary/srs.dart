import 'package:intl/intl.dart';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/sync/engine.dart';
import '../gamification/tally.dart' as tally;

/// Spaced repetition (a Leitner system): each word sits in a box, and each box waits longer before its next
/// review. A right answer moves a word up a box, a wrong one sends it back to the start, due again today.
/// Review schedules sync with the account (the latest review of a word wins), so reviews follow the learner.

/// Days to wait after reaching each box.
const _intervals = [0, 1, 2, 4, 8, 16, 32];
const reviewSessionSize = 20;

void grade(String german, bool right) {
  final current = sync.state.srs[german]?.box ?? 0;
  final box = right ? (current + 1).clamp(0, _intervals.length - 1) : 0;
  sync.record({'kind': 'review', 'german': german, 'box': box, 'due': tally.addDays(tally.today(), _intervals[box])});
}

/// The words to review today, most overdue first. Learned words with no review history (learned on the website)
/// count as due, so everything learned gets revisited.
List<Word> dueWords([String? today]) {
  final day = today ?? tally.today();
  final srs = sync.state.srs;
  final known = sync.state.learned.toSet();
  final due = course.allWords.where((w) => srs[w.german] != null ? srs[w.german]!.due.compareTo(day) <= 0 : known.contains(w.german)).toList()
    ..sort((a, b) => (srs[a.german]?.due ?? '').compareTo(srs[b.german]?.due ?? ''));
  return due;
}

/// When the next review comes up, for the "all caught up" message.
String? nextDue([String? today]) {
  final day = today ?? tally.today();
  final upcoming = sync.state.srs.values.map((r) => r.due).where((d) => d.compareTo(day) > 0).toList()..sort();
  return upcoming.firstOrNull;
}

/// A review day as people say it: "today", "tomorrow", else the weekday and date ("Mon, 13 Oct").
String describeDay(String day, [String? today]) {
  final now = today ?? tally.today();
  if (day.compareTo(now) <= 0) return T('today');
  if (day == tally.addDays(now, 1)) return T('tomorrow');
  return DateFormat('EEE, d MMM').format(DateTime.parse(day));
}
