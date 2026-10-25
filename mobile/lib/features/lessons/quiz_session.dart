import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/offline/audio.dart';
import '../../core/sync/engine.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../gamification/celebration.dart';
import '../gamification/game.dart';
import '../progress/progress.dart';
import 'lesson_content.dart';
import 'question_view.dart';
import 'questions.dart';

/// What a quiz session is for.
sealed class QuizKind {
  const QuizKind();
}

/// A lesson's exercise. A course lesson saves its place after every question (so it can be continued on any
/// device) and earns XP like the website; the unit test and the verb-ending and countries lessons record their
/// score only, as on the website.
class LessonQuiz extends QuizKind {
  const LessonQuiz(this.unit, this.lesson, {this.resume = false});
  final Unit unit;
  final Lesson lesson;
  final bool resume;
}

/// Listening practice for a unit: XP for each right answer, no score.
class ListeningQuiz extends QuizKind {
  const ListeningQuiz(this.unit);
  final Unit unit;
}

class QuizSession extends StatefulWidget {
  const QuizSession({super.key, required this.kind});
  final QuizKind kind;

  @override
  State<QuizSession> createState() => _QuizSessionState();
}

class _QuizSessionState extends State<QuizSession> {
  late List<Question> _questions;
  List<int> _items = const [];
  final _answers = <bool>[];
  Result? _result;
  var _xp = 0;
  var _finished = false;
  late final int _levelBefore = Game.current.level.level;

  Lesson? get _lesson => switch (widget.kind) { LessonQuiz(:final lesson) => lesson, _ => null };

  /// A course lesson (quiz items from the course data): synced position and XP.
  bool get _data => _lesson != null && _lesson!.custom == null;

  @override
  void initState() {
    super.initState();
    _start();
  }

  void _start() {
    _answers.clear();
    _result = null;
    _xp = 0;
    _finished = false;
    switch (widget.kind) {
      case LessonQuiz(:final unit, :final lesson, :final resume):
        if (lesson.custom == 'review') {
          _questions = reviewQuestions(unit);
        } else if (lesson.custom != null) {
          _questions = customQuestions(lesson.custom!);
        } else {
          // Lesson exercises are drawn as item numbers, so another device can rebuild the same questions.
          final saved = resume ? sync.openSession : null;
          final continuing = saved != null && saved['kind'] == 'quiz' && saved['ref'] == lesson.key ? saved : null;
          final built = lessonQuestions(lesson, unit, continuing == null ? null : [for (final i in continuing['items'] as List) (i as num).toInt()]);
          _items = built.items;
          _questions = built.questions;
          if (continuing != null) {
            final position = (continuing['position'] as num).toInt();
            _answers.addAll([for (final a in (continuing['answers'] as List).take(position)) a == true].take(_questions.length));
          }
          _save(false);
        }
      case ListeningQuiz(:final unit):
        _questions = listeningQuestions(unit);
    }
  }

  void _save(bool done) {
    if (!_data) return;
    sync.record({
      'kind': 'session',
      'session': done
          ? null
          : {'kind': 'quiz', 'ref': _lesson!.key, 'items': _items, 'answers': [..._answers], 'position': _answers.length, ...sync.sessionDefaults},
    });
  }

  int get _right => _answers.where((a) => a).length;

  void _answer(Result r) {
    setState(() {
      _result = r;
      _answers.add(r.right);
    });
    final points = switch (widget.kind) { ListeningQuiz() => XP.reviewRight, _ => _data ? XP.answerRight : 0 };
    if (r.right && points > 0) {
      awardXp(points);
      _xp += points;
    }
  }

  void _next() {
    if (_answers.length < _questions.length) {
      setState(() => _result = null);
      _save(false);
      return;
    }
    final lesson = _lesson;
    if (lesson != null) {
      recordScore(lesson.key, _right);
      if (_data) {
        final bonus = (_right >= passOf(lesson) ? XP.lessonPassed : 0) + (_right == _questions.length ? XP.perfect : 0);
        awardXp(bonus);
        _xp += bonus;
        _save(true);
      }
    }
    audio.stop();
    setState(() => _finished = true);
  }

