import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api/models.dart';
import '../core/course.dart';
import '../core/i18n.dart';
import '../core/sync/engine.dart';
import '../features/gamification/tally_view.dart';
import '../features/lessons/lesson_content.dart' show Panel;
import '../features/progress/progress.dart';
import '../features/vocabulary/srs.dart';
import '../features/vocabulary/word_widgets.dart';
import '../ui/primitives.dart';
import '../ui/theme.dart';
import '../ui/watch.dart';

/// Vocabulary training: today's review, then every vocabulary section of the course, unit by unit.
class WordsScreen extends StatelessWidget {
  const WordsScreen({super.key});

  @override
  Widget build(BuildContext context) => CourseGate(builder: (context) {
        final c = context.c;
        final known = sync.state.learned.toSet();
        final due = dueWords().length;
        final upcoming = nextDue();
        final all = course.allWords;
        final knownCount = all.where((w) => known.contains(w.german)).length;
        return Scaffold(
          appBar: AppBar(title: Txt(T('Vocabulary'), role: TextRole.title)),
          body: PageList(children: [
            const StatChips(),
            AppCard(
              raised: true,
              accent: c.goldBright,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
                ListRowPlain(
                  leading: Badge2(icon: Icons.psychology_rounded, colour: c.xp, background: c.goldSoft, size: 52),
                  kicker: 'Smart review',
                  kickerColour: c.xp,
                  title: due > 0 ? '$due ${due == 1 ? 'word' : 'words'} due' : 'All caught up',
                  detail: due > 0
                      ? 'Up to $reviewSessionSize per session, the most overdue first.'
                      : upcoming != null
                          ? 'Next review ${describeDay(upcoming)}.'
                          : 'Learn some words and they will come back here for review.',
                ),
                if (due > 0) AppButton(label: 'Start review', kind: ButtonKind.gold, icon: Icons.play_arrow_rounded, onPressed: () => context.push('/session/cards?review=1')),
              ], Space.md)),
            ),
            Txt(T('{known} of {total} words', {'known': knownCount, 'total': all.length}), role: TextRole.caption, colour: c.muted),
            Bar(value: all.isEmpty ? 0 : knownCount / all.length, colour: c.goldBright),
            for (final unit in course.units) ...[
              SectionHeader(course.t(unit.title), kicker: course.unitName(unit), kickerColour: c.xp),
              for (final section in unit.sections) SectionCard(section: section, path: '/words/${section.key}'),
            ],
          ]),
        );
      });
}

/// A section in a list: its title and how many of its words are learned.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.section, required this.path, this.accent = false});
  final Section section;
  final String path;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final known = sync.state.learned.toSet();
    final done = section.words.where((w) => known.contains(w.german)).length;
    final complete = done == section.words.length;
    return AppCard(
      accent: accent ? c.goldBright : null,
      onTap: () => context.push(path),
      semanticLabel: '${course.t(section.title)}, $done of ${section.words.length} learned',
      child: ListRow(
        title: course.t(section.title),
        below: Bar(value: section.words.isEmpty ? 0 : done / section.words.length, colour: complete ? c.green : c.goldBright, height: 6),
        trailing: Txt(complete ? '✓' : '$done/${section.words.length}', role: TextRole.label, colour: complete ? c.green : c.muted),
      ),
    );
  }
}

/// A row without a chevron (ListRow has one).
class ListRowPlain extends StatelessWidget {
  const ListRowPlain({super.key, required this.leading, required this.kicker, required this.kickerColour, required this.title, required this.detail});
  final Widget leading;
  final String kicker;
  final Color kickerColour;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) => Row(children: [
        leading,
        const SizedBox(width: Space.md),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Txt(kicker, role: TextRole.overline, colour: kickerColour),
            Txt(title, role: TextRole.heading),
            Txt(detail, role: TextRole.caption, colour: context.c.muted),
          ]),
        ),
      ]);
}

