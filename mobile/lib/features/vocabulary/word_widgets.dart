import 'package:flutter/material.dart';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/offline/audio.dart';
import '../../core/settings.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../lessons/lesson_content.dart' show ListenButton;
import '../progress/progress.dart';
import 'word_picture.dart';

/// A noun's gender (web/tools/course_content.py works it out from the article): der, die, das or plural.
enum NounGender { der, die, das, plural }

NounGender? nounGender(Word word) => NounGender.values.where((g) => g.name == word.gender).firstOrNull;

extension NounGenderLook on NounGender {
  String get label => switch (this) {
        NounGender.der => T('masculine'),
        NounGender.die => T('feminine'),
        NounGender.das => T('neuter'),
        NounGender.plural => T('plural'),
      };

  Color colour(Palette c) => switch (this) {
        NounGender.der => c.der,
        NounGender.die => c.die,
        NounGender.das => c.das,
        NounGender.plural => c.plural,
      };

  Color soft(Palette c) => switch (this) {
        NounGender.der => c.derSoft,
        NounGender.die => c.dieSoft,
        NounGender.das => c.dasSoft,
        NounGender.plural => c.pluralSoft,
      };
}

/// A German word, a noun all in its gender's colour (der blue, die rose, das green, plural plum).
class GermanWord extends StatelessWidget {
  const GermanWord(this.word, {super.key, this.role = TextRole.bodyStrong, this.align});
  final Word word;
  final TextRole role;
  final TextAlign? align;

  @override
  Widget build(BuildContext context) {
    final gender = nounGender(word);
    if (gender == null) return Txt(word.german, role: role, align: align);
    // The whole word in the gender's colour, its article (each one, in "der Nachtisch, die Nachspeise") bolder.
    final article = RegExp(r'(^|,\s*)(der|die|das)(?= )');
    final spans = <TextSpan>[];
    var at = 0;
    for (final m in article.allMatches(word.german)) {
      spans.add(TextSpan(text: word.german.substring(at, m.start) + m[1]!));
      spans.add(TextSpan(text: m[2], style: const TextStyle(fontWeight: FontWeight.w800)));
      at = m.end;
    }
    spans.add(TextSpan(text: word.german.substring(at)));
    return Text.rich(TextSpan(style: textStyle(role).copyWith(color: gender.colour(context.c)), children: spans), textAlign: align);
  }
}

/// A small label naming a noun's gender in words, so the colour is never the only sign.
class GenderTag extends StatelessWidget {
  const GenderTag(this.gender, {super.key});
  final NounGender gender;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Space.sm, vertical: 2),
      decoration: BoxDecoration(color: gender.soft(c), borderRadius: BorderRadius.circular(Radii.pill)),
      child: Txt(gender.label, role: TextRole.caption, colour: gender.colour(c), style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }
}

/// What each noun colour means, above a list of words.
class GenderKey extends StatelessWidget {
  const GenderKey({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Widget item(NounGender gender, String article) => Container(
          padding: const EdgeInsets.symmetric(horizontal: Space.sm + 2, vertical: Space.xs),
          decoration: BoxDecoration(color: gender.soft(c), borderRadius: BorderRadius.circular(Radii.pill)),
          child: Text.rich(TextSpan(
            style: textStyle(TextRole.caption).copyWith(color: gender.colour(c), fontWeight: FontWeight.w600),
            children: [
              TextSpan(text: article, style: const TextStyle(fontFamily: serif, fontWeight: FontWeight.w700)),
              TextSpan(text: ' ${gender.label}'),
            ],
          )),
        );
    return Wrap(spacing: Space.sm, runSpacing: Space.sm, crossAxisAlignment: WrapCrossAlignment.center, children: [
      Txt(T('Noun colours:'), role: TextRole.caption, colour: c.muted, style: const TextStyle(fontWeight: FontWeight.w600)),
      item(NounGender.der, 'der'),
      item(NounGender.die, 'die'),
      item(NounGender.das, 'das'),
      item(NounGender.plural, 'die'),
    ]);
  }
}

/// A word's example sentences (web/tools/examples): the German with a speaker, its meaning underneath, in the
/// learner's language, as on the website.
class ExampleList extends StatelessWidget {
  const ExampleList({super.key, required this.word});
  final Word word;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (word.examples.isEmpty) return const SizedBox.shrink();
    return Semantics(
      label: T('Examples'),
      container: true,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final example in word.examples)
          Padding(
            padding: const EdgeInsets.only(top: Space.sm),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ListenButton(example.$1, size: 34),
              const SizedBox(width: Space.sm),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Txt(example.$1, style: const TextStyle(fontFamily: serif, fontSize: 17, fontWeight: FontWeight.w600)),
                  Txt(course.exampleMeaning(example), role: TextRole.caption, colour: c.muted),
                ]),
              ),
              if (course.clocksFor(example.$1).isNotEmpty) ...[
                const SizedBox(width: Space.sm),
                ClockPictures(course.clocksFor(example.$1), size: 40),
              ],
            ]),
          ),
      ]),
    );
  }
}

