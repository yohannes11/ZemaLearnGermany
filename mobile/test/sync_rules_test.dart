// The app's sync rules against the cases the server is tested with (web/apps/course/tests/sync_cases.json).
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:zema_german/core/sync/rules.dart';

/// Like the server: operations arrive in batches, each id applies once, a batch is applied oldest first.
SyncState arrive(List<List<Op>> batches) {
  final seen = <String>{};
  var state = SyncState.empty;
  for (final batch in batches) {
    final fresh = [for (final op in batch) if (seen.add(op['id'] as String)) op]..sort(compareOps);
    for (final op in fresh) {
      state = apply(state, op);
    }
  }
  return state;
}

void main() {
  final cases = (jsonDecode(File('../web/apps/course/tests/sync_cases.json').readAsStringSync()) as Map)['cases'] as List;

  for (final c in cases.cast<Map<String, dynamic>>()) {
    test(c['name'], () {
      final batches = [for (final b in c['arrivals'] as List) [for (final op in b as List) (op as Map).cast<String, dynamic>()]];
      final state = arrive(batches);
      (c['expect'] as Map<String, dynamic>).forEach((field, expected) {
        final actual = switch (field) {
          'learned' => [...state.learned]..sort(),
          'goals' => [for (final g in state.goals) [g.day, g.xp]],
          'srs' => {for (final e in state.srs.entries) e.key: {'box': e.value.box, 'due': e.value.due}},
          'session' => state.session == null
              ? null
              : ({...state.session!}
                ..remove('at')
                ..remove('id')
                ..putIfAbsent('device', () => '')),
          'xp' => state.xp,
          'days' => state.days,
          'grammar' => state.grammar,
          _ => throw StateError('unknown field $field'),
        };
        final want = field == 'learned' ? ([...(expected as List)]..sort()) : expected;
        expect(actual, want, reason: field);
      });
    });
  }

  test('every case file case ran', () => expect(cases, isNotEmpty));
}
