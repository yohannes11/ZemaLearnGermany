import '../../core/sync/engine.dart';
import '../../core/sync/rules.dart';
import 'tally.dart' as tally;

/// The game's rules in one place, the same numbers as the website (course.js `XP`). XP rewards effort and
/// progress; levels grow a little further apart each time, so early levels come quickly and later ones still feel earned.
abstract final class XP {
  /// A word marked as known for the first time.
  static const newWord = 10;

  /// A review card answered right / wrong (trying still counts a little).
  static const reviewRight = 5;
  static const reviewWrong = 1;

  /// A quiz or listening question answered right.
  static const answerRight = 10;

  /// Completing a lesson exercise, and getting every question right.
  static const lessonPassed = 25;
  static const perfect = 15;
}

class DailyGoal {
  const DailyGoal(this.xp, this.name, this.time);
  final int xp;
  final String name;
  final String time;
}

/// Daily goals the learner can pick, in XP per day (the website's streak dialog has the same four).
const dailyGoals = [
  DailyGoal(30, 'Casual', '5 min a day'),
  DailyGoal(50, 'Regular', '10 min a day'),
  DailyGoal(100, 'Serious', '15 min a day'),
  DailyGoal(150, 'Intense', '20 min a day'),
];

/// XP needed to reach `level` (level 1 starts at 0): 100, 300, 600, 1000, …
int levelStart(int level) => 50 * level * (level - 1);

class Level {
  const Level(this.level, this.intoLevel, this.span, this.toNext);
  final int level, intoLevel, span, toNext;
  double get share => intoLevel / span;
}

Level levelFor(int totalXp) {
  var level = 1;
  while (levelStart(level + 1) <= totalXp) {
    level += 1;
  }
  final start = levelStart(level);
  final next = levelStart(level + 1);
  return Level(level, totalXp - start, next - start, next - totalXp);
}

/// Everything the game shows, from the synced progress: the streak tally (the same rules as the website's
/// tally.js), XP, level and today's goal.
class Game {
  Game(SyncState state) : days = state.days, timeline = tally.timeline(days: state.days, xp: state.xp, goals: state.goals) {
    totalXp = state.xp.values.fold(0, (a, b) => a + b);
    level = levelFor(totalXp);
  }

  final List<String> days;
  final tally.Timeline timeline;
  late final int totalXp;
  late final Level level;

  int get streak => timeline.streak;
  int get freezes => timeline.freezes;
  int get todayXp => timeline.todayXp;
  int get dailyGoal => timeline.goal;
  bool get goalMet => timeline.todayMet;
  bool get practisedToday => days.contains(tally.today());

  static Game get current => Game(sync.state);
}