/// A word in a list: its picture, the German, its meaning and examples, and a play button. The list builds rows as
/// they scroll into view, so a word counts as learned once its row has been shown (as on the website's word grid).
class WordRow extends StatefulWidget {
  const WordRow({super.key, required this.word, required this.learned});
  final Word word;
  final bool learned;

  @override
  State<WordRow> createState() => _WordRowState();
}

class _WordRowState extends State<WordRow> {
  @override
  void initState() {
    super.initState();
    if (!widget.learned) WidgetsBinding.instance.addPostFrameCallback((_) => learnWord(widget.word.german));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final word = widget.word;
    final meaning = course.meaning(word);
    final gender = nounGender(word);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: c.border, width: 0.8),
      ),
      // A noun's gender colour runs down the row's left edge, as on the website's word cards.
      child: Container(
        padding: const EdgeInsets.all(Space.sm + 4),
        decoration: gender == null ? null : BoxDecoration(border: Border(left: BorderSide(color: gender.colour(c), width: 4))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(Radii.md)),
              alignment: Alignment.center,
              child: word.pic.isNotEmpty ? WordPicture(codes: word.pic.take(1).toList(), size: 40) : Icon(Icons.abc_rounded, color: c.subtle),
            ),
            const SizedBox(width: Space.md),
            Expanded(
              child: Semantics(
                label: '${word.german}, $meaning${gender != null ? ', ${gender.label}' : ''}${widget.learned ? ', ${T('learned')}' : ''}',
                excludeSemantics: true,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  GermanWord(word),
                  Txt(meaning, role: TextRole.caption, colour: c.muted),
                  if (gender != null) Padding(padding: const EdgeInsets.only(top: Space.xs), child: GenderTag(gender)),
                ]),
              ),
            ),
            if (widget.learned) Icon(Icons.check_circle_rounded, size: 20, color: c.green),
            if (audio.hasClip(word.german)) ...[
              const SizedBox(width: Space.sm),
              RoundIconButton(icon: Icons.volume_up_rounded, label: T('Listen: {text}', {'text': word.german}), onPressed: () => audio.play(word.german)),
            ],
          ]),
          if (word.examples.isNotEmpty)
            Padding(padding: const EdgeInsets.only(left: 44 + Space.md, top: Space.xs), child: ExampleList(word: word)),
        ]),
      ),
    );
  }
}

/// Saves a unit's recordings on the phone (in the chosen voice and speed), so its words and exercises play
/// without a connection.
class OfflineCard extends StatefulWidget {
  const OfflineCard({super.key, required this.unit});
  final Unit unit;

  @override
  State<OfflineCard> createState() => _OfflineCardState();
}

class _OfflineCardState extends State<OfflineCard> {
  late var _count = audio.savedCount(widget.unit);
  var _busy = false;

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await audio.saveUnit(widget.unit, (done, total) {
        if (mounted) setState(() => _count = (done: done, total: total));
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(T('Download paused. Check your connection and try again; saved recordings are kept.'))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ListenableBuilder(
      listenable: settings,
      builder: (context, _) {
        if (!_busy) _count = audio.savedCount(widget.unit);
        final ready = _count.total > 0 && _count.done == _count.total;
        return Container(
          padding: const EdgeInsets.all(Space.sm + 4),
          decoration: BoxDecoration(color: ready ? c.greenSoft : c.surface2, borderRadius: BorderRadius.circular(Radii.lg)),
          child: Column(children: [
            Row(children: [
              Icon(ready ? Icons.cloud_done_outlined : Icons.cloud_download_outlined, color: ready ? c.green : c.muted),
              const SizedBox(width: Space.sm),
              Expanded(
                child: Txt(
                  ready ? T('Recordings saved for offline use') : (_busy ? T('Saving {done} of {total}…', {'done': _count.done, 'total': _count.total}) : T('Save this unit for offline use')),
                  role: TextRole.label,
                  colour: ready ? c.green : c.muted,
                ),
              ),
              if (!ready) AppButton(label: _busy ? T('Saving') : T('Save'), kind: ButtonKind.secondary, busy: _busy, expand: false, onPressed: _save),
            ]),
            if (_busy) ...[const SizedBox(height: Space.sm), Bar(value: _count.total == 0 ? 0 : _count.done / _count.total, colour: c.green, height: 6)],
          ]),
        );
      },
    );
  }
}
