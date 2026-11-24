import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/offline/audio.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import 'word_widgets.dart';

/// One word or phrase of the course, for the dictionary card.
class DictionaryEntry {
  const DictionaryEntry({
    required this.german,
    required this.english,
    this.amharic = '',
    this.gender,
  });
  final String german;
  final String english;
  final String amharic;
  final NounGender? gender;
}

/// Every word of the course (vocabulary and reading glossaries), found the way the website finds them
/// (web/static/core/js/hover-read.js): as written, without capitals or punctuation, nouns without their article
/// ("Kaffee") and verbs by their stem ("trinke", "kommt" -> trinken, kommen).
class Dictionary {
  Dictionary._();
  static final instance = Dictionary._();

  Object? _builtFor;
  final _entries = <String, DictionaryEntry>{};
  final _stems = <String, DictionaryEntry>{};

  static String _clean(String text) =>
      text.replaceAll(RegExp(r'\s+'), ' ').trim();
  static String _bare(String text) =>
      _clean(text)
          .replaceAll(RegExp(r'[.,!?;:…"“”„()«»]'), '')
          .trim()
          .toLowerCase();

  void _build() {
    final bundle = course.bundle;
    if (identical(bundle, _builtFor)) return;
    _builtFor = bundle;
    _entries.clear();
    _stems.clear();
    final amharic = bundle?.amharic;
    void add(String german, String english, String am, NounGender? gender) {
      final entry = DictionaryEntry(
        german: _clean(german),
        english: english,
        amharic: am,
        gender: gender,
      );
      final plain = _bare(german);
      final keys = [
        _clean(german),
        plain,
        if (english.startsWith('the '))
          plain.replaceFirst(RegExp(r'^(der|die|das) '), ''),
        if (german.contains(' / ')) ...german.split(' / ').map(_bare),
        // "der Opa, der Großvater": each noun on its own too.
        if (gender != null && german.contains(', '))
          ...german
              .split(', ')
              .expand(
                (part) => [
                  _bare(part),
                  _bare(part).replaceFirst(RegExp(r'^(der|die|das) '), ''),
                ],
              ),
      ];
      for (final key in keys) {
        if (key.isNotEmpty) _entries.putIfAbsent(key, () => entry);
      }
      if (english.startsWith('to ') &&
          RegExp(r'^[a-zäöüß]+n$').hasMatch(german)) {
        _stems.putIfAbsent(
          german.replaceFirst(RegExp(r'e?n$'), ''),
          () => entry,
        );
      }
    }

    for (final unit in course.units) {
      for (final section in unit.sections) {
        for (final word in section.words) {
          add(
            word.german,
            word.english,
            amharic?.words[word.german] ?? '',
            nounGender(word),
          );
        }
      }
      for (final lesson in unit.grammar) {
        for (final block in lesson.blocks) {
          for (final (german, english) in block.glossary) {
            add(german, english, amharic?.text[english] ?? '', null);
          }
        }
      }
    }
  }

  /// The course's entry for a selected German text, or null.
  DictionaryEntry? find(String text) {
    _build();
    final plain = _bare(text);
    if (plain.isEmpty) return null;
    return _entries[_clean(text)] ??
        _entries[plain] ??
        // "den Kaffee", "meine Mutter": the noun without the word before it.
        (plain.contains(' ')
            ? _entries[plain.substring(plain.indexOf(' ') + 1)]
            : null) ??
        _stems[plain.replaceFirst(RegExp(r'(est|st|et|en|t|e)$'), '')];
  }
}

/// Long-press German text inside `child` to select it: instead of the phone's usual menu, a card shows the word
/// with its article, its gender in words and colour, its meaning in English (and Amharic when the app is in
/// Amharic), with Listen, Copy and Close buttons. Text the course doesn't know gets the usual menu.
/// Used where learners read (word pages, lessons); not in exercises, where it would give answers away.
class WordLookup extends StatefulWidget {
  const WordLookup({super.key, required this.child});
  final Widget child;

  @override
  State<WordLookup> createState() => _WordLookupState();
}

class _WordLookupState extends State<WordLookup> {
  String _selected = '';

  static final _edges = RegExp(r'^[\s.,!?;:…"“”„()«»]+|[\s.,!?;:…"“”„()«»]+$');

