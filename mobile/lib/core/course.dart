import 'dart:convert';

import 'package:flutter/widgets.dart';

import 'api/client.dart';
import 'api/models.dart';
import 'i18n.dart';
import 'storage.dart';
import 'sync/engine.dart';

/// The course: saved on the phone so the app opens at once and offline, then checked with the server (a 304 while
/// the copy is current costs almost nothing). Comes in English or with Amharic explanations, with every text change
/// an admin published on the website.
class CourseStore extends ChangeNotifier {
  CourseStore._();
  static final instance = CourseStore._();

  CourseBundle? bundle;
  String _version = '';
  String lang = 'en';

  /// Set when the course couldn't be loaded at all (first start without a connection).
  String? error;

  List<Unit> get units => bundle?.units ?? const [];

  String _file(String lang) => 'course-$lang.json';

  CourseBundle? _cached(String lang) {
    final file = Storage.instance.file(_file(lang));
    if (!file.existsSync()) return null;
    try {
      return CourseBundle.fromJson((jsonDecode(file.readAsStringSync()) as Map).cast());
    } catch (_) {
      return null;
    }
  }

  /// The saved copy first; then the server's, if it changed. Call once before the first screen.
  void load() {
    lang = Storage.instance.read<String>('lang', 'en');
    Strings.instance.lang = lang;
    bundle = _cached(lang);
    _version = bundle?.version ?? '';
    refresh();
    // Coming back to the app checks for content an admin published meanwhile; so does a live message.
    AppLifecycleListener(onResume: refresh);
    sync.onContentChanged(refresh);
  }

  Future<void> refresh() async {
    final asked = lang;
    try {
      final fresh = await Api.instance.course(asked, bundle?.lang == asked ? _version : null);
      if (asked != lang) return;
      if (fresh != null) {
        await Storage.instance.file(_file(asked)).writeAsString(jsonEncode(fresh));
        bundle = CourseBundle.fromJson(fresh);
        _version = bundle!.version;
      }
      error = null;
    } on ApiError catch (problem) {
      if (bundle == null) error = problem.message;
    }
    notifyListeners();
  }

  /// English or Amharic, for the course's explanations and the interface.
  void setLang(String next) {
    if (next == lang) return;
    lang = next;
    Strings.instance.lang = next;
    Storage.instance.write('lang', next);
    final cached = _cached(next);
    if (cached != null) {
      bundle = cached;
      _version = cached.version;
    }
    notifyListeners();
    refresh();
  }

  String _shown(String text) => bundle?.texts[text] ?? text;

  /// A course text as the site shows it: in Amharic when chosen, then with any change an admin published.
  /// Published changes are keyed by the text as shown (see web/apps/content), so they apply after translating.
  /// Unit, section and lesson titles are translated in the website's catalogue (web/locale/am.json, as the website
  /// itself does), not in the course's Amharic, so that is the fallback.
  String t(String text) => _shown(bundle?.amharic?.text[text] ?? (lang == 'am' ? T(text) : text));

  String meaning(Word word) => _shown(bundle?.amharic?.words[word.german] ?? word.english);

  String unitName(Unit unit) => t(unit.label ?? 'Unit ${unit.id}');

  Unit? unit(int id) => units.where((u) => u.id == id).firstOrNull;

  ({Unit unit, Lesson lesson})? lesson(String key) {
    for (final unit in units) {
      for (final lesson in unit.grammar) {
        if (lesson.key == key) return (unit: unit, lesson: lesson);
      }
    }
    return null;
  }

  ({Unit unit, Section section})? section(String key) {
    for (final unit in units) {
      for (final section in unit.sections) {
        if (section.key == key) return (unit: unit, section: section);
      }
    }
    return null;
  }

  /// Every word of the course once.
  List<Word> get allWords {
    final seen = <String>{};
    return [for (final u in units) for (final s in u.sections) for (final w in s.words) if (seen.add(w.german)) w];
  }
}

final course = CourseStore.instance;
