import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/course.dart';
import '../core/i18n.dart';
import '../core/session.dart';
import '../core/sync/engine.dart';
import '../features/gamification/game.dart';
import '../features/gamification/milestones.dart';
import '../features/gamification/tally_view.dart';
import '../features/progress/course_map.dart';
import '../features/progress/progress.dart';
import '../features/vocabulary/srs.dart';
import '../ui/primitives.dart';
import '../ui/theme.dart';
import '../ui/watch.dart';

String _greeting() {
  final hour = DateTime.now().hour;
  return hour < 11 ? 'Guten Morgen' : (hour < 18 ? 'Guten Tag' : 'Guten Abend');
}

/// Home: the course map, today's goal and streak, what to do next, milestones and the whole course's progress
/// (the website's progress column). It only links into units, sections and lessons.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) => CourseGate(builder: (context) {
        final c = context.c;
        final game = Game.current;
        final user = session.user;
        final due = dueWords().length;
        final section = nextSection();
        final lesson = nextLesson();
        final step = nextStep();
        return Scaffold(
          body: SafeArea(
            bottom: false,
            child: ListView(padding: const EdgeInsets.only(bottom: Space.xxl * 2), children: [
              // The course as a map across the top, as on the website: tap a place to open its unit.
              const CourseMap(),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Space.md),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
                      Txt(user != null ? '${_greeting()}, ${user.firstName}!' : '${_greeting()}!', role: TextRole.title),
                      const StatChips(),
                      _TodayCard(game: game),
                      AppCard(
                        child: Row(children: [
                          Badge2(icon: Icons.shield_rounded, colour: c.brandInk, background: c.brand),
                          const SizedBox(width: Space.md),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Wrap(spacing: Space.sm, crossAxisAlignment: WrapCrossAlignment.end, children: [
                                Txt('Level ${game.level.level}', role: TextRole.subheading),
                                Txt('${game.level.toNext} XP to level ${game.level.level + 1}', role: TextRole.caption, colour: c.muted),
                              ]),
                              const SizedBox(height: Space.xs),
                              Bar(value: game.level.share),
                            ]),
                          ),
                        ]),
                      ),
                      SectionHeader(T('Continue')),
                      const ResumeCard(),
                      if (step != null) _UpNext(step: step),
                      if (due > 0)
                        AppCard(
                          accent: c.goldBright,
                          onTap: () => context.push('/session/cards?review=1'),
                          child: ListRow(
                            leading: Badge2(icon: Icons.psychology_rounded, colour: c.xp, background: c.goldSoft),
                            kicker: T('Review'),
                            kickerColour: c.xp,
                            title: '$due ${due == 1 ? 'word is' : 'words are'} due',
                            detail: 'Review now, before they fade.',
                          ),
                        ),
                      if (section != null && step?.key != section.section.key)
                        AppCard(
                          accent: c.goldBright,
                          onTap: () => context.push('/section/${section.section.key}'),
                          child: ListRow(
                            leading: Badge2(icon: Icons.style_rounded, colour: c.xp, background: c.goldSoft),
                            kicker: 'New words · ${course.unitName(section.unit)}',
                            kickerColour: c.xp,
                            title: course.t(section.section.title),
                            detail: T('{n} words to learn', {'n': section.left}),
                          ),
                        ),
                      if (lesson != null && step?.key != lesson.lesson.key)
                        AppCard(
                          accent: c.brand,
                          onTap: () => context.push('/lesson/${lesson.lesson.key}'),
                          child: ListRow(
                            leading: Badge2(icon: Icons.school_rounded, colour: c.brand, background: c.brandSoft),
                            kicker: 'Next lesson · ${course.unitName(lesson.unit)}',
                            title: course.t(lesson.lesson.title),
                          ),
                        ),
                      const MilestonesCard(),
                      const _CourseMeters(),
                      if (user == null)
                        AppCard(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
                            const Txt('Keep your streak on every device', role: TextRole.subheading),
                            Txt('A free account saves your words, scores and XP, here and on the website.', role: TextRole.caption, colour: c.muted),
                            AppButton(label: 'Sign in or sign up', kind: ButtonKind.secondary, icon: Icons.person_add_alt_rounded, onPressed: () => context.push('/sign-in')),
                          ], Space.sm)),
                        ),
                    ], Space.md)),
                  ),
                ),
              ),
            ]),
          ),
        );
      });
}

class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.game});
  final Game game;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final t = game.timeline;
    return AppCard(
      raised: true,
      onTap: () => showStreakSheet(context),
      semanticLabel: '${T('Your streak')}: ${describeTally(t)}',
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          GoalRing(
            value: game.todayXp / game.dailyGoal,
            size: 92,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Txt('${game.todayXp}', role: TextRole.heading, colour: game.goalMet ? c.xp : c.text),
              Txt(T('of {goal} XP', {'goal': game.dailyGoal}), role: TextRole.caption, colour: c.muted, style: const TextStyle(fontSize: 11)),
            ]),
          ),
          const SizedBox(width: Space.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Txt(T('Today'), role: TextRole.overline, colour: c.muted),
              Row(children: [
                Icon(Icons.local_fire_department_rounded, color: c.flame, size: 22),
                const SizedBox(width: Space.xs),
                Flexible(child: Txt(t.streak > 0 ? T('{n}-day streak', {'n': t.streak}) : T('No streak yet'), role: TextRole.heading)),
              ]),
              Txt(
                game.goalMet
                    ? T('Today is struck off. See you tomorrow!')
                    : game.practisedToday
                        ? T('{n} XP more strikes off today', {'n': game.dailyGoal - game.todayXp})
                        : t.streak > 0
                            ? 'Practise today to keep your ${t.streak}-day streak.'
                            : t.broken != null
                                ? 'Your streak was reset. Start a new one today.'
                                : 'Earn some XP to start a streak.',
                role: TextRole.caption,
                colour: c.muted,
              ),
            ]),
          ),
        ]),
        const SizedBox(height: Space.md),
        Row(children: [
          const Expanded(child: Align(alignment: Alignment.centerLeft, child: TallyView(feel: true))),
          if (game.freezes > 0)
            Semantics(
              label: '${game.freezes} streak ${game.freezes == 1 ? 'freeze' : 'freezes'}: a missed day won\'t break your streak',
              excludeSemantics: true,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: Space.sm, vertical: Space.xs),
                decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(Radii.pill)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.ac_unit_rounded, size: 16, color: c.freeze),
                  const SizedBox(width: 2),
                  Txt('${game.freezes}', role: TextRole.label, colour: c.freeze),
                ]),
              ),
            ),
        ]),
      ]),
    );
  }
}