  @override
  Widget build(BuildContext context) => SelectionArea(
    onSelectionChanged: (content) =>
        _selected = (content?.plainText ?? '').replaceAll(_edges, ''),
    contextMenuBuilder: (context, region) {
      final text = _selected.replaceAll(RegExp(r'\s+'), ' ');
      final entry =
          text.isEmpty || text.length > 80 || text.split(' ').length > 6
          ? null
          : Dictionary.instance.find(text);
      if (entry == null) {
        return AdaptiveTextSelectionToolbar.selectableRegion(
          selectableRegionState: region,
        );
      }
      return _DictionaryCard(
        entry: entry,
        anchors: region.contextMenuAnchors,
        onCopy: () {
          Clipboard.setData(ClipboardData(text: text));
          region.hideToolbar();
        },
        onClose: () {
          region.hideToolbar();
          region.clearSelection();
        },
      );
    },
    child: widget.child,
  );
}

class _DictionaryCard extends StatelessWidget {
  const _DictionaryCard({
    required this.entry,
    required this.anchors,
    required this.onCopy,
    required this.onClose,
  });
  final DictionaryEntry entry;
  final TextSelectionToolbarAnchors anchors;
  final VoidCallback onCopy, onClose;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final gender = entry.gender;
    final padding = MediaQuery.paddingOf(context);
    // The learner's language first.
    final english = (T('In English'), entry.english);
    final amharic = (T('In Amharic'), entry.amharic);
    final meanings = [
      if (course.lang == 'am' && entry.amharic.isNotEmpty) amharic,
      english,
      if (course.lang != 'am' && entry.amharic.isNotEmpty) amharic,
    ];

    Widget action(String label, VoidCallback onPressed, {bool main = false}) =>
        main
        ? FilledButton(
            onPressed: onPressed,
            style: FilledButton.styleFrom(
              backgroundColor: c.brand,
              foregroundColor: c.brandInk,
              visualDensity: VisualDensity.compact,
            ),
            child: Text(label),
          )
        : OutlinedButton(
            onPressed: onPressed,
            style: OutlinedButton.styleFrom(
              foregroundColor: c.text,
              side: BorderSide(color: c.borderStrong),
              visualDensity: VisualDensity.compact,
            ),
            child: Text(label),
          );

    final card = Material(
      color: c.surface,
      elevation: 8,
      shadowColor: Colors.black38,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Radii.lg),
        side: BorderSide(color: c.borderStrong),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 320),
        child: Padding(
          padding: const EdgeInsets.all(Space.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Txt(
                entry.german,
                role: TextRole.heading,
                colour: gender?.colour(c) ?? c.brand,
              ),
              if (gender != null) ...[
                const SizedBox(height: Space.xs),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: Space.sm,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: gender.soft(c),
                    borderRadius: BorderRadius.circular(Radii.pill),
                  ),
                  child: Txt(
                    '${gender == NounGender.plural ? 'die' : gender.name} · ${gender.label}',
                    role: TextRole.caption,
                    colour: gender.colour(c),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
              for (final (label, meaning) in meanings) ...[
                const SizedBox(height: Space.sm),
                Txt(label, role: TextRole.caption, colour: c.muted),
                Txt(meaning, role: TextRole.bodyStrong),
              ],
              const SizedBox(height: Space.md),
              Wrap(
                spacing: Space.sm,
                runSpacing: Space.sm,
                children: [
                  if (audio.hasClip(entry.german))
                    action(
                      T('Listen'),
                      () => audio.play(entry.german),
                      main: true,
                    ),
                  action(T('Copy'), onCopy),
                  action(T('Close'), onClose),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    // Above the selection when it fits, else below it (the layout the phone's own menu uses).
    final above = anchors.primaryAnchor.dy - Space.sm;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        Space.sm,
        padding.top + Space.sm,
        Space.sm,
        padding.bottom + Space.sm,
      ),
      child: CustomSingleChildLayout(
        delegate: TextSelectionToolbarLayoutDelegate(
          anchorAbove: Offset(
            anchors.primaryAnchor.dx - Space.sm,
            above - padding.top - Space.sm,
          ),
          anchorBelow: Offset(
            (anchors.secondaryAnchor ?? anchors.primaryAnchor).dx - Space.sm,
            (anchors.secondaryAnchor ?? anchors.primaryAnchor).dy +
                Space.md -
                padding.top -
                Space.sm,
          ),
        ),
        child: card,
      ),
    );
  }
}
