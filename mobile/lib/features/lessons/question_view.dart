import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/i18n.dart';
import '../../core/offline/audio.dart';
import '../../ui/primitives.dart';
import '../../ui/rich_text.dart';
import '../../ui/theme.dart';
import 'answer_check.dart';
import 'questions.dart';

/// How the learner answered: right or not, what they gave, and a note (e.g. "Watch the umlauts").
class Result {
  const Result(this.right, this.given, [this.note]);
  final bool right;
  final String given;
  final String? note;
}

void _haptic(bool right) => right ? HapticFeedback.mediumImpact() : HapticFeedback.heavyImpact();

/// One question of any kind: listen if needed, answer, see at once whether it was right, then continue.
class QuestionView extends StatefulWidget {
  const QuestionView({super.key, required this.question, required this.onResult, required this.onNext, required this.last, this.above});

  final Question question;
  final ValueChanged<Result> onResult;
  final VoidCallback onNext;
  final bool last;

  /// Shown above the question: a reading text kept in view.
  final Widget? above;

  @override
  State<QuestionView> createState() => _QuestionViewState();
}

class _QuestionViewState extends State<QuestionView> {
  Result? _result;

  Question get q => widget.question;

  @override
  void initState() {
    super.initState();
    // Listening items: the learner hears it first (it plays once by itself) and can play it again.
    if (q.listen && q.say != null) audio.play(q.say!);
  }

  void _answered(Result r) {
    _haptic(r.right);
    setState(() => _result = r);
    widget.onResult(r);
    if (!q.listen && q.say != null) audio.play(q.say!);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final result = _result;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ListView(
            children: gapped([
              if (widget.above != null) widget.above!,
              if (q.prompt.isNotEmpty) RichTxt(q.prompt, role: TextRole.heading),
              if (q.listen && q.say != null)
                Center(
                  child: Semantics(
                    button: true,
                    label: T('Play again'),
                    child: GestureDetector(
                      onTap: () => audio.play(q.say!),
                      child: SizedBox(
                        width: 112,
                        height: 112,
                        child: ChunkyBox(
                          face: c.brand,
                          base: c.brandDeep,
                          depth: 5,
                          radius: Radii.xl,
                          child: Center(child: Icon(Icons.volume_up_rounded, size: 44, color: c.brandInk)),
                        ),
                      ),
                    ),
                  ),
                ),
              if (q.before != null)
                Text.rich(
                  TextSpan(
                    children: [
                      // The blank sits exactly where the item puts it (right after the stem for verb endings).
                      TextSpan(text: q.before),
                      TextSpan(
                        text: result == null ? '___' : q.show(q.answer).replaceFirst(RegExp('^-'), ''),
                        style: TextStyle(color: result == null ? c.brand : (result.right ? c.green : c.red), fontWeight: FontWeight.w700),
                      ),
                      TextSpan(text: q.after),
                    ],
                  ),
                  style: textStyle(TextRole.title).copyWith(color: c.text),
                ),
              if (q.hint != null && q.hint!.isNotEmpty) RichTxt(q.hint!, role: TextRole.caption, colour: c.muted),
              switch (q.type) {
                QuestionType.choice => _Choices(question: q, result: result, onResult: _answered),
                QuestionType.order => _Order(question: q, result: result, onResult: _answered),
                QuestionType.write => _Write(question: q, result: result, onResult: _answered),
              },
            ], Space.md),
          ),
        ),
        if (result != null) _Feedback(question: q, result: result, last: widget.last, onNext: widget.onNext),
      ],
    );
  }
}

class _Feedback extends StatelessWidget {
  const _Feedback({required this.question, required this.result, required this.last, required this.onNext});
  final Question question;
  final Result result;
  final bool last;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final colour = result.right ? c.green : c.red;
    final note = result.note ?? (result.right ? question.why : (question.whyIfWrong ?? question.why));
    final shown = question.shown ?? (question.type == QuestionType.choice ? question.show(question.answer) : question.answer);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 1, end: 0),
      duration: Motion.slow,
      curve: Curves.easeOutBack,
      builder: (context, v, child) => Transform.translate(offset: Offset(0, 80 * v), child: child),
      child: Semantics(
        liveRegion: true,
        child: Container(
          margin: const EdgeInsets.only(top: Space.md),
          padding: const EdgeInsets.all(Space.md),
          decoration: BoxDecoration(
            color: result.right ? c.greenSoft : c.redSoft,
            borderRadius: BorderRadius.circular(Radii.lg),
            border: Border.all(color: colour, width: 1.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: gapped([
              Row(
                children: [
                  Icon(result.right ? Icons.verified_rounded : Icons.info_rounded, color: colour),
                  const SizedBox(width: Space.sm),
                  Txt(result.right ? T('Correct') : T('Not quite'), role: TextRole.heading, colour: colour),
                ],
              ),
              if (!result.right || question.type != QuestionType.choice || question.say != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (question.answerLabel != null) Txt(question.answerLabel!, role: TextRole.overline, colour: c.muted),
                    Txt(shown, role: TextRole.bodyStrong),
                  ],
                ),
              if (note != null && note.isNotEmpty) RichTxt(note),
              AppButton(
                label: last ? T('See results') : T('Next question'),
                kind: result.right ? ButtonKind.primary : ButtonKind.danger,
                onPressed: onNext,
              ),
            ], Space.sm),
          ),
        ),
      ),
    );
  }
}