/// The website's five ways to study a set of words.
class StudyModes extends StatelessWidget {
  const StudyModes({super.key, required this.scope});
  final String scope;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Widget mode(IconData icon, String name, String detail, String path) => Expanded(
          child: AppCard(
            padding: const EdgeInsets.all(Space.sm + 4),
            onTap: () => context.push(path),
            semanticLabel: '$name: $detail',
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, color: c.xp),
              const SizedBox(height: Space.xs),
              Txt(name, role: TextRole.label),
              Txt(detail, role: TextRole.caption, colour: c.muted, maxLines: 2),
            ]),
          ),
        );
    return Column(children: gapped([
      Row(children: [
        mode(Icons.menu_book_rounded, T('Learn'), 'Word by word', '/session/learn/$scope'),
        const SizedBox(width: Space.sm),
        mode(Icons.style_rounded, T('Flashcards'), 'Swipe what you know', '/session/cards?scope=$scope'),
      ]),
      Row(children: [
        mode(Icons.extension_rounded, T('Match'), '10 pairs', '/session/match/$scope'),
        const SizedBox(width: Space.sm),
        mode(Icons.keyboard_rounded, T('Practice'), 'Type the translation', '/session/practice/$scope'),
        const SizedBox(width: Space.sm),
        mode(Icons.mic_rounded, T('Speak'), 'Say it out loud', '/session/speak/$scope'),
      ]),
    ], Space.sm));
  }
}

/// One vocabulary section: the ways to study it, its grammar lessons, and every word with its picture and recording.
class SectionScreen extends StatefulWidget {
  const SectionScreen({super.key, required this.sectionKey, required this.lessonPath});
  final String sectionKey;

  /// Where its lessons open in this tab ("/lessons/" or "/lesson/").
  final String lessonPath;

  @override
  State<SectionScreen> createState() => _SectionScreenState();
}

class _SectionScreenState extends State<SectionScreen> {
  var _revealAll = false;

  @override
  Widget build(BuildContext context) => CourseGate(builder: (context) {
        final c = context.c;
        final found = course.section(widget.sectionKey);
        if (found == null) {
          return Scaffold(appBar: AppBar(), body: const Center(child: Txt('This section is no longer in the course.')));
        }
        final (:unit, :section) = found;
        final known = sync.state.learned.toSet();
        final done = section.words.where((w) => known.contains(w.german)).length;
        final left = section.words.length - done;
        // The website's grammar callout: the lessons that go with this chapter.
        final lessons = unit.grammar.where((g) => g.chapters.contains(section.key)).toList();
        return Scaffold(
          appBar: AppBar(title: Txt(course.t(section.title), role: TextRole.heading, maxLines: 1)),
          body: PageList(gap: Space.sm, children: [
            Txt('${course.unitName(unit)} · ${course.t(unit.title)}', role: TextRole.overline, colour: c.xp),
            Txt(T('{known} of {total} words', {'known': done, 'total': section.words.length}), role: TextRole.caption, colour: c.muted),
            Bar(value: section.words.isEmpty ? 0 : done / section.words.length, colour: c.goldBright),
            AppButton(
              label: left > 0 ? 'Learn $left new ${left == 1 ? 'word' : 'words'}' : 'Practise all words again',
              kind: ButtonKind.gold,
              icon: Icons.style_rounded,
              onPressed: () => context.push('/session/cards?scope=${section.key}'),
            ),
            StudyModes(scope: section.key),
            for (final g in lessons)
              AppCard(
                accent: c.brand,
                onTap: () => context.push('${widget.lessonPath}${g.key}'),
                child: ListRow(
                  leading: Badge2(icon: Icons.school_rounded, colour: c.brand, background: c.brandSoft),
                  kicker: T('{part} for this chapter', {'part': course.t(unit.lessonsLabel ?? 'Grammar')}),
                  title: course.t(g.title),
                  detail: T('Open lesson'),
                ),
              ),
            OfflineCard(unit: unit),
            Row(children: [
              Expanded(child: Txt(T('German'), role: TextRole.heading)),
              TextButton.icon(
                onPressed: () => setState(() {
                  _revealAll = !_revealAll;
                  if (_revealAll) {
                    for (final w in section.words) {
                      learnWord(w.german);
                    }
                  }
                }),
                icon: Icon(_revealAll ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                label: Text(_revealAll ? T('Hide all') : T('Reveal all')),
              ),
            ]),
            for (final word in section.words) WordRow(word: word, learned: known.contains(word.german), open: _revealAll),
            if (_nextSection(unit, section) case final next?)
              AppButton(
                label: '${T('Next chapter:')} ${course.t(next.title)}',
                kind: ButtonKind.secondary,
                icon: Icons.arrow_forward_rounded,
                onPressed: () => context.pushReplacement(GoRouterState.of(context).uri.path.replaceFirst(section.key, next.key)),
              ),
          ])
        );
      });

  Section? _nextSection(Unit unit, Section section) {
    final i = unit.sections.indexOf(section);
    return i >= 0 && i + 1 < unit.sections.length ? unit.sections[i + 1] : null;
  }
}

/// One unit, opened from the course map on Home: its vocabulary sections (gold), the whole unit's practice, and
/// its lessons (emerald). Everything opens inside Home, so the way back is always there.
class UnitScreen extends StatelessWidget {
  const UnitScreen({super.key, required this.id});
  final int id;

