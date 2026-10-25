// The chunky controls paint without errors (a rounded box with a differently coloured bottom edge can't be drawn
// as one border).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zema_german/ui/primitives.dart';
import 'package:zema_german/ui/theme.dart';

void main() {
  testWidgets('buttons of every kind paint their label', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildTheme(Brightness.light),
      home: Scaffold(
        body: Column(children: [
          for (final kind in ButtonKind.values) AppButton(label: kind.name, kind: kind, onPressed: () {}),
          const AppButton(label: 'off', kind: ButtonKind.secondary, onPressed: null),
          ChunkyBox(face: Colors.white, base: Colors.grey, edge: Colors.black12, child: const Text('tile')),
        ]),
      ),
    ));
    expect(tester.takeException(), isNull);
    for (final kind in ButtonKind.values) {
      expect(find.text(kind.name), findsOneWidget);
    }
    expect(find.text('tile'), findsOneWidget);
  });
}
