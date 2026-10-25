import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/offline/audio.dart';
import '../../core/settings.dart';
import '../../core/sync/engine.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../gamification/celebration.dart';
import '../gamification/game.dart';
import '../lessons/answer_check.dart';
import '../lessons/lesson_content.dart';
import '../lessons/question_view.dart' show AnswerField, GermanKeys;
import '../lessons/questions.dart' show shuffle;
import '../lessons/quiz_session.dart';
import '../progress/progress.dart';
import 'word_picture.dart';

/// Words for a study mode: a section, or a whole unit (`unit:<id>`, the website's "All chapters").
class WordScope {
  const WordScope(this.key, this.title, this.words);
  final String key;
  final String title;
  final List<Word> words;

  static WordScope? find(String key) {
    if (key.startsWith('unit:')) {
      final unit = course.unit(int.tryParse(key.substring(5)) ?? -1);
      return unit == null ? null : WordScope(key, T('All chapters'), unit.words);
    }
    final found = course.section(key);
    return found == null ? null : WordScope(key, course.t(found.section.title), found.section.words);
  }
}

/* ---------------- Match ---------------- */

const _matchSize = 10;

/// Matching: 10 random pairs; tap a tile, then its partner. Every pair matched counts the word as learned.
class MatchGame extends StatefulWidget {
  const MatchGame({super.key, required this.scope});
  final WordScope scope;

  @override
  State<MatchGame> createState() => _MatchGameState();
}

class _MatchGameState extends State<MatchGame> {
  late List<Word> _pairs;
  late List<int> _german;
  late List<int> _meanings;
  final _matched = <int>{};
  var _mistakes = 0;
  (bool, int)? _selected;
  (bool, int)? _wrong;
  late final int _levelBefore = Game.current.level.level;
  var _xpBefore = 0;

  @override
  void initState() {
    super.initState();
    _start();
  }

  void _start() {
    // Skip repeated words or meanings so each tile has exactly one correct partner.
    final seenGerman = <String>{};
    final seenMeaning = <String>{};
    _pairs = [];
    for (final w in shuffle(widget.scope.words)) {
      if (!seenGerman.add(w.german) || !seenMeaning.add(course.meaning(w).toLowerCase())) continue;
      _pairs.add(w);
      if (_pairs.length == _matchSize) break;
    }
    _german = shuffle(List.generate(_pairs.length, (i) => i));
    _meanings = shuffle(List.generate(_pairs.length, (i) => i));
    _matched.clear();
    _mistakes = 0;
    _selected = null;
    _xpBefore = Game.current.totalXp;
  }

  void _tap(bool german, int pair) {
    if (_matched.contains(pair)) return;
    HapticFeedback.selectionClick();
    final selected = _selected;
    if (selected == null || selected.$1 == german) {
      setState(() => _selected = selected == (german, pair) ? null : (german, pair));
      return;
    }
    if (selected.$2 == pair) {
      HapticFeedback.mediumImpact();
      audio.play(_pairs[pair].german);
      setState(() {
        _matched.add(pair);
        _selected = null;
      });
      if (_matched.length == _pairs.length) {
        for (final w in _pairs) {
          learnWord(w.german);
        }
      }
    } else {
      HapticFeedback.heavyImpact();
      setState(() {
        _mistakes++;
        _selected = null;
        _wrong = (german, pair);
      });
      Future.delayed(const Duration(milliseconds: 600), () => mounted ? setState(() => _wrong = null) : null);
    }
  }

