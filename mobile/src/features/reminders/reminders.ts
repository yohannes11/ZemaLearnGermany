import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { storage } from '@/core/storage';

/**
 * Daily streak reminders, scheduled on the device: they need no server and arrive offline too. Reminders are
 * set for the next week at the learner's chosen time, skipping today once they have practised, and rescheduled
 * whenever the app opens or progress is made.
 */

export type ReminderSettings = { enabled: boolean; hour: number; minute: number };
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 19, minute: 0 };
const DAYS_AHEAD = 7;
const CHANNEL = 'streak';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const reminderSettings = () => storage.get('reminder', DEFAULT_REMINDER);

/** Asks for permission (once) and saves the settings. Returns false when notifications are not allowed. */
export async function saveReminderSettings(settings: ReminderSettings) {
  if (settings.enabled) {
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;
  }
  await storage.set('reminder', settings);
  return true;
}

export async function scheduleReminders(streak: number, practisedToday: boolean) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const settings = await reminderSettings();
  if (!settings.enabled) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Daily practice',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const now = new Date();
  for (let ahead = 0; ahead < DAYS_AHEAD; ahead++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead, settings.hour, settings.minute);
    if (date <= now || (ahead === 0 && practisedToday)) continue;
    // Only the first upcoming reminder can know the streak; later ones invite back without a number.
    const keepStreak = ahead <= 1 && streak > 0;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: keepStreak ? `Keep your ${streak}-day streak` : 'Time for a little German',
        body: keepStreak ? 'Five minutes of German keeps it going.' : 'A few words today make tomorrow easier.',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
    });
  }
}
