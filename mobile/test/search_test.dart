// The app's course search against web/apps/course/tests/search_cases.json, the same cases the website's search
// (web/static/course/js/search.js) is checked against, on the real course.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:zema_german/core/api/models.dart';
import 'package:zema_german/features/search/search_engine.dart';

Map<String, dynamic> _script(String path) {
  final source = File(path).readAsStringSync();
  return (jsonDecode(source.substring(source.indexOf('{'), source.lastIndexOf('}') + 1)) as Map).cast();
}

void main() {
  final cases = (jsonDecode(File('../web/apps/course/tests/search_cases.json').readAsStringSync()) as Map).cast<String, dynamic>();
  final bundle = CourseBundle.fromJson({
    'version': 'test',
    'lang': 'am',
    'course': _script('../web/static/course/js/course-data.js'),
    'amharic': _script('../web/static/course/js/course-am.js'),
  });
  final index = SearchIndex(bundle.units, bundle.topics, amharic: bundle.amharic);

  test('spelling', () {
    for (final c in cases['fold'] as List) {
      expect(fold(c[0] as String), c[1], reason: 'fold ${c[0]}');
    }
    for (final c in cases['same_sound'] as List) {
      expect(phonetic(fold(c[0] as String)), phonetic(fold(c[1] as String)), reason: '${c[0]} sounds like ${c[1]}');
    }
    for (final c in cases['transliterate'] as List) {
      expect(transliterate(c[0] as String), c[1], reason: 'transliterate ${c[0]}');
    }
  });

  for (final c in (cases['queries'] as List).cast<Map<String, dynamic>>()) {
    test('search "${c['q']}"${c['filters'] == null ? '' : ' ${c['filters']}'}', () {
      final filters = c['filters'] == null ? const SearchFilters() : SearchFilters.fromJson((c['filters'] as Map).cast());
      final results = index.search(c['q'] as String, filters: filters);
      for (final r in results) {
        expect(
          (filters.types.isEmpty || filters.types.contains(r.type)) &&
              (filters.pos.isEmpty || (r.kind == SearchKind.word && filters.pos.contains(r.pos))) &&
              (filters.unit == null || r.units.contains(filters.unit)) &&
              ((filters.section ?? '').isEmpty || r.sections.contains(filters.section)) &&
              ((filters.level ?? '').isEmpty || r.levels.contains(filters.level)),
          isTrue,
          reason: '${r.kind.name} ${r.id} fits ${c['filters']}',
        );
      }
      final top = [for (final r in results) '${r.kind.name}|${r.id}'];
      final within = (c['within'] as num?)?.toInt() ?? 10;
      if (c['none'] == true) {
        expect(top, isEmpty);
        return;
      }
      if (c['first'] case final List first) expect(top.first, first.join('|'));
      for (final want in (c['expect'] as List? ?? [])) {
        expect(top.take(within), contains((want as List).join('|')));
      }
    });
  }
}