  @override
  Widget build(BuildContext context) => CourseGate(builder: (context) {
        final c = context.c;
        final unit = course.unit(id);
        if (unit == null) return Scaffold(appBar: AppBar(), body: const Center(child: Txt('This unit is no longer in the course.')));
        final p = unitProgress(unit);
        final lessonsDone = unit.grammar.where(lessonPassed).length;
        return Scaffold(
          appBar: AppBar(title: Txt(course.unitName(unit), role: TextRole.heading)),
          body: PageList(gap: Space.sm, children: [
            Txt(course.t(unit.title), role: TextRole.title),
            SectionHeader(T('Vocabulary'), detail: T('{known} of {total} words', {'known': p.done, 'total': p.total})),
            Bar(value: p.total == 0 ? 0 : p.done / p.total, colour: c.goldBright),
            for (final s in unit.sections) SectionCard(section: s, path: '/section/${s.key}', accent: true),
            Panel(title: T('All chapters'), children: [
              Txt('Practise every word of the unit at once.', role: TextRole.caption, colour: c.muted),
              StudyModes(scope: 'unit:${unit.id}'),
            ]),
            SectionHeader(course.t(unit.lessonsLabel ?? 'Grammar'), detail: '$lessonsDone/${unit.grammar.length}'),
            Bar(value: unit.grammar.isEmpty ? 0 : lessonsDone / unit.grammar.length),
            for (final g in unit.grammar) LessonCard(unit: unit, lesson: g, path: '/lesson/${g.key}', accent: true),
            ListeningCard(unit: unit),
          ])
        );
      });
}

/// A lesson in a list: its kind, title and best score.
class LessonCard extends StatelessWidget {
  const LessonCard({super.key, required this.unit, required this.lesson, required this.path, this.accent = false});
  final Unit unit;
  final Lesson lesson;
  final String path;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final best = sync.state.grammar[lesson.key];
    final complete = lessonPassed(lesson);
    final (icon, name) = lessonLook(lesson, unit);
    return AppCard(
      accent: accent ? c.brand : null,
      onTap: () => context.push(path),
      semanticLabel: '$name: ${course.t(lesson.title)}${complete ? ', completed' : best != null ? ', best score $best' : ''}',
      child: ListRow(
        leading: Badge2(icon: complete ? Icons.check_rounded : icon, colour: complete ? c.brandInk : c.brand, background: complete ? c.green : c.brandSoft),
        title: course.t(lesson.title),
        detail: '$name${best != null ? ' · best $best' : ''}',
      ),
    );
  }
}

/// What a lesson is, for its badge: grammar (or what the unit calls its lessons), reading, unit test or trainer.
(IconData, String) lessonLook(Lesson lesson, Unit unit) {
  if (lesson.custom == 'review') return (Icons.emoji_events_outlined, T('Unit test'));
  if (lesson.custom != null) return (Icons.fitness_center_rounded, 'Trainer');
  if (lesson.blocks.any((b) => b.reading.isNotEmpty)) return (Icons.auto_stories_outlined, 'Reading');
  return (Icons.extension_outlined, course.t(unit.lessonsLabel ?? 'Grammar'));
}

/// Listening practice for a unit.
class ListeningCard extends StatelessWidget {
  const ListeningCard({super.key, required this.unit});
  final Unit unit;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return AppCard(
      accent: c.brand,
      onTap: () => context.push('/session/listening/${unit.id}'),
      child: ListRow(
        leading: Badge2(icon: Icons.headphones_rounded, colour: c.brandInk, background: c.brand),
        title: 'Listening practice',
        detail: 'Hear it, pick what was said',
      ),
    );
  }
}
