import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/course.dart';
import '../core/i18n.dart';
import '../core/sync/engine.dart';
import '../features/gamification/tally_view.dart';
import '../features/lessons/lesson_content.dart';
import '../features/progress/progress.dart';
import '../ui/primitives.dart';
import '../ui/theme.dart';
import '../ui/watch.dart';
import 'words_screens.dart';

/// Learning modules: each unit's grammar lessons, reading texts, unit test and listening practice.
class LessonsScreen extends StatelessWidget {
  const LessonsScreen({super.key});

  @override
  Widget build(BuildContext context) => CourseGate(builder: (context) {
        final c = context.c;
        final all = [for (final u in course.units) ...u.grammar];
        final done = all.where(lessonPassed).length;
        return Scaffold(
          appBar: AppBar(title: Txt(T('Lessons'), role: TextRole.title)),
          body: PageList(gap: Space.sm, children: [
            const StatChips(),
            Txt(T('{passed} of {total} lessons', {'passed': done, 'total': all.length}), role: TextRole.caption, colour: c.muted),
            Bar(value: all.isEmpty ? 0 : done / all.length),
            for (final unit in course.units) ...[
              SectionHeader(
                course.t(unit.title),
                kicker: '${course.unitName(unit)} · ${unit.grammar.where(lessonPassed).length}/${unit.grammar.length}',
              ),
              for (final g in unit.grammar) LessonCard(unit: unit, lesson: g, path: '/lessons/${g.key}'),
              ListeningCard(unit: unit),
            ],
          ]),
        );
      });
}

/// A lesson: its explanation to read, then its exercise, always one tap away at the bottom. An exercise left open
/// here or on another device continues at that question.
class LessonScreen extends StatelessWidget {
  const LessonScreen({super.key, required this.lessonKey});
  final String lessonKey;

  @override
  Widget build(BuildContext context) => CourseGate(builder: (context) {
        final c = context.c;
        final found = course.lesson(lessonKey);
        if (found == null) return Scaffold(appBar: AppBar(), body: const Center(child: Txt('This lesson is no longer in the course.')));
        final (:unit, :lesson) = found;
        final (_, kind) = lessonLook(lesson, unit);
        final best = sync.state.grammar[lesson.key];
        final size = sizeOf(lesson);
        final pass = passOf(lesson);
        final s = sync.openSession;
        final open = s != null && s['kind'] == 'quiz' && s['ref'] == lesson.key ? s : null;
        final hasExercise = lesson.custom != null || lesson.quiz.isNotEmpty;
        return Scaffold(
          appBar: AppBar(title: Txt(kind, role: TextRole.heading)),
          body: Column(children: [
            Expanded(
              child: PageList(children: [
                Txt('${course.unitName(unit)} · $kind', role: TextRole.overline, colour: c.brand),
                Txt(course.t(lesson.title), role: TextRole.title),
                // The website's exercise callout: what completes it, and the best score so far.
                AppCard(
                  colour: c.brandSoft,
                  child: ListRowPlain(
                    leading: Badge2(icon: Icons.edit_note_rounded, colour: c.brandInk, background: c.brand),
                    kicker: T('Exercise · {n} quick questions', {'n': size}),
                    kickerColour: c.brand,
                    title: best == null
                        ? (lesson.custom == 'review' ? T('Test yourself on the whole unit') : T('Test yourself on this lesson'))
                        : best >= pass
                            ? T('Keep it fresh: practise again')
                            : T('Try again and beat your score'),
                    detail: best == null ? T('Score {n} or more to complete it.', {'n': pass}) : T('Best score so far: {best} of {total}.', {'best': best, 'total': size}),
                  ),
                ),
                LessonContent(unit: unit, lesson: lesson),
              ]),
            ),
            if (hasExercise)
              Container(
                padding: const EdgeInsets.all(Space.md),
                decoration: BoxDecoration(color: c.bg, border: Border(top: BorderSide(color: c.border, width: 0.8))),
                child: SafeArea(
                  top: false,
                  child: Column(children: gapped([
                    if (open != null)
                      AppButton(
                        label: 'Continue · question ${(open['position'] as num).toInt() + 1} of ${(open['items'] as List).length}',
                        icon: Icons.play_circle_fill_rounded,
                        kind: ButtonKind.gold,
                        onPressed: () => context.push('/session/quiz/${lesson.key}?resume=1'),
                      ),
                    AppButton(
                      label: open != null ? T('Start over') : (best == null ? T('Start the exercise') : T('Practise again')),
                      icon: open != null ? Icons.restart_alt_rounded : Icons.play_arrow_rounded,
                      kind: open != null ? ButtonKind.secondary : ButtonKind.primary,
                      onPressed: () => context.push('/session/quiz/${lesson.key}'),
                    ),
                  ], Space.sm)),
                ),
              ),
          ]),
        );
      });
}