  Widget _tile(bool german, int pair) {
    final c = context.c;
    final matched = _matched.contains(pair);
    final selected = _selected == (german, pair);
    final wrong = _wrong == (german, pair);
    final text = german ? _pairs[pair].german : course.meaning(_pairs[pair]);
    return AnimatedOpacity(
      duration: Motion.base,
      opacity: matched ? 0.45 : 1,
      child: Material(
        color: matched ? c.greenSoft : wrong ? c.redSoft : selected ? c.brandSoft : c.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.md),
          side: BorderSide(color: matched ? c.green : wrong ? c.red : selected ? c.brand : c.border, width: 1.5),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.md),
          onTap: matched ? null : () => _tap(german, pair),
          child: Container(
            constraints: const BoxConstraints(minHeight: 52),
            padding: const EdgeInsets.symmetric(horizontal: Space.sm, vertical: Space.sm),
            alignment: Alignment.center,
            child: Txt(text, role: TextRole.label, align: TextAlign.center),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (_pairs.isNotEmpty && _matched.length == _pairs.length) {
      final accuracy = (_pairs.length / (_pairs.length + _mistakes) * 100).round();
      return Celebration(
        title: _mistakes == 0 ? T('Perfect match!') : (accuracy >= 75 ? T('Well done!') : T('Keep practising')),
        message: T('You matched all {n} pairs.', {'n': _pairs.length}),
        xpGained: Game.current.totalXp - _xpBefore,
        levelBefore: _levelBefore,
        success: accuracy >= 75,
        stats: [Stat(Icons.close_rounded, T('mistakes'), '$_mistakes'), Stat(Icons.percent_rounded, T('accuracy'), '$accuracy%')],
        extra: [AppButton(label: T('Play again with new words'), kind: ButtonKind.secondary, icon: Icons.replay_rounded, onPressed: () => setState(_start))],
        onContinue: () => context.pop(),
      );
    }
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Space.md),
          child: Column(children: [
            SessionHeader(done: _matched.length, total: _pairs.length),
            const SizedBox(height: Space.sm),
            Txt(_mistakes == 1 ? T('1 mistake') : T('{n} mistakes', {'n': _mistakes}), role: TextRole.caption, colour: c.muted),
            const SizedBox(height: Space.md),
            Expanded(
              child: SingleChildScrollView(
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(children: gapped([Txt(T('German'), role: TextRole.overline, colour: c.muted), for (final i in _german) _tile(true, i)], Space.sm)),
                  ),
                  const SizedBox(width: Space.sm),
                  Expanded(
                    child: Column(children: gapped([Txt(T('English'), role: TextRole.overline, colour: c.muted), for (final i in _meanings) _tile(false, i)], Space.sm)),
                  ),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/* ---------------- Practice ---------------- */

const _practiceSize = 10;

/// Practice: type a translation of 10 words, either way round, checked by the website's forgiving spelling check.
/// A right answer counts the word as learned; the rest can be practised again.
class PracticeSession extends StatefulWidget {
  const PracticeSession({super.key, required this.scope});
  final WordScope scope;

  @override
  State<PracticeSession> createState() => _PracticeSessionState();
}

class _PracticeSessionState extends State<PracticeSession> {
  late List<Word> _queue;
  var _index = 0;
  final _results = <(Word, Verdict)>[];
  Checked? _checked;
  final _input = TextEditingController();
  final _focus = FocusNode();
  late final int _levelBefore = Game.current.level.level;
  var _xpBefore = 0;

  bool get _toGerman => settings.practiceDirection == 'en-de';

  @override
  void initState() {
    super.initState();
    _start(shuffle(widget.scope.words).take(_practiceSize).toList());
  }

  @override
  void dispose() {
    _input.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _start(List<Word> words) {
    _queue = words;
    _index = 0;
    _results.clear();
    _checked = null;
    _input.clear();
    _xpBefore = Game.current.totalXp;
  }

  void _check({bool skip = false}) {
    if (_checked != null) return;
    final word = _queue[_index];
    final expected = _toGerman ? word.german : course.meaning(word);
    var result = skip ? const Checked(Verdict.wrong) : localCheck(_input.text.trim(), expected, _toGerman, T);
    if (skip) result = Checked(Verdict.wrong, T('No problem. This one will come up again.'));
    if (_toGerman) audio.play(word.german);
    if (result.verdict == Verdict.correct) learnWord(word.german);
    result.verdict == Verdict.wrong ? HapticFeedback.heavyImpact() : HapticFeedback.mediumImpact();
    setState(() {
      _checked = result;
      _results.add((word, result.verdict));
    });
  }

  void _next() {
    setState(() {
      _index++;
      _checked = null;
      _input.clear();
    });
    _focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (_index >= _queue.length) {
      int count(Verdict v) => _results.where((r) => r.$2 == v).length;
      final again = [for (final r in _results) if (r.$2 != Verdict.correct) r.$1];
      return Celebration(
        title: T('Practice complete'),
        message: _results.length == 1 ? T('You answered 1 question.') : T('You answered {n} questions.', {'n': _results.length}),
        xpGained: Game.current.totalXp - _xpBefore,
        levelBefore: _levelBefore,
        success: count(Verdict.correct) >= _results.length / 2,
        stats: [
          Stat(Icons.check_rounded, T('correct'), '${count(Verdict.correct)}'),
          Stat(Icons.remove_rounded, T('almost'), '${count(Verdict.almost)}'),
          Stat(Icons.close_rounded, T('to learn'), '${count(Verdict.wrong)}'),
        ],
        extra: [
          if (again.isNotEmpty)
            AppButton(label: T('Practise {n} again', {'n': again.length}), kind: ButtonKind.secondary, onPressed: () => setState(() => _start(shuffle(again)))),
          AppButton(label: T('Next 10 words'), kind: ButtonKind.secondary, onPressed: () => setState(() => _start(shuffle(widget.scope.words).take(_practiceSize).toList()))),
        ],
        onContinue: () => context.pop(),
      );
    }
    final word = _queue[_index];
    final checked = _checked;
    final expected = _toGerman ? word.german : course.meaning(word);
    final (label, colour, bg) = switch (checked?.verdict) {
      Verdict.correct => (T('Correct'), c.green, c.greenSoft),
      Verdict.almost => (T('Almost there'), c.gold, c.goldSoft),
      _ => (_input.text.trim().isEmpty ? T('Here is the answer') : T('Not quite'), c.red, c.redSoft),
    };
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Space.md),
          child: Column(children: [
            SessionHeader(done: _index, total: _queue.length),
            const SizedBox(height: Space.lg),
            Expanded(
              child: ListView(children: gapped([
                Txt(_toGerman ? T('Translate from English') : T('Translate from German'), role: TextRole.overline, colour: c.muted),
                Row(children: [
                  Expanded(child: Txt(_toGerman ? course.meaning(word) : word.german, role: TextRole.title)),
                  if (!_toGerman) ListenButton(word.german, size: 44),
                ]),
                AnswerField(
                  controller: _input,
                  focus: _focus,
                  enabled: checked == null,
                  state: checked == null ? null : checked.verdict != Verdict.wrong,
                  onSubmitted: checked == null ? _check : _next,
                  hint: _toGerman ? T('Your German translation') : T('Your English translation'),
                ),
                if (_toGerman && checked == null) GermanKeys(controller: _input, focus: _focus),
                if (checked != null)
                  Container(
                    padding: const EdgeInsets.all(Space.md),
                    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: colour, width: 1.5)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: gapped([
                      Txt(label, role: TextRole.heading, colour: colour),
                      Txt(T('Correct answer'), role: TextRole.overline, colour: c.muted),
                      Txt(expected, role: TextRole.bodyStrong),
                      if (checked.note.isNotEmpty) Txt(checked.note),
                    ], Space.xs)),
                  ),
              ], Space.md)),
            ),
            if (checked == null)
              Row(children: [
                Expanded(child: AppButton(label: T("I don't know"), kind: ButtonKind.ghost, onPressed: () => _check(skip: true))),
                const SizedBox(width: Space.sm),
                Expanded(child: AppButton(label: T('Check answer'), onPressed: _check)),
              ])
            else
              AppButton(label: _index + 1 < _queue.length ? T('Next question') : T('See results'), onPressed: _next),
          ]),
        ),
      ),
    );
  }
}

