import 'package:flutter/foundation.dart';

import 'storage.dart';

enum Voice { katja, conrad }

enum Speed { slow, normal, natural }

enum Appearance { system, light, dark }

/// The learner's settings on this phone, saved on every change. Widgets listen to [settings] to redraw.
class Settings extends ChangeNotifier {
  /// Set once the first-run introduction is finished or skipped.
  bool onboarded = false;

  /// Days whose strikeout this device has already animated, so each strike draws itself once (newest last).
  List<String> struck = [];

  Voice voice = Voice.katja;
  Speed speed = Speed.normal;
  Appearance appearance = Appearance.system;

  /// Flashcards and typed practice: which way round ("de-en", "en-de" or "mixed").
  String cardDirection = 'de-en';
  String practiceDirection = 'de-en';

  /// Milestones this device has seen earned; they stay earned when a streak later breaks.
  List<String> badges = [];

  /// Test builds only: the server address, when the computer running it got a new one. Empty: the built-in one.
  String serverUrl = '';

  void load() {
    final saved = Storage.instance.read<Map<String, dynamic>>('settings', {});
    onboarded = saved['onboarded'] as bool? ?? false;
    struck = [...?(saved['struck'] as List?)?.cast<String>()];
    voice = Voice.values.asNameMap()[saved['voice']] ?? Voice.katja;
    speed = Speed.values.asNameMap()[saved['speed']] ?? Speed.normal;
    appearance = Appearance.values.asNameMap()[saved['appearance']] ?? Appearance.system;
    cardDirection = saved['cardDirection'] as String? ?? 'de-en';
    practiceDirection = saved['practiceDirection'] as String? ?? 'de-en';
    badges = [...?(saved['badges'] as List?)?.cast<String>()];
    serverUrl = saved['serverUrl'] as String? ?? '';
  }

  /// Changes settings and saves them: `settings.update(() => settings.voice = Voice.conrad)`.
  void update(VoidCallback change) {
    change();
    notifyListeners();
    Storage.instance.write('settings', {
      'onboarded': onboarded,
      'struck': struck,
      'voice': voice.name,
      'speed': speed.name,
      'appearance': appearance.name,
      'cardDirection': cardDirection,
      'practiceDirection': practiceDirection,
      'badges': badges,
      'serverUrl': serverUrl,
    });
  }
}

final settings = Settings();
