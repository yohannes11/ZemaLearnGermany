// Unit, section and lesson titles show in Amharic in the app, from the website's catalogue (as on the website).
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:zema_german/core/api/models.dart';
import 'package:zema_german/core/course.dart';
import 'package:zema_german/core/i18n.dart';

Map<String, dynamic> _script(String path) {
  final source = File(path).readAsStringSync();
  return (jsonDecode(source.substring(source.indexOf('{'), source.lastIndexOf('}') + 1)) as Map).cast();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('every title has an Amharic version', () async {
    await Strings.instance.load();
    course.bundle = CourseBundle.fromJson({
      'version': 'test',
      'lang': 'am',
      'course': _script('../web/static/course/js/course-data.js'),
      'amharic': _script('../web/static/course/js/course-am.js'),
      'texts': {},
    });
    course.lang = 'am';
    Strings.instance.lang = 'am';
    final section = course.section('1.2')!.section;
    expect(section.title, 'Introducing each other');
    expect(course.t(section.title), 'እርስ በርስ መተዋወቅ');
    final untranslated = [
      for (final u in course.units) ...[
        u.title,
        for (final s in u.sections) s.title,
        for (final g in u.grammar) g.title,
      ],
    ].where((title) => course.t(title) == title).toList();
    expect(untranslated, isEmpty);
  });
}
