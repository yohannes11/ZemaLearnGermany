// Clocks for every time the course teaches: the app reads them from the course (web/tools/clock_pictures.py)
// and a time-telling question carries the clock of its question.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:zema_german/core/api/models.dart';
import 'package:zema_german/core/course.dart';
import 'package:zema_german/features/lessons/questions.dart';
import 'package:zema_german/features/vocabulary/word_picture.dart';

Map<String, dynamic> _script(String path) {
  final source = File(path).readAsStringSync();
  return (jsonDecode(source.substring(source.indexOf('{'), source.lastIndexOf('}') + 1)) as Map).cast();
}

void main() {
  course.bundle = CourseBundle.fromJson({'version': 'test', 'lang': 'en', 'course': _script('../web/static/course/js/course-data.js'), 'texts': {}});
  course.lang = 'en';

  test('a German time has its clock at the exact hour', () {
    expect(course.clocksFor('Es ist fünf vor halb zehn.'), ['9:25']);
    expect(course.clocksFor('von 9 bis 17 Uhr'), ['9:00', '17:00']);
    expect(course.clocksFor('Hallo!'), isEmpty);
    expect(ClockPictures.code('9:25'), 'clock-0925');
    expect(ClockPictures.code('17:00'), 'clock-1700');
    for (final times in course.bundle!.clocks.values) {
      for (final time in times) {
        expect(File('../web/static/course/pics/${ClockPictures.code(time)}.svg').existsSync(), isTrue, reason: time);
      }
    }
  });

  test('a time-telling question shows its clock', () {
    final unit = course.unit(5)!;
    final lesson = unit.grammar.firstWhere((g) => g.key == 'g5-time');
    final questions = [for (final item in lesson.quiz) fromItem(item, unit)];
    final half = questions.firstWhere((q) => q.before == '9:30 → Es ist ');
    expect(half.clocks, ['9:30']);
  });
}
