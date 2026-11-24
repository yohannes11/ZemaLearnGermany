// The dictionary card's lookup (press and hold a word): the same words the website's select-to-look-up finds,
// on the real course with Amharic meanings.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zema_german/core/api/models.dart';
import 'package:zema_german/core/course.dart';
import 'package:zema_german/features/vocabulary/dictionary.dart';
import 'package:zema_german/features/vocabulary/word_widgets.dart';

Map<String, dynamic> _script(String path) {
  final source = File(path).readAsStringSync();
  return (jsonDecode(source.substring(source.indexOf('{'), source.lastIndexOf('}') + 1)) as Map).cast();
}

void main() {
  course.bundle = CourseBundle.fromJson({
    'version': 'test',
    'lang': 'am',
    'course': _script('../web/static/course/js/course-data.js'),
    'amharic': _script('../web/static/course/js/course-am.js'),
    'texts': {},
  });
  course.lang = 'am';
  final dictionary = Dictionary.instance;

  test('a noun, with or without its article, has its gender and both meanings', () {
    for (final text in ['Kaffee', 'der Kaffee', 'den Kaffee', 'Kaffee.']) {
      final entry = dictionary.find(text);
      expect(entry?.german, 'der Kaffee', reason: text);
      expect(entry?.gender, NounGender.der);
      expect(entry?.english, 'the coffee (m.)');
      expect(entry?.amharic, 'ቡና');
    }
  });

  test('a verb is found from the form in a sentence', () {
    expect(dictionary.find('trinke')?.german, 'trinken');
    expect(dictionary.find('trinke')?.gender, isNull);
  });

  test('words the course does not have, and English, are not found', () {
    expect(dictionary.find('coffee'), isNull);
    expect(dictionary.find(''), isNull);
  });

  testWidgets('pressing and holding a German word opens its dictionary card', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: Center(child: WordLookup(child: Text('Ich trinke Kaffee.'))))));
    await tester.longPressAt(tester.getTopRight(find.text('Ich trinke Kaffee.')) + const Offset(-30, 8));
    await tester.pumpAndSettle();
    expect(find.text('der Kaffee'), findsOneWidget);
    expect(find.text('ቡና'), findsOneWidget);
    expect(find.text('the coffee (m.)'), findsOneWidget);
  });
}
