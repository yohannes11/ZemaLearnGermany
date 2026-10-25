import 'package:flutter/material.dart';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/offline/audio.dart';
import '../../ui/primitives.dart';
import '../../ui/rich_text.dart';
import '../../ui/theme.dart';
import 'questions.dart';

/// A small speaker that plays `german`; nothing when there is no recording.
class ListenButton extends StatelessWidget {
  const ListenButton(this.german, {super.key, this.size = 36});
  final String german;
  final double size;

  @override
  Widget build(BuildContext context) => audio.hasClip(german)
      ? RoundIconButton(icon: Icons.volume_up_rounded, label: 'Listen to $german', size: size, onPressed: () => audio.play(german))
      : const SizedBox.shrink();
}

/// German that plays its recording when tapped.
class Spoken extends StatelessWidget {
  const Spoken(this.german, {super.key});
  final String german;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // The part of an example that is spoken: "A → B" examples say B (as on the website).
    final said = german.contains('→') ? german.split('→').last.trim() : german;
    final audible = audio.hasClip(said);
    return InkWell(
      onTap: audible ? () => audio.play(said) : null,
      borderRadius: BorderRadius.circular(Radii.sm),
      child: Row(children: [
        if (audible) ...[Icon(Icons.volume_up_rounded, size: 18, color: c.brand), const SizedBox(width: Space.xs)],
        Flexible(child: Txt(german, role: TextRole.bodyStrong, colour: audible ? c.brand : c.text)),
      ]),
    );
  }
}

/// A lesson panel: a step, a title, and what it holds.
class Panel extends StatelessWidget {
  const Panel({super.key, this.step, this.title, required this.children});
  final String? step;
  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => AppCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: gapped([
          if (step != null && step!.isNotEmpty) Txt(step!, role: TextRole.overline, colour: context.c.brand),
          if (title != null && title!.isNotEmpty) Txt(title!, role: TextRole.heading),
          ...children,
        ], Space.sm)),
      );
}

/// A table of forms; a row with a recording plays when tapped.
class FormTable extends StatelessWidget {
  const FormTable({super.key, required this.head, required this.rows, this.say = const [], this.highlight});
  final List<String> head;
  final List<List<String>> rows;
  final List<String?> say;
  final int? highlight;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      decoration: BoxDecoration(border: Border.all(color: c.border, width: 0.8), borderRadius: BorderRadius.circular(Radii.sm)),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        Container(
          color: c.surface2,
          padding: const EdgeInsets.all(Space.sm),
          child: Row(children: [for (final h in head) Expanded(child: Txt(h, role: TextRole.label))]),
        ),
        for (final (r, row) in rows.indexed)
          InkWell(
            onTap: r < say.length && say[r] != null ? () => audio.play(say[r]!) : null,
            child: Container(
              padding: const EdgeInsets.all(Space.sm),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border, width: 0.8))),
              child: Row(children: [
                for (final (i, cell) in row.indexed)
                  Expanded(
                    child: Txt(cell,
                        role: i == highlight ? TextRole.bodyStrong : TextRole.body, colour: i == highlight ? c.brand : null),
                  ),
                if (r < say.length && say[r] != null && audio.hasClip(say[r]!)) Icon(Icons.volume_up_rounded, size: 18, color: c.brand),
              ]),
            ),
          ),
      ]),
    );
  }
}

/// A reading text: each paragraph can be heard, with the new words underneath.
class ReadingText extends StatelessWidget {
  const ReadingText({super.key, required this.block});
  final Block block;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: gapped([
        for (final paragraph in block.reading)
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Txt(paragraph, style: const TextStyle(height: 1.6))),
            ListenButton(paragraph),
          ]),
        if (block.glossary.isNotEmpty)
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: gapped([
            for (final (german, meaning) in block.glossary)
              Text.rich(TextSpan(children: [
                TextSpan(text: german, style: textStyle(TextRole.label)),
                TextSpan(text: ' · ${course.t(meaning)}'),
              ]), style: textStyle(TextRole.caption).copyWith(color: context.c.text)),
          ], Space.xs)),
      ], Space.sm));
}