class _Choices extends StatelessWidget {
  const _Choices({required this.question, required this.result, required this.onResult});
  final Question question;
  final Result? result;
  final ValueChanged<Result> onResult;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: gapped([
        for (final option in question.options)
          _Option(
            label: question.show(option),
            state: result == null
                ? 0
                : option == question.answer
                ? 1
                : option == result!.given
                ? 2
                : 0,
            onTap: result != null ? null : () => onResult(Result(option == question.answer, option)),
          ),
      ], Space.sm),
    );
  }
}

/// One choice: idle, right (green) or wrong (red, with a shake).
class _Option extends StatelessWidget {
  const _Option({required this.label, required this.state, required this.onTap});
  final String label;
  final int state;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final (bg, edge) = switch (state) {
      1 => (c.greenSoft, c.green),
      2 => (c.redSoft, c.red),
      _ => (c.surface, c.borderStrong),
    };
    return TweenAnimationBuilder<double>(
      key: ValueKey(state),
      tween: Tween(begin: state == 2 ? 1 : 0, end: 0),
      duration: const Duration(milliseconds: 260),
      builder: (context, v, child) => Transform.translate(offset: Offset(8 * v * (v * 10 % 2 < 1 ? 1 : -1), 0), child: child),
      child: Semantics(
        inMutuallyExclusiveGroup: true,
        checked: state != 0,
        label: state == 0 ? label : '$label, ${state == 1 ? 'correct' : 'wrong'}',
        excludeSemantics: true,
        child: ChunkyBox(
          face: bg,
          base: edge,
          edge: state == 0 ? c.border : edge,
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              onTap: onTap,
              child: Container(
                constraints: const BoxConstraints(minHeight: 56),
                padding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: Space.sm),
                child: Row(
                  children: [
                    Expanded(child: Txt(label, role: TextRole.bodyStrong)),
                    if (state == 1) Icon(Icons.check_circle_rounded, color: c.green),
                    if (state == 2) Icon(Icons.cancel_rounded, color: c.red),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.text, required this.onTap, required this.lines});
  final String text;
  final VoidCallback? onTap;
  final bool lines;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return SizedBox(
      width: lines ? double.infinity : null,
      child: ChunkyBox(
        face: c.surface,
        base: c.borderStrong,
        edge: c.border,
        radius: Radii.md,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: onTap == null
                ? null
                : () {
                    HapticFeedback.selectionClick();
                    onTap!();
                  },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: 10),
              child: Txt(text, role: TextRole.bodyStrong),
            ),
          ),
        ),
      ),
    );
  }
}

/// Word tiles (or dialogue lines) tapped into order; tapping a placed tile sends it back.
class _Order extends StatefulWidget {
  const _Order({required this.question, required this.result, required this.onResult});
  final Question question;
  final Result? result;
  final ValueChanged<Result> onResult;

  @override
  State<_Order> createState() => _OrderState();
}

class _OrderState extends State<_Order> {
  // Each tile keeps its place by index, so repeated words stay separate tiles.
  late final List<int> _bank = () {
    var order = shuffle(List.generate(widget.question.tiles.length, (i) => i));
    // Shuffled, but never already in the right order (as on the website).
    for (var n = 0; n < 5 && order.indexed.every((e) => e.$1 == e.$2) && order.length > 1; n++) {
      order = shuffle(order);
    }
    return order;
  }();
  final _placed = <int>[];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final q = widget.question;
    final result = widget.result;
    final left = _bank.where((i) => !_placed.contains(i)).toList();
    final given = [for (final i in _placed) q.tiles[i]];
    Widget layout(List<Widget> tiles) => q.lines
        ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped(tiles, Space.sm))
        : Wrap(spacing: Space.sm, runSpacing: Space.sm, children: tiles);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: gapped([
        Semantics(
          label: '${T('Your answer')}: ${given.isEmpty ? 'empty' : given.join(' ')}',
          child: Container(
            constraints: const BoxConstraints(minHeight: 64),
            padding: const EdgeInsets.all(Space.sm),
            decoration: BoxDecoration(
              color: result == null ? c.surface2 : (result.right ? c.greenSoft : c.redSoft),
              borderRadius: BorderRadius.circular(Radii.lg),
              border: Border.all(color: result == null ? c.border : (result.right ? c.green : c.red), width: 1.5),
            ),
            alignment: Alignment.centerLeft,
            child: _placed.isEmpty
                ? Txt(
                    q.lines ? T('Tap the lines below in the right order.') : T('Tap the words below in the right order.'),
                    colour: c.subtle,
                  )
                : layout([
                    for (final i in _placed)
                      _Tile(text: q.tiles[i], lines: q.lines, onTap: result != null ? null : () => setState(() => _placed.remove(i))),
                  ]),
          ),
        ),
        if (left.isNotEmpty)
          layout([
            for (final i in left)
              _Tile(text: q.tiles[i], lines: q.lines, onTap: result != null ? null : () => setState(() => _placed.add(i))),
          ]),
        if (result == null)
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: T('Start again'),
                  kind: ButtonKind.secondary,
                  onPressed: _placed.isEmpty ? null : () => setState(_placed.clear),
                ),
              ),
              const SizedBox(width: Space.sm),
              Expanded(
                child: AppButton(
                  label: T('Check'),
                  onPressed: left.isNotEmpty
                      ? null
                      : () => widget.onResult(Result(checkOrder(given, q.answer, q.alts, q.tiles, q.lines), given.join(' '))),
                ),
              ),
            ],
          ),
      ], Space.md),
    );
  }
}

