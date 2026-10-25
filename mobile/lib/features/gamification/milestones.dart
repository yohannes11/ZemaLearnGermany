import 'package:flutter/material.dart';

import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/settings.dart';
import '../../core/sync/engine.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../progress/progress.dart';
import 'game.dart';
import '../../ui/watch.dart';

class Milestone {
  const Milestone(this.id, this.icon, this.name, this.goal);
  final String id;
  final IconData icon;
  final String name;

  /// (have, need) from the learner's facts.
  final (int, int) Function(Facts f) goal;
}

class Facts {
  const Facts(this.words, this.total, this.tests, this.streak);
  final int words, total, tests, streak;
}

/// The website's milestones (course.js `BADGES`), with the same thresholds.
final milestones = [
  Milestone('first-words', Icons.menu_book_rounded, 'First words', (f) => (f.words, 10)),
  Milestone('hundred-words', Icons.style_rounded, '100 words', (f) => (f.words, 100)),
  Milestone('halfway', Icons.format_list_bulleted_rounded, 'Halfway there', (f) => (f.words, (f.total / 2).ceil())),
  Milestone('first-test', Icons.emoji_events_rounded, 'First unit test', (f) => (f.tests, 1)),
  Milestone('week-streak', Icons.local_fire_department_rounded, '7-day streak', (f) => (f.streak, 7)),
  Milestone('month-streak', Icons.local_fire_department_rounded, '30-day streak', (f) => (f.streak, 30)),
];

Facts _facts() {
  final known = sync.state.learned.toSet();
  final words = course.allWords;
  return Facts(
    words.where((w) => known.contains(w.german)).length,
    words.length,
    course.units.where((u) => u.grammar.any((g) => g.custom == 'review' && lessonPassed(g))).length,
    Game.current.streak,
  );
}

/// Milestones earned once stay earned, even if a streak later breaks (as on the website, kept per device).
Set<String> earnedMilestones() {
  final facts = _facts();
  final earned = settings.badges.toSet();
  final fresh = [
    for (final m in milestones)
      if (!earned.contains(m.id) && m.goal(facts).$1 >= m.goal(facts).$2) m.id,
  ];
  if (fresh.isNotEmpty) {
    WidgetsBinding.instance.addPostFrameCallback((_) => settings.update(() => settings.badges = {...settings.badges, ...fresh}.toList()));
  }
  return {...earned, ...fresh};
}

/// The milestones: earned ones in gold; the rest show how far there is to go.
class MilestonesCard extends StatelessWidget {
  const MilestonesCard({super.key});

  // Listens itself: it is built const, so its parent redrawing would not redraw it.
  @override
  Widget build(BuildContext context) => Watch(builder: _build);

  Widget _build(BuildContext context) {
    final c = context.c;
    final facts = _facts();
    final earned = earnedMilestones();
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Txt(T('Milestones'), role: TextRole.heading),
        const SizedBox(height: Space.md),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: Space.sm,
          crossAxisSpacing: Space.sm,
          childAspectRatio: 0.85,
          children: [
            for (final m in milestones)
              Builder(builder: (context) {
                final (have, need) = m.goal(facts);
                final on = earned.contains(m.id);
                return Semantics(
                  label: '${T(m.name)}: ${on ? T('Earned') : '${have.clamp(0, need)} / $need'}',
                  excludeSemantics: true,
                  child: Column(children: [
                    Badge2(icon: m.icon, colour: on ? const Color(0xFF1F1300) : c.subtle, background: on ? c.goldBright : c.surface2, size: 48),
                    const SizedBox(height: Space.xs),
                    Txt(T(m.name), role: TextRole.label, align: TextAlign.center, maxLines: 2),
                    Txt(on ? T('Earned') : '${have.clamp(0, need)}/$need', role: TextRole.caption, colour: on ? c.xp : c.muted),
                  ]),
                );
              }),
          ],
        ),
      ]),
    );
  }
}
