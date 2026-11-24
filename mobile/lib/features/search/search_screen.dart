import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../../ui/watch.dart';
import '../lessons/lesson_content.dart' show ListenButton;
import '../vocabulary/word_widgets.dart' show GermanWord, NounGenderLook, nounGender;
import 'search_engine.dart';

const _tries = ['Danke', 'schoen', 'how to order food', 'accusative', 'past tense', 'ምግብ'];

// The filters' choices, as on the website (course.js SEARCH_TYPES, WORD_TYPES).
List<(String, String)> get _types =>
    [('word', T('Words')), ('grammar', T('Grammar')), ('reading', T('Reading')), ('chapter', T('Word lists')), ('topic', T('Topics'))];
List<(String, String, String)> get _wordTypes => [
      ('noun', T('Nouns'), T('Noun')),
      ('verb', T('Verbs'), T('Verb')),
      ('adjective', T('Adjectives & adverbs'), T('Adjective / adverb')),
      ('phrase', T('Phrases'), T('Phrase')),
      ('number', T('Numbers'), T('Number')),
      ('small', T('Small words'), T('Small word')),
    ];

/// The course's search index, built once per course download (and again when the course changes).
SearchIndex _searchIndex() {
  final bundle = course.bundle;
  if (_cached == null || !identical(_cachedFor, bundle)) {
    _cached = SearchIndex(course.units, bundle?.topics ?? const [], amharic: bundle?.amharic, title: course.t);
    _cachedFor = bundle;
  }
  return _cached!;
}

SearchIndex? _cached;
CourseBundle? _cachedFor;

/// Looks like a search field and opens the search: at the top of Home, Words and Lessons, so it is always in view;
/// in a chapter ([unit] and [section]) it searches only there.
class SearchEntry extends StatelessWidget {
  const SearchEntry({super.key, this.unit, this.section});
  final int? unit;
  final String? section;

  // Listens itself: it is built const, so a change of language in its parent would not redraw it.
  @override
  Widget build(BuildContext context) => Watch(builder: _build);