/// A typed answer, with ä ö ü ß keys for German, checked like on the website.
class _Write extends StatefulWidget {
  const _Write({required this.question, required this.result, required this.onResult});
  final Question question;
  final Result? result;
  final ValueChanged<Result> onResult;

  @override
  State<_Write> createState() => _WriteState();
}

class _WriteState extends State<_Write> {
  final _input = TextEditingController();
  final _focus = FocusNode();

  @override
  void dispose() {
    _input.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _submit() {
    if (_input.text.trim().isEmpty || widget.result != null) return;
    final q = widget.question;
    final verdict = checkTyped(_input.text, [q.answer, ...q.alts], q.toGerman, T);
    widget.onResult(Result(verdict.verdict != Verdict.wrong, _input.text, verdict.note.isEmpty ? null : verdict.note));
  }

  @override
  Widget build(BuildContext context) {
    final q = widget.question;
    final result = widget.result;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: gapped([
        if (q.text != null) Txt(q.text!, role: TextRole.heading),
        AnswerField(controller: _input, focus: _focus, enabled: result == null, state: result?.right, onSubmitted: _submit),
        if (q.toGerman && result == null) GermanKeys(controller: _input, focus: _focus),
        if (result == null)
          ListenableBuilder(
            listenable: _input,
            builder: (context, _) => AppButton(label: T('Check'), onPressed: _input.text.trim().isEmpty ? null : _submit),
          ),
      ], Space.sm),
    );
  }
}

/// The typed-answer field shared by lessons and Practice.
class AnswerField extends StatelessWidget {
  const AnswerField({
    super.key,
    required this.controller,
    required this.focus,
    required this.enabled,
    required this.state,
    required this.onSubmitted,
    this.hint,
  });

  final TextEditingController controller;
  final FocusNode focus;
  final bool enabled;

  /// null before checking, then right or wrong.
  final bool? state;
  final VoidCallback onSubmitted;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final edge = state == null ? c.borderStrong : (state! ? c.green : c.red);
    OutlineInputBorder border(Color colour) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(Radii.lg),
      borderSide: BorderSide(color: colour, width: 2),
    );
    return TextField(
      controller: controller,
      focusNode: focus,
      enabled: enabled,
      autofocus: true,
      autocorrect: false,
      enableSuggestions: false,
      textCapitalization: TextCapitalization.none,
      textInputAction: TextInputAction.done,
      onSubmitted: (_) => onSubmitted(),
      style: textStyle(TextRole.bodyStrong).copyWith(color: c.text),
      decoration: InputDecoration(
        hintText: hint ?? T('Type your answer…'),
        hintStyle: TextStyle(color: c.subtle),
        filled: true,
        fillColor: c.surface,
        enabledBorder: border(edge),
        disabledBorder: border(edge),
        focusedBorder: border(state == null ? c.brand : edge),
        contentPadding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: 16),
        semanticCounterText: T('Your answer'),
      ),
    );
  }
}

/// The ä ö ü ß buttons under a German answer field: each inserts its letter at the cursor.
class GermanKeys extends StatelessWidget {
  const GermanKeys({super.key, required this.controller, required this.focus});
  final TextEditingController controller;
  final FocusNode focus;

  void _insert(String letter) {
    final sel = controller.selection;
    final text = controller.text;
    final start = sel.isValid ? sel.start : text.length;
    final end = sel.isValid ? sel.end : text.length;
    controller.value = TextEditingValue(
      text: text.replaceRange(start, end, letter),
      selection: TextSelection.collapsed(offset: start + letter.length),
    );
    focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: T('German letters'),
    child: Row(
      children: [
        for (final letter in ['ä', 'ö', 'ü', 'ß']) ...[
          Material(
            color: context.c.surface2,
            borderRadius: BorderRadius.circular(Radii.md),
            child: InkWell(
              borderRadius: BorderRadius.circular(Radii.md),
              onTap: () => _insert(letter),
              child: Semantics(
                label: T('Insert {letter}', {'letter': letter}),
                excludeSemantics: true,
                child: SizedBox(
                  width: 52,
                  height: 48,
                  child: Center(child: Txt(letter, role: TextRole.bodyStrong)),
                ),
              ),
            ),
          ),
          const SizedBox(width: Space.sm),
        ],
      ],
    ),
  );
}