class _RuleCards extends StatelessWidget {
  const _RuleCards(this.rules);
  final List<(String, String)> rules;

  @override
  Widget build(BuildContext context) => Panel(title: T('Remember'), children: [
        for (final (rule, example) in rules)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(Space.sm + 4),
            decoration: BoxDecoration(color: context.c.surface2, borderRadius: BorderRadius.circular(Radii.md)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              RichTxt(rule, role: TextRole.bodyStrong),
              RichTxt(example, colour: context.c.muted),
            ]),
          ),
      ]);
}

/// A lesson's explanation, as the website lays it out: the idea, its blocks (text, examples, tables, reading)
/// and the rules to remember. The website's own lessons (verb endings, countries, the unit test) are built here.
class LessonContent extends StatelessWidget {
  const LessonContent({super.key, required this.unit, required this.lesson});
  final Unit unit;
  final Lesson lesson;

  @override
  Widget build(BuildContext context) {
    final t = course.t;
    return switch (lesson.custom) {
      'present' => const _PresentLesson(),
      'countries' => const _CountriesLesson(),
      'review' => Column(children: gapped([
          Panel(title: T('How the unit test works'), children: [for (final p in lesson.intro) RichTxt(t(p))]),
          Panel(title: T('What it covers'), children: [
            for (final g in unit.grammar)
              if (g != lesson) Txt('• ${g.code} · ${t(g.title)}'),
            Txt('• ${T('Vocabulary from all {n} sections', {'n': unit.sections.length})}'),
          ]),
        ])),
      _ => Column(children: gapped([
          if (lesson.intro.isNotEmpty) Panel(title: T('The idea'), children: [for (final p in lesson.intro) RichTxt(t(p))]),
          for (final block in lesson.blocks)
            Panel(step: t(block.step ?? ''), title: t(block.title ?? ''), children: [
              if (block.text != null) RichTxt(t(block.text!)),
              if (block.reading.isNotEmpty) ReadingText(block: block),
              if (block.table != null)
                FormTable(
                  head: block.table!.head.map(t).toList(),
                  rows: [for (final row in block.table!.rows) row.map(t).toList()],
                  say: block.table!.say,
                  highlight: block.table!.highlight,
                ),
              for (final (german, meaning) in block.examples)
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Spoken(german),
                  RichTxt(t(meaning), role: TextRole.caption, colour: context.c.muted),
                ]),
            ]),
          if (lesson.rules.isNotEmpty) _RuleCards([for (final (r, e) in lesson.rules) (t(r), t(e))]),
        ])),
    };
  }
}

/// The website's verb-endings lesson: pick a verb, see its stem, then every person with its ending.
class _PresentLesson extends StatefulWidget {
  const _PresentLesson();

  @override
  State<_PresentLesson> createState() => _PresentLessonState();
}

