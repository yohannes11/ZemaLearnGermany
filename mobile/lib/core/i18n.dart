import 'dart:convert';

import 'package:flutter/services.dart';

/// The interface in English or Amharic, from the website's own catalogue (web/locale/am.json, copied into
/// assets/locale by `dart run tool/sync_shared.dart`). English text is the key, as on the website, so a label
/// the website already translates is translated here too. Text not in the catalogue stays English.
class Strings {
  Strings._();
  static final instance = Strings._();

  Map<String, String> _amharic = {};
  String lang = 'en';

  Future<void> load() async {
    try {
      final catalogue = jsonDecode(await rootBundle.loadString('assets/locale/am.json')) as Map<String, dynamic>;
      _amharic = {
        // The course's own strings win over the site's where both have one.
        for (final section in ['site', 'course'])
          ...?(catalogue[section] as Map?)?.map((k, v) => MapEntry('$k', '$v')),
      };
    } catch (_) {
      _amharic = {};
    }
  }

  String translate(String text, [Map<String, Object?> args = const {}]) {
    var out = lang == 'am' ? (_amharic[text] ?? text) : text;
    args.forEach((name, value) => out = out.replaceAll('{$name}', '$value'));
    return out;
  }
}

/// An interface string in the learner's language: `T('Word {n} of {total}', {'n': 3, 'total': 10})`.
String T(String text, [Map<String, Object?> args = const {}]) => Strings.instance.translate(text, args);