/// The website's "Up next": the exact next step, with how much is left and roughly how long it takes.
class _UpNext extends StatelessWidget {
  const _UpNext({required this.step});
  final NextStep step;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final colour = step.lesson ? c.brand : c.xp;
    return AppCard(
      raised: true,
      accent: step.lesson ? c.brand : c.goldBright,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
        Txt(T('Up next'), role: TextRole.overline, colour: colour),
        Txt(course.t(step.title), role: TextRole.heading),
        Txt(
          '${course.unitName(step.unit)} · ${step.lesson ? course.t(step.unit.lessonsLabel ?? 'Grammar') : T('{n} words to learn', {'n': step.left})}',
          role: TextRole.caption,
          colour: c.muted,
        ),
        AppButton(
          label: '${step.lesson ? T('Start lesson') : T('Begin')} · ${T('about {n} min', {'n': step.minutes})}',
          kind: step.lesson ? ButtonKind.primary : ButtonKind.gold,
          icon: Icons.arrow_forward_rounded,
          onPressed: () => context.push(step.lesson ? '/lesson/${step.key}' : '/section/${step.key}'),
        ),
      ], Space.xs)),
    );
  }
}

/// The whole course: words learned and lessons completed.
class _CourseMeters extends StatelessWidget {
  const _CourseMeters();

  // Listens itself: it is built const, so its parent redrawing would not redraw it.
  @override
  Widget build(BuildContext context) => Watch(builder: _build);

  Widget _build(BuildContext context) {
    final c = context.c;
    final known = sync.state.learned.toSet();
    final words = course.allWords;
    final knownCount = words.where((w) => known.contains(w.german)).length;
    final lessons = [for (final u in course.units) ...u.grammar];
    final passed = lessons.where(lessonPassed).length;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
        Txt(T('Your course'), role: TextRole.heading),
        Txt(T('{known} of {total} words', {'known': knownCount, 'total': words.length}), role: TextRole.caption, colour: c.muted),
        Bar(value: words.isEmpty ? 0 : knownCount / words.length, colour: c.goldBright),
        Txt(T('{passed} of {total} lessons', {'passed': passed, 'total': lessons.length}), role: TextRole.caption, colour: c.muted),
        Bar(value: lessons.isEmpty ? 0 : passed / lessons.length),
      ], Space.xs)),
    );
  }
}

/// "Continue where you stopped": the exercise left open on this or any other device (the website included), at
/// the exact question. It comes from the account, so it appears here moments after it was left elsewhere.
class ResumeCard extends StatelessWidget {
  const ResumeCard({super.key});

  // Listens itself: it is built const, so its parent redrawing would not redraw it.
  @override
  Widget build(BuildContext context) => Watch(builder: _build);

  Widget _build(BuildContext context) {
    final c = context.c;
    final s = sync.openSession;
    if (s == null) return const SizedBox.shrink();
    final kind = s['kind'];
    final ref = '${s['ref']}';
    String? title;
    if (kind == 'quiz') {
      final found = course.lesson(ref);
      if (found != null && found.lesson.custom == null) title = course.t(found.lesson.title);
    } else if (kind == 'cards') {
      title = ref == 'review'
          ? T('Review')
          : ref.startsWith('unit:')
              ? T('All chapters')
              : course.section(ref) == null
                  ? null
                  : course.t(course.section(ref)!.section.title);
    }
    if (title == null) return const SizedBox.shrink();
    final position = (s['position'] as num).toInt();
    final total = (s['items'] as List).length;
    final where = s['device'] == sync.device ? 'here' : (s['platform'] == 'web' ? 'on the website' : 'on your other phone');
    return AppCard(
      raised: true,
      accent: c.brand,
      onTap: () => context.push(kind == 'quiz' ? '/session/quiz/$ref?resume=1' : '/session/cards?resume=1'),
      semanticLabel: 'Continue $title at the question where you stopped',
      child: Column(children: [
        Row(children: [
          Badge2(icon: s['platform'] == 'web' ? Icons.desktop_windows_rounded : Icons.phone_android_rounded, colour: c.brandInk, background: c.brand),
          const SizedBox(width: Space.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Txt('Continue where you stopped $where', role: TextRole.overline, colour: c.brand),
              Txt(title, role: TextRole.subheading),
              Txt('${kind == 'quiz' ? 'Question' : 'Card'} ${position + 1} of $total', role: TextRole.caption, colour: c.muted),
            ]),
          ),
          Icon(Icons.play_circle_fill_rounded, size: 32, color: c.brand),
        ]),
        const SizedBox(height: Space.sm),
        Bar(value: position / total, height: 6),
      ]),
    );
  }
}