class _PresentLessonState extends State<_PresentLesson> {
  var _verb = 0;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final verb = verbs[_verb];
    return Column(children: gapped([
      Panel(title: T('Why verbs change their ending'), children: [
        RichTxt(T('In German, the end of a verb changes to match <strong>who</strong> is doing the action: <em class="de">ich mache</em>, <em class="de">du machst</em>, <em class="de">wir machen</em>.')),
        RichTxt(T('Regular verbs all follow the same pattern, built in two steps.')),
      ]),
      Panel(step: T('Step 1'), title: T('Find the stem'), children: [
        RichTxt(T('Take the infinitive (the dictionary form) and remove the ending <strong>-en</strong>. Pick a verb:')),
        Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [
          for (final (i, v) in verbs.indexed)
            ChoiceChip(
              label: Text(v.inf),
              selected: i == _verb,
              onSelected: (_) => setState(() => _verb = i),
              selectedColor: c.brandSoft,
              side: BorderSide(color: i == _verb ? c.brand : c.border),
            ),
        ]),
        Text.rich(TextSpan(children: [
          TextSpan(text: verb.stem),
          TextSpan(text: 'en', style: TextStyle(decoration: TextDecoration.lineThrough, color: c.muted)),
          const TextSpan(text: '  →  '),
          TextSpan(text: '${verb.stem}-', style: TextStyle(color: c.brand, fontWeight: FontWeight.w700)),
          TextSpan(text: '   ${verb.en}', style: textStyle(TextRole.caption).copyWith(color: c.muted)),
        ]), style: textStyle(TextRole.heading).copyWith(color: c.text)),
      ]),
      Panel(step: T('Step 2'), title: T('Add the ending'), children: [
        RichTxt(T('Add the ending that belongs to the person. Press a speaker to hear each form.')),
        FormTable(
          head: [T('Person'), T('Ending'), T('Form'), T('Meaning')],
          rows: [
            for (final (i, p) in persons.indexed) [p.$1, '-${endingFor(verb, i)}', '${verb.stem}${endingFor(verb, i)}', p.$4],
          ],
          say: [for (final (i, p) in persons.indexed) '${p.$2} ${verb.stem}${endingFor(verb, i)}'],
          highlight: 2,
        ),
        if (verb.inf == 'heißen')
          Container(
            padding: const EdgeInsets.all(Space.sm + 4),
            decoration: BoxDecoration(color: c.goldSoft, borderRadius: BorderRadius.circular(Radii.md)),
            child: Txt(T('Watch out: the stem heiß- already ends in ß, so du only adds -t: du heißt (not du heißst).')),
          ),
      ]),
      _RuleCards([
        ('-e · -st · -t', 'ich, du, er/sie/es'),
        ('-en · -t · -en', 'wir, ihr, sie/Sie'),
        ('wir = sie = Sie', T('These look just like the infinitive: <mark>machen</mark>')),
        ('er/sie/es = ihr', T('Both end in <mark>-t</mark>: er macht, ihr macht')),
      ]),
    ]));
  }
}

/// The website's countries lesson: aus, aus der or aus den.
class _CountriesLesson extends StatelessWidget {
  const _CountriesLesson();

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(children: gapped([
      Panel(title: T('Most countries need no article'), children: [
        RichTxt(T('To say where you are from, use <strong>aus</strong> + the country: <em class="de">Ich komme aus Deutschland.</em> <em class="de">Ich komme aus Äthiopien.</em>')),
        RichTxt(T('A few countries always have an article. After <strong>aus</strong> that article changes.')),
      ]),
      Panel(step: T('The rule'), title: T('Countries with an article'), children: [
        FormTable(
          head: [T('Country'), T('Type'), T('I come from …')],
          rows: [for (final k in countries) [k.nom, k.gender, '${k.aus} ${k.rest}']],
          say: [for (final k in countries) 'Ich komme ${k.aus} ${k.rest}.'],
          highlight: 2,
        ),
        Container(
          padding: const EdgeInsets.all(Space.sm + 4),
          decoration: BoxDecoration(color: c.goldSoft, borderRadius: BorderRadius.circular(Radii.md)),
          child: RichTxt(T('Die Niederlande and die Vereinigten Arabischen Emirate are plural, so after aus they become <em class="de">aus den Niederlanden</em> and <em class="de">aus den … Emiraten</em>.')),
        ),
      ]),
      _RuleCards([
        ('die → aus <mark>der</mark>', T('feminine: die Schweiz, die Türkei')),
        ('die → aus <mark>den</mark> (+n)', T('plural: die USA, die Niederlande')),
        (T('no article → aus'), 'Deutschland, Äthiopien, Österreich …'),
      ]),
    ]));
  }
}
