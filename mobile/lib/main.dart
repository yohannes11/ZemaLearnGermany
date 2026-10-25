import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'core/course.dart';
import 'core/i18n.dart';
import 'core/offline/audio.dart';
import 'core/session.dart';
import 'core/settings.dart';
import 'core/storage.dart';
import 'core/sync/engine.dart';
import 'features/gamification/game.dart';
import 'features/reminders/reminders.dart';
import 'router.dart';
import 'ui/theme.dart';

/// Everything saved on the phone loads before the first screen (no flash of an empty app); then the server is only
/// asked what changed.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  await Storage.init();
  await Strings.instance.load();
  settings.load();
  sync.load();
  course.load();
  await session.load();
  audio.load();
  _keepRemindersInStep();
  runApp(const ZemaApp());
}

/// The streak reminders follow practice: none today once the learner has practised.
void _keepRemindersInStep() {
  (int, bool)? last;
  void update() {
    final game = Game.current;
    final now = (game.streak, game.practisedToday);
    if (now == last) return;
    last = now;
    reminders.schedule(game.streak, game.practisedToday);
  }

  sync.addListener(update);
  update();
}

class ZemaApp extends StatelessWidget {
  const ZemaApp({super.key});

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: settings,
        builder: (context, _) => MaterialApp.router(
          title: 'Zema German',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: themeMode(settings.appearance),
          routerConfig: router,
        ),
      );
}