/* ---------------- Learn: one word at a time ---------------- */

/// The website's Learn mode, word by word: the word, its picture and recording, then its meaning on request (which
/// counts it as learned). From any word, "Say it with Selam" starts speaking practice there.
class WordPages extends StatefulWidget {
  const WordPages({super.key, required this.scope});
  final WordScope scope;

  @override
  State<WordPages> createState() => _WordPagesState();
}

class _WordPagesState extends State<WordPages> {
  var _index = 0;
  var _shown = false;

  void _move(int step) {
    final next = _index + step;
    if (next < 0 || next > widget.scope.words.length) return;
    setState(() {
      _index = next;
      _shown = false;
    });
    if (next < widget.scope.words.length) audio.play(widget.scope.words[next].german);
  }

  void _changed() => setState(() {});

  @override
  void initState() {
    super.initState();
    // Redraws when progress changes (the "Learned" mark).
    sync.addListener(_changed);
    if (widget.scope.words.isNotEmpty) audio.play(widget.scope.words.first.german);
  }

  @override
  void dispose() {
    sync.removeListener(_changed);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final words = widget.scope.words;
    if (_index >= words.length) {
      return Scaffold(
        appBar: AppBar(),
        body: PageList(children: [
          Txt(T('Chapter read'), role: TextRole.title),
          Txt(T('You went through all {n} words in this chapter.', {'n': words.length}), colour: c.muted),
          AppButton(label: T('Practise these words'), onPressed: () => context.pushReplacement('/session/practice/${widget.scope.key}')),
          AppButton(label: T('Start over'), kind: ButtonKind.ghost, onPressed: () => setState(() => _index = 0)),
        ]),
      );
    }
    final word = words[_index];
    return Scaffold(
        appBar: AppBar(title: Txt(widget.scope.title, role: TextRole.subheading)),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(Space.md),
            child: Column(children: [
              Row(children: [
                Txt(T('Word {n} of {total}', {'n': _index + 1, 'total': words.length}), role: TextRole.caption, colour: c.muted),
                const SizedBox(width: Space.md),
                Expanded(child: Bar(value: (_index + 1) / words.length, height: 6)),
              ]),
              const SizedBox(height: Space.md),
              Expanded(
                child: AppCard(
                  raised: true,
                  child: Center(
                    child: SingleChildScrollView(
                      child: Column(mainAxisSize: MainAxisSize.min, children: gapped([
                        if (sync.state.learned.contains(word.german))
                          Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.check_circle_rounded, size: 18, color: c.green),
                            const SizedBox(width: Space.xs),
                            Txt(T('Learned'), role: TextRole.label, colour: c.green),
                          ]),
                        WordPicture(codes: word.pic, size: 84),
                        Txt(word.german, role: TextRole.german, align: TextAlign.center),
                        ListenButton(word.german, size: 56),
                        if (_shown)
                          Txt(course.meaning(word), role: TextRole.title, colour: c.brand, align: TextAlign.center)
                        else
                          AppButton(
                            label: T('Show meaning'),
                            kind: ButtonKind.secondary,
                            icon: Icons.visibility_outlined,
                            expand: false,
                            onPressed: () {
                              setState(() => _shown = true);
                              learnWord(word.german);
                            },
                          ),
                        AppButton(
                          label: T('Say it with {name}', {'name': coachName()}),
                          kind: ButtonKind.ghost,
                          icon: Icons.mic_none_rounded,
                          onPressed: () => context.push('/session/speak/${widget.scope.key}?from=$_index'),
                        ),
                      ], Space.md)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: Space.md),
              Row(children: [
                Expanded(child: AppButton(label: '← ${T('Previous')}', kind: ButtonKind.secondary, onPressed: _index == 0 ? null : () => _move(-1))),
                const SizedBox(width: Space.sm),
                Expanded(child: AppButton(label: _index + 1 < words.length ? '${T('Next word')} →' : '${T('Finish chapter')} →', onPressed: () => _move(1))),
              ]),
            ]),
          ),
        ),
      );
  }
}

/// The coach matches the chosen voice: Selam (Katja) or Dawit (Conrad).
String coachName() => settings.voice == Voice.katja ? T('Selam') : T('Dawit');