  String get _title => switch (widget.kind) {
        LessonQuiz(:final lesson) => course.t(lesson.title),
        ListeningQuiz(:final unit) => 'listening for ${course.t(unit.title)}',
      };

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final lesson = _lesson;
    if (_finished || _questions.isEmpty || _answers.length >= _questions.length && _result == null) {
      final pass = lesson == null ? (_questions.length / 2).ceil() : passOf(lesson);
      final passed = _questions.isNotEmpty && _right >= pass;
      return Celebration(
        title: _questions.isEmpty
            ? 'Nothing here yet'
            : passed
                ? (_right == _questions.length ? 'Perfekt!' : 'Geschafft!')
                : 'Weiter üben!',
        message: _questions.isEmpty
            ? 'This exercise needs recordings. Connect to the internet or save the unit.'
            : lesson != null
                ? (passed ? T('You have got this.') : T('Score {n} or more to complete it.', {'n': pass}))
                : 'You practised $_title.',
        xpGained: _xp,
        levelBefore: _levelBefore,
        success: passed,
        stats: [
          Stat(Icons.check_circle_outline_rounded, T('this round'), '$_right/${_questions.length}'),
          if (lesson != null)
            Stat(Icons.star_outline_rounded, T('best score'), '${[_right, sync.state.grammar[lesson.key] ?? 0].reduce((a, b) => a > b ? a : b)}/${_questions.length}')
          else
            Stat(Icons.flag_outlined, 'to pass', '$pass'),
        ],
        extra: [
          if (_questions.isNotEmpty)
            AppButton(label: T('Try again'), kind: ButtonKind.secondary, icon: Icons.replay_rounded, onPressed: () => setState(_start)),
        ],
        onContinue: () => context.pop(),
      );
    }

    final position = _answers.length - (_result == null ? 0 : 1);
    final reading = lesson?.blocks.where((b) => b.reading.isNotEmpty).firstOrNull;
    return PopScope(
      onPopInvokedWithResult: (_, _) => audio.stop(),
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(Space.md),
            child: Column(children: [
              SessionHeader(done: _answers.length, total: _questions.length),
              const SizedBox(height: Space.lg),
              Expanded(
                child: QuestionView(
                  key: ValueKey(position),
                  question: _questions[position],
                  onResult: _answer,
                  onNext: _next,
                  last: _answers.length == _questions.length,
                  // Reading exercises keep the text in view.
                  above: reading == null
                      ? null
                      : Theme(
                          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                          child: Container(
                            decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: c.border)),
                            child: ExpansionTile(
                              title: Txt(T('The text: {title}', {'title': course.t(reading.title ?? '')}), role: TextRole.label),
                              childrenPadding: const EdgeInsets.fromLTRB(Space.md, 0, Space.md, Space.md),
                              children: [ReadingText(block: reading)],
                            ),
                          ),
                        ),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// The top of every practice session: a way out, how far along it is, and the count.
class SessionHeader extends StatelessWidget {
  const SessionHeader({super.key, required this.done, required this.total, this.colour, this.trailing});
  final int done;
  final int total;
  final Color? colour;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(children: [
        RoundIconButton(icon: Icons.close_rounded, label: 'End session', colour: context.c.muted, onPressed: () => context.pop()),
        const SizedBox(width: Space.md),
        Expanded(child: Bar(value: total == 0 ? 0 : done / total, colour: colour, height: 12)),
        const SizedBox(width: Space.md),
        Semantics(label: '$done of $total done', excludeSemantics: true, child: Txt('$done/$total', role: TextRole.label, colour: context.c.muted)),
        if (trailing != null) ...[const SizedBox(width: Space.sm), trailing!],
      ]);
}
