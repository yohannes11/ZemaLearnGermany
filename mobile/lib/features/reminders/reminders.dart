import 'dart:io';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../../core/storage.dart';

/// Daily streak reminders, scheduled on the phone: they need no server and arrive offline too. Reminders are set
/// for the next week at the learner's chosen time, skipping today once they have practised, and rescheduled
/// whenever the app opens or progress is made.
class ReminderSettings {
  const ReminderSettings({this.enabled = false, this.hour = 19, this.minute = 0});
  final bool enabled;
  final int hour;
  final int minute;

  String get time => '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
}

class Reminders {
  Reminders._();
  static final instance = Reminders._();

  static const _daysAhead = 7;
  final _plugin = FlutterLocalNotificationsPlugin();
  var _ready = false;

  Future<void> _init() async {
    if (_ready) return;
    tzdata.initializeTimeZones();
    try {
      tz.setLocalLocation(tz.getLocation((await FlutterTimezone.getLocalTimezone()).identifier));
    } catch (_) {}
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
      ),
    );
    _ready = true;
  }

  ReminderSettings get settings {
    final saved = Storage.instance.read<Map<String, dynamic>>('reminder', {});
    return ReminderSettings(
      enabled: saved['enabled'] as bool? ?? false,
      hour: (saved['hour'] as num?)?.toInt() ?? 19,
      minute: (saved['minute'] as num?)?.toInt() ?? 0,
    );
  }

  /// Asks for permission (once) and saves the settings. Returns false when notifications are not allowed.
  Future<bool> save(ReminderSettings next) async {
    await _init();
    if (next.enabled) {
      final granted = Platform.isAndroid
          ? await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission()
          : await _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()?.requestPermissions(alert: true, sound: true);
      if (granted == false) return false;
    }
    await Storage.instance.write('reminder', {'enabled': next.enabled, 'hour': next.hour, 'minute': next.minute});
    return true;
  }

  Future<void> schedule(int streak, bool practisedToday) async {
    try {
      await _init();
      await _plugin.cancelAll();
      final s = settings;
      if (!s.enabled) return;
      final now = tz.TZDateTime.now(tz.local);
      for (var ahead = 0; ahead < _daysAhead; ahead++) {
        final date = tz.TZDateTime(tz.local, now.year, now.month, now.day + ahead, s.hour, s.minute);
        if (!date.isAfter(now) || (ahead == 0 && practisedToday)) continue;
        // Only the first upcoming reminder can know the streak; later ones invite back without a number.
        final keepStreak = ahead <= 1 && streak > 0;
        await _plugin.zonedSchedule(
          id: ahead,
          scheduledDate: date,
          title: keepStreak ? 'Keep your $streak-day streak' : 'Time for a little German',
          body: keepStreak ? 'Five minutes of German keeps it going.' : 'A few words today make tomorrow easier.',
          notificationDetails: const NotificationDetails(
            android: AndroidNotificationDetails('streak', 'Daily practice', importance: Importance.defaultImportance),
            iOS: DarwinNotificationDetails(),
          ),
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        );
      }
    } catch (_) {
      // Reminders are a help, never a reason for the app to fail.
    }
  }
}

final reminders = Reminders.instance;
