import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/sync/engine.dart';

/// The learner's progress, as the rest of the app changes it. Every change is an operation for the sync engine
/// (core/sync), which shows it at once and sends it to the account; other devices' changes arrive the same way.

void setLearned(String german, bool learned) {
  if (sync.state.learned.contains(german) == learned) return;
  sync.record({'kind': 'word', 'german': german, 'learned': learned});
}

/// A word met for the first time (shown, matched, said or typed right): learned, with the website's XP for it.
void learnWord(String german) {
  if (sync.state.learned.contains(german)) return;
  setLearned(german, true);
  awardXp(10);
}

/// A lesson score; only a new best is worth sending (the server keeps the best anyway).
void recordScore(String lesson, int score) {
  final best = sync.state.grammar[lesson];
  if (best == null || score > best) sync.record({'kind': 'score', 'lesson': lesson, 'score': score});
}

/// XP for something the learner just did; any XP also makes today a practised day.
void awardXp(int amount) {
  if (amount > 0) sync.record({'kind': 'xp', 'amount': amount});
}

/// The daily goal, in XP. Synced: every device judges each day by the goal in force that day.
void setDailyGoal(int xp) => sync.record({'kind': 'goal', 'xp': xp});

/// As on the website (course.js): a lesson exercise is 8 questions and 6 right completes it; a unit test is 12
/// and three quarters (9) complete it.
const quizSize = 8;
const passMark = 6;
const reviewSize = 12;
const reviewPass = 9;

int sizeOf(Lesson lesson) => lesson.custom == 'review' ? reviewSize : quizSize;
int passOf(Lesson lesson) => lesson.custom == 'review' ? reviewPass : passMark;

bool lessonPassed(Lesson lesson) => (sync.state.grammar[lesson.key] ?? -1) >= passOf(lesson);

/// The website's estimate: a word met, heard and checked takes about 20 seconds; a lesson about 4 minutes.
const _secondsPerWord = 20;
const _minutesPerLesson = 4;

class NextStep {
  const NextStep({required this.unit, required this.key, required this.title, required this.minutes, this.left = 0, this.lesson = false});
  final Unit unit;
  final String key;
  final String title;
  final int minutes;
  final int left;
  final bool lesson;
}

/// The next thing to do, as the website's progress column says it: the first section with words left, then the
/// first lesson not yet completed; null when the course is done.
NextStep? nextStep() {
  final known = sync.state.learned.toSet();
  for (final unit in course.units) {
    for (final section in unit.sections) {
      final left = section.words.map((w) => w.german).toSet().where((g) => !known.contains(g)).length;
      if (left > 0) {
        final minutes = (left * _secondsPerWord / 60).round();
        return NextStep(unit: unit, key: section.key, title: section.title, left: left, minutes: minutes < 1 ? 1 : minutes);
      }
    }
  }
  for (final unit in course.units) {
    for (final lesson in unit.grammar) {
      if (!lessonPassed(lesson)) {
        return NextStep(unit: unit, key: lesson.key, title: lesson.title, minutes: _minutesPerLesson, lesson: true);
      }
    }
  }
  return null;
}

/// The first section, in course order, that still has words to learn.
({Unit unit, Section section, int left})? nextSection() {
  final known = sync.state.learned.toSet();
  for (final unit in course.units) {
    for (final section in unit.sections) {
      final left = section.words.where((w) => !known.contains(w.german)).length;
      if (left > 0) return (unit: unit, section: section, left: left);
    }
  }
  return null;
}

/// The first lesson, in course order, not yet completed.
({Unit unit, Lesson lesson})? nextLesson() {
  for (final unit in course.units) {
    for (final lesson in unit.grammar) {
      if (!lessonPassed(lesson)) return (unit: unit, lesson: lesson);
    }
  }
  return null;
}

/// How far a unit is: its words learned, and whether its unit test is passed (a pennant on the map).
({int done, int total, bool testPassed}) unitProgress(Unit unit) {
  final known = sync.state.learned.toSet();
  final words = unit.words;
  final test = unit.grammar.where((g) => g.custom == 'review').firstOrNull;
  return (
    done: words.where((w) => known.contains(w.german)).length,
    total: words.length,
    testPassed: test != null && lessonPassed(test),
  );
}
