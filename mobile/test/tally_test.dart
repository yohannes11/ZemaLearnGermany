// The streak tally (lib/features/gamification/tally.dart), against the same cases as the website's tally.js.
import 'package:flutter_test/flutter_test.dart';
import 'package:zema_german/core/sync/rules.dart';
import 'package:zema_german/features/gamification/tally.dart' as tally;

const T = '2026-10-10';
String day(int n) => tally.addDays(T, n);
List<tally.Mark> states(tally.Timeline t) => [for (final m in t.marks) m.state];
const met = tally.Mark.met, kept = tally.Mark.kept, today = tally.Mark.today, frozen = tally.Mark.frozen;

void main() {
  test('practice keeps the streak; the goal strikes the day', () {
    final t = tally.timeline(now: T, days: [day(-2), day(-1), T], xp: {day(-2): 60, day(-1): 10, T: 50});
    expect(states(t), [met, kept, met]);
    expect(t.streak, 3);
    expect(t.todayMet, isTrue);
  });

  test('today glows until its goal is reached, and counts once practised', () {
    expect(states(tally.timeline(now: T, days: [day(-1)], xp: {day(-1): 50})), [met, today]);
    expect(tally.timeline(now: T, days: [day(-1)]).streak, 1);
    final practising = tally.timeline(now: T, days: [day(-1), T], xp: {T: 20});
    expect(states(practising), [kept, today]);
    expect(practising.streak, 2);
  });

  test('a missed day breaks the streak and shows while recent', () {
    final t = tally.timeline(now: T, days: [day(-3), day(-2)]);
    expect(t.streak, 0);
    expect(t.broken, day(-1));
    expect(states(t), [today]);
    expect(tally.timeline(now: T, days: [day(-9), day(-8)]).broken, isNull); // long ago: not shown
  });

  test('five goal days earn a freeze that covers one missed day', () {
    final days = [-7, -6, -5, -4, -3, -1].map(day).toList();
    final t = tally.timeline(now: T, days: days, xp: {for (final d in days) d: 50});
    expect(states(t), [met, met, met, met, met, frozen, met, today]);
    expect(t.streak, 6);
    expect(t.freezes, 0);
  });

  test('each day is judged by the goal in force that day', () {
    final goals = [GoalChange(day(-5), 1, 30, 'a'), GoalChange(day(-1), 2, 100, 'b')];
    final t = tally.timeline(now: T, days: [day(-2), day(-1)], xp: {day(-2): 40, day(-1): 40}, goals: goals);
    expect(states(t), [met, kept, today]);
    expect(t.goal, 100);
  });

  test('layout: bundles of five, a gold band on a full bundle, old bundles folded away', () {
    final days = List.generate(26, (i) => day(i - 26));
    final model = tally.timeline(now: T, days: days, xp: {for (final d in days) d: 50});
    final full = tally.layout(model, 'full');
    expect(full.hidden, 10);
    expect(full.sticks.length, 17); // days 11-26 and today
    expect(full.strikes.length, 16);
    expect(full.bands.length, greaterThanOrEqualTo(3));
    final gap = full.sticks[5].x - full.sticks[4].x;
    expect(gap, greaterThan(full.sticks[1].x - full.sticks[0].x), reason: 'bundles are set apart');
    expect(tally.layout(model, 'compact').sticks.length, lessThanOrEqualTo(5));
  });

  test('dates cross month ends and daylight-saving changes', () {
    expect(tally.addDays('2026-10-31', 1), '2026-11-01');
    expect(tally.addDays('2026-03-29', 1), '2026-03-30');
    expect(tally.addDays('2027-01-01', -1), '2026-12-31');
  });
}