  Widget _build(BuildContext context) {
    final c = context.c;
    return Semantics(
      button: true,
      label: section == null ? T('Search the course') : T('Search this chapter'),
      excludeSemantics: true,
      child: Material(
        color: c.surface2,
        borderRadius: BorderRadius.circular(Radii.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.md),
          onTap: () => context.push(section == null ? '/search' : '/search?unit=$unit&section=$section'),
          child: Container(
            constraints: const BoxConstraints(minHeight: 52),
            padding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: Space.sm),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Radii.md),
              border: Border.all(color: c.border, width: 1.2),
            ),
            child: Row(children: [
              Icon(Icons.search_rounded, color: c.muted),
              const SizedBox(width: Space.sm),
              if (section != null)
                Expanded(child: Txt(T('Search this chapter'), role: TextRole.label))
              else ...[
                Txt(T('Search'), role: TextRole.label),
                const SizedBox(width: Space.sm),
                Expanded(child: Txt(T('A word, a sentence, grammar or a question'), role: TextRole.caption, colour: c.subtle, maxLines: 1)),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}

/// The whole course, searched on the phone: words (German, meanings, example sentences, any spelling, German in
/// Ethiopic letters), grammar lessons, chapters and topics. As the website's search window.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.unit, this.section});

  /// Where to search, from a chapter: only there, until the learner widens it.
  final int? unit;
  final String? section;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _input = TextEditingController();
  Timer? _timer;
  var _results = const <SearchResult>[];
  String? _type;
  String? _pos;
  late int? _unit = widget.unit;
  late String? _section = widget.section;

  SearchFilters get _filters =>
      SearchFilters(types: [?_type], pos: [?_pos], unit: _unit, section: _section);

  int get _filterCount => (_type == null ? 0 : 1) + (_pos == null ? 0 : 1) + (_unit == null ? 0 : 1);

  @override
  void initState() {
    super.initState();
    if (_section != null) WidgetsBinding.instance.addPostFrameCallback((_) => _run());
  }

  void _changed(String _) {
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 120), _run);
  }

  void _run() {
    if (!mounted) return;
    final query = _input.text.trim();
    setState(() => _results = query.isEmpty && !_filters.active ? const [] : _searchIndex().search(query, filters: _filters));
  }

  void _setFilters(VoidCallback change) {
    change();
    _run();
  }

  void _try(String text) {
    _input.text = text;
    _input.selection = TextSelection.collapsed(offset: text.length);
    _run();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _input.dispose();
    super.dispose();
  }

  /// The chapter a word result opens in: the one searched in, when it is there too.
  String _placeOf(SearchResult r) => _section != null && r.sections.contains(_section) ? _section! : r.section!;

  // Where results lead; the search closes on the way.
  void _openWord(SearchResult r) {
    final place = _placeOf(r);
    final section = course.section(place);
    final index = section?.section.words.indexWhere((w) => w.german == r.id) ?? 0;
    context.pushReplacement('/session/learn/$place?from=${index < 0 ? 0 : index}');
  }

  void _openChapter(String key) => context.go('/words/$key');
  void _openLesson(String key) => context.go('/lessons/$key');

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final query = _input.text.trim();
    final narrowed = _filters.active;
    final names = {
      for (final r in _results.take(12)) r.kind == SearchKind.word ? r.id : course.t(r.title!),
    }.where((n) => fold(n) != fold(query)).take(5).toList();
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Txt(T('Search the course'), role: TextRole.heading),
        actions: [
          TextButton.icon(onPressed: () => context.pop(), icon: const Icon(Icons.close_rounded), label: Text(T('Close'))),
          const SizedBox(width: Space.xs),
        ],
      ),
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.md, Space.sm, Space.md, 0),
            child: TextField(
              controller: _input,
              // From a chapter the list comes first (its words, to browse); from anywhere else the keyboard.
              autofocus: widget.section == null,
              autocorrect: false,
              textInputAction: TextInputAction.search,
              onChanged: _changed,
              onSubmitted: (_) => _run(),
              style: textStyle(TextRole.body).copyWith(fontSize: 18, color: c.text),
              decoration: InputDecoration(
                hintText: T('A word, a sentence, grammar or a question'),
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: query.isEmpty
                    ? null
                    : Padding(
                        padding: const EdgeInsets.only(right: Space.xs),
                        child: TextButton(onPressed: () => _try(''), child: Text(T('Clear'))),
                      ),
                filled: true,
                fillColor: c.surface2,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(Radii.md), borderSide: BorderSide(color: c.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Radii.md), borderSide: BorderSide(color: c.border, width: 1.5)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Radii.md), borderSide: BorderSide(color: c.brand, width: 2)),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.md, Space.sm, Space.md, 0),
            child: Txt(T('Type in German, English or Amharic. The spelling does not have to be perfect.'), role: TextRole.caption, colour: c.muted),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(Space.md, Space.sm, Space.md, Space.xxl),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                if (_unit != null || _section != null) _scope(context),
                if (query.isNotEmpty && names.isNotEmpty) _suggestions(context, names),
                _filterPanel(context),
                if (query.isEmpty && !narrowed)
                  _Tries(label: T('Try one of these:'), onTap: _try)
                else if (_results.isEmpty) ...[
                  const SizedBox(height: Space.md),
                  Txt(query.isEmpty ? T('Nothing here fits these filters.') : T('Nothing found for “{q}”.', {'q': query}), role: TextRole.subheading),
                  const SizedBox(height: Space.xs),
                  Txt(narrowed ? T('Try fewer filters, or search the whole course.') : T('Try another spelling or a shorter word, or type it in English or Amharic.'),
                      colour: c.muted),
                  if (!narrowed) _Tries(label: T('Or try one of these:'), onTap: _try),
                ] else
                  ..._groups(context),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  /// Where a scoped search looks, with the way out to the whole course.
  Widget _scope(BuildContext context) {
    final c = context.c;
    final unit = _unit == null ? null : course.unit(_unit!);
    final place = _section != null && _unit != null ? _where(_unit!, _section!) : (unit == null ? '' : course.unitName(unit));
    return Container(
      margin: const EdgeInsets.only(top: Space.sm),
      padding: const EdgeInsets.fromLTRB(Space.md, Space.xs, Space.xs, Space.xs),
      decoration: BoxDecoration(color: c.brandSoft, borderRadius: BorderRadius.circular(Radii.md)),
      child: Row(children: [
        Expanded(child: Txt(T('Only in: {place}', {'place': place}), role: TextRole.label)),
        TextButton(onPressed: () => _setFilters(() => _unit = _section = null), child: Text(T('Search the whole course'))),
      ]),
    );
  }

  /// Autocomplete: the best matches' names, a tap away (also how a misspelling finds its word).
  Widget _suggestions(BuildContext context, List<String> names) => Padding(
        padding: const EdgeInsets.only(top: Space.sm),
        child: Wrap(spacing: Space.sm, runSpacing: Space.xs, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Txt(T('Suggestions:'), role: TextRole.caption, colour: context.c.muted),
          for (final name in names) ActionChip(label: Text(name), onPressed: () => _try(name)),
        ]),
      );

  /// The filters: what to show, which kind of word, which unit.
  Widget _filterPanel(BuildContext context) {
    final c = context.c;
    Widget chips(String label, List<(String?, String)> options, String? value, ValueChanged<String?> pick) => Padding(
          padding: const EdgeInsets.only(bottom: Space.sm),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Txt(label, role: TextRole.caption, colour: c.muted),
            const SizedBox(height: Space.xs),
            Wrap(spacing: Space.sm, runSpacing: Space.xs, children: [
              for (final (key, name) in options)
                ChoiceChip(label: Text(name), selected: key == value, onSelected: (_) => _setFilters(() => pick(key))),
            ]),
          ]),
        );
    final count = _filterCount;
    return Container(
      margin: const EdgeInsets.only(top: Space.sm),
      decoration: BoxDecoration(border: Border.all(color: c.border), borderRadius: BorderRadius.circular(Radii.md)),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          // The keyboard would cover the filters.
          onExpansionChanged: (_) => FocusScope.of(context).unfocus(),
          leading: Icon(Icons.tune_rounded, color: c.brand),
          title: Row(children: [
            Txt(T('Filters'), role: TextRole.label),
            if (count > 0) ...[
              const SizedBox(width: Space.sm),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: Space.sm, vertical: 1),
                decoration: BoxDecoration(color: c.brand, borderRadius: BorderRadius.circular(Radii.pill)),
                child: Txt('$count', role: TextRole.caption, colour: c.brandInk),
              ),
            ],
          ]),
          childrenPadding: const EdgeInsets.fromLTRB(Space.md, 0, Space.md, Space.sm),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          children: [
            chips(T('Show'), [(null, T('All')), for (final (k, n) in _types) (k, n)], _type, (k) {
              _type = k;
              if (k != null && k != 'word') _pos = null;
            }),
            if (_type == null || _type == 'word')
              chips(T('Word type'), [(null, T('All')), for (final (k, n, _) in _wordTypes) (k, n)], _pos, (k) => _pos = k),
            Txt(T('Unit'), role: TextRole.caption, colour: c.muted),
            DropdownButton<int?>(
              isExpanded: true,
              value: _unit,
              items: [
                DropdownMenuItem(value: null, child: Text(T('All units'))),
                for (final u in course.units)
                  DropdownMenuItem(value: u.id, child: Text('${course.unitName(u)} · ${course.t(u.title)}', overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (v) => _setFilters(() {
                _unit = v;
                _section = null;
              }),
            ),
            if (count > 0 || _section != null)
              TextButton(
                onPressed: () => _setFilters(() => _type = _pos = _unit = _section = null),
                child: Text(T('Clear filters')),
              ),
          ],
        ),
      ),
    );
  }

  /// Results by kind; the kind with the best result first.
  List<Widget> _groups(BuildContext context) {
    final c = context.c;
    final groups = <SearchKind, List<SearchResult>>{for (final kind in SearchKind.values) kind: []};
    for (final r in _results) {
      groups[r.kind]!.add(r);
    }
    final names = {SearchKind.topic: T('Topics'), SearchKind.word: T('Words'), SearchKind.lesson: T('Lessons'), SearchKind.chapter: T('Chapters')};
    final order = groups.entries.where((e) => e.value.isNotEmpty).toList()..sort((a, b) => b.value.first.score.compareTo(a.value.first.score));
    return [
      for (final MapEntry(key: kind, value: list) in order) ...[
        const SizedBox(height: Space.md),
        Row(children: [
          Txt(names[kind]!, role: TextRole.overline, colour: c.muted),
          const SizedBox(width: Space.sm),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: Space.sm, vertical: 1),
            decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(Radii.pill)),
            child: Txt('${list.length}', role: TextRole.caption, colour: c.muted),
          ),
        ]),
        const SizedBox(height: Space.sm),
        ...gapped([for (final r in list) _item(context, r)], Space.sm),
      ],
    ];
  }

  String _where(int unitId, String key) {
    final unit = course.unit(unitId);
    if (unit == null) return '';
    final section = unit.sections.where((s) => s.key == key).firstOrNull;
    final lesson = unit.grammar.where((g) => g.key == key).firstOrNull;
    return '${course.unitName(unit)} · ${course.t(section?.title ?? lesson?.title ?? '')}';
  }

  Widget _item(BuildContext context, SearchResult r) {
    final c = context.c;
    switch (r.kind) {
      case SearchKind.word:
        final word = r.word!;
        final example = r.example == null ? null : word.examples[r.example!];
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(top: Space.sm), child: ListenButton(word.german, size: 40)),
          const SizedBox(width: Space.sm),
          Expanded(
            child: AppCard(
              onTap: () => _openWord(r),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                GermanWord(word, role: TextRole.subheading),
                Txt(course.meaning(word)),
                Txt(
                  '${_where(course.section(_placeOf(r))?.unit.id ?? r.unit!, _placeOf(r))}'
                  '${_wordTypes.where((t) => t.$1 == r.pos).map((t) => ' · ${t.$3}').firstOrNull ?? ''}'
                  '${nounGender(word) == null ? '' : ' · ${nounGender(word)!.label}'}',
                  role: TextRole.caption,
                  colour: c.muted,
                ),
                if (example != null) ...[
                  const Divider(height: Space.md),
                  Txt(example.$1, role: TextRole.bodyStrong),
                  Txt(course.exampleMeaning(example), role: TextRole.caption, colour: c.muted),
                ],
              ]),
            ),
          ),
        ]);
      case SearchKind.topic:
        final topic = r.topic!;
        final links = [
          for (final key in topic.lessons) (course.lesson(key)?.unit.id, key, true),
          for (final key in topic.chapters) (course.section(key)?.unit.id, key, false),
        ].where((l) => l.$1 != null).take(8);
        return Container(
          padding: const EdgeInsets.all(Space.md),
          decoration: BoxDecoration(color: c.brandSoft, borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: c.border)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Txt(topic.kind == 'grammar' ? T('Grammar') : T('Topic'), role: TextRole.overline, colour: c.brand),
            Txt(course.t(topic.title), role: TextRole.subheading),
            const SizedBox(height: Space.sm),
            Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [
              for (final (unitId, key, lesson) in links)
                ActionChip(
                  label: Text(_where(unitId!, key)),
                  backgroundColor: c.surface,
                  side: BorderSide(color: c.border),
                  onPressed: () => lesson ? _openLesson(key) : _openChapter(key),
                ),
            ]),
          ]),
        );
      case SearchKind.lesson:
        final unit = course.unit(r.unit!);
        return AppCard(
          onTap: () => _openLesson(r.id),
          child: ListRow(
            title: course.t(r.title!),
            detail: unit == null ? null : '${course.unitName(unit)} · ${course.t(unit.lessonsLabel ?? 'Grammar')}',
          ),
        );
      case SearchKind.chapter:
        final unit = course.unit(r.unit!);
        final count = unit?.sections.where((s) => s.key == r.id).firstOrNull?.words.length ?? 0;
        return AppCard(
          onTap: () => _openChapter(r.id),
          child: ListRow(
            title: course.t(r.title!),
            detail: unit == null ? null : '${course.unitName(unit)} · ${T('{n} words', {'n': count})}',
          ),
        );
    }
  }
}

class _Tries extends StatelessWidget {
  const _Tries({required this.label, required this.onTap});
  final String label;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: Space.md),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Txt(label, role: TextRole.caption, colour: context.c.muted),
          const SizedBox(height: Space.sm),
          Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [
            for (final text in _tries) ActionChip(label: Text(text), onPressed: () => onTap(text)),
          ]),
        ]),
      );
}
