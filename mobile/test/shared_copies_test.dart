// The app's copy of the website's interface text (tool/sync_shared.dart) must be current, or new strings show in
// English in the app though the website has their Amharic.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('assets/locale/am.json is the website\'s web/locale/am.json', () {
    expect(File('assets/locale/am.json').readAsStringSync(), File('../web/locale/am.json').readAsStringSync(),
        reason: 'run: dart run tool/sync_shared.dart');
  });
}
