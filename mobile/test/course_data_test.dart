// The real course (the same file the website loads) through the app's models and every question builder, in
// English and with Amharic meanings, so no lesson can fail when a learner opens it.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:zema_german/core/api/models.dart';
import 'package:zema_german/core/course.dart';
import 'package:zema_german/features/lessons/questions.dart';

Map<String, dynamic> _script(String path) {
  final source = File(path).readAsStringSync();
  return (jsonDecode(source.substring(source.indexOf('{'), source.lastIndexOf('}') + 1)) as Map).cast();
}

void main() {
  final data = _script('../web/static/course/js/course-data.js');
  final amharic = _script('../web/static/course/js/course-am.js');

  for (final lang in ['en', 'am']) {
    test('every lesson builds its questions ($lang)', () {
      course.bundle = CourseBundle.fromJson({'version': 'test', 'lang': lang, 'course': data, 'amharic': lang == 'am' ? amharic : null, 'texts': {}});
      course.lang = lang;
      final units = course.units;
      expect(units, isNotEmpty);
      var lessons = 0;
      for (final unit in units) {
        expect(unit.words, isNotEmpty, reason: 'unit ${unit.id} has words');
        for (final lesson in unit.grammar) {
          lessons++;
          final questions = switch (lesson.custom) {
            'review' => reviewQuestions(unit),
            null => lessonQuestions(lesson, unit).questions,
            final kind => customQuestions(kind),
          };
          expect(questions, isNotEmpty, reason: lesson.key);
          for (final q in questions) {
            expect(q.answer, isNotEmpty, reason: '${lesson.key}: ${q.prompt}');
            if (q.type == QuestionType.choice) expect(q.options, contains(q.answer), reason: '${lesson.key}: ${q.prompt}');
            if (q.type == QuestionType.order) expect(q.tiles, isNotEmpty, reason: '${lesson.key}: ${q.prompt}');
          }
          if (lesson.custom == 'review') expect(questions.length, 12);
          if (lesson.custom == null) {
            // Every quiz item, not only the 8 drawn, turns into a question.
            final all = lessonQuestions(lesson, unit, List.generate(lesson.quiz.length, (i) => i)).questions;
            expect(all.length, lesson.quiz.length);
          }
        }
      }
      expect(lessons, greaterThan(10));
    });
  }
}
