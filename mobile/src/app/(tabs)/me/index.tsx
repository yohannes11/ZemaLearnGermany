import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import * as WebBrowser from 'expo-web-browser';

import { api, ApiError } from '@/core/api/client';
import { apiUrl, builtInApiUrl, isTestBuild } from '@/core/config';
import { useCourse, type Lang } from '@/core/course';
import { deleteDownloads, downloadedBytes, reloadAudio, type Voice } from '@/core/offline/audio';
import { useSession } from '@/core/session';
import { settings, useSettings } from '@/core/settings';
import { flush, startSync, useSyncStatus } from '@/core/sync/engine';
import { useGame } from '@/features/gamification/hooks';
import { Tally } from '@/features/gamification/tally';
import { DAILY_GOALS } from '@/features/gamification/xp';
import { PASS_MARK } from '@/features/lessons/kinds';
import { setDailyGoal, useProgress } from '@/features/progress/store';
import { reminderSettings, saveReminderSettings, scheduleReminders, type ReminderSettings } from '@/features/reminders/reminders';
import { Badge, Button, Card, Icon, Text, type IconName } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, space, type, useColours, useRipple } from '@/ui/theme';

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  const c = useColours();
  const rippleConfig = useRipple();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segment, { backgroundColor: c.surface2 }]}>
      {options.map(([option, name]) => (
        <Pressable
          key={String(option)}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === option }}
          onPress={() => {
            void Haptics.selectionAsync();
            onChange(option);
          }}
          android_ripple={rippleConfig}
          style={[styles.segmentItem, value === option && { backgroundColor: c.surface }]}>
          <Text variant={value === option ? 'label' : 'caption'} colour={value === option ? 'text' : 'muted'} style={styles.centre}>{name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Stat({ icon, colour, value, label }: { icon: IconName; colour: string; value: string | number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} colour={colour} />
      <Text variant="heading">{value}</Text>
      <Text variant="caption" colour="muted">{label}</Text>
    </View>
  );
}

function Setting({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return (
    <View style={styles.setting}>
      <Text variant="subheading">{title}</Text>
      {detail ? <Text variant="caption" colour="muted">{detail}</Text> : null}
      {children}
    </View>
  );
}

/** Where the learner's progress stands: synced, waiting to sync, or saved on the phone while offline. */
function SyncLine() {
  const c = useColours();
  const { pending, lastSync, online, syncing } = useSyncStatus();
  // "n min ago" moves on by itself.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const ago = lastSync ? Math.max(0, Math.round((now - lastSync) / 60_000)) : null;
  const text = syncing
    ? 'Syncing…'
    : !online && pending
      ? `Offline · ${pending} ${pending === 1 ? 'change' : 'changes'} saved on this phone, sent when you are back online`
      : pending
        ? `${pending} ${pending === 1 ? 'change' : 'changes'} waiting to sync`
        : ago === null
          ? 'Not synced yet'
          : `Synced with your account ${ago < 1 ? 'just now' : `${ago} min ago`}`;
  const ok = !pending && online && !syncing;
  return (
    <Pressable accessibilityRole="button" accessibilityHint="Syncs now" onPress={() => void flush()} style={[styles.sync, { backgroundColor: ok ? c.greenSoft : c.surface2 }]}>
      <Icon name={!online ? 'cloud-off-outline' : ok ? 'cloud-check-outline' : 'cloud-sync-outline'} size={18} colour={ok ? c.green : c.muted} />
      <Text variant="caption" colour={ok ? 'green' : 'muted'} style={styles.grow}>{text}</Text>
    </Pressable>
  );
}

/**
 * Test builds talk to a computer on the local network, whose address can change (another Wi-Fi, a router restart).
 * Then nothing loads and recordings stay silent; this sets the new address without building the app again.
 */
function TestServer() {
  const c = useColours();
  const { serverUrl } = useSettings();
  const { refresh } = useCourse();
  const { user } = useSession();
  const [draft, setDraft] = useState(serverUrl || builtInApiUrl);
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  const save = async () => {
    const url = draft.trim().replace(/\/$/, '');
    settings.set({ serverUrl: url === builtInApiUrl ? '' : url });
    setStatus('checking');
    try {
      await api.index();
      setStatus('ok');
      void reloadAudio();
      void refresh();
      if (user) void startSync();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      setStatus('fail');
    }
  };

  return (
    <Card>
      <Text variant="subheading">Test server</Text>
      <Text variant="caption" colour="muted">
        This test build gets its course, recordings and progress from a computer on your Wi-Fi. If that computer has a new
        address, enter it here.
      </Text>
      <TextInput
        accessibilityLabel="Server address"
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://192.168.1.4:8000"
        placeholderTextColor={c.subtle}
        style={[styles.input, type.body, { color: c.text, backgroundColor: c.surface, borderColor: c.borderStrong }]}
      />
      {status !== 'idle' && (
        <Text variant="caption" colour={status === 'ok' ? 'green' : status === 'fail' ? 'red' : 'muted'} accessibilityLiveRegion="polite">
          {status === 'checking' ? 'Checking…' : status === 'ok' ? 'Connected. Course and recordings come from here now.' : 'No answer from that address. Is the server running, on the same Wi-Fi?'}
        </Text>
      )}
      <Button label="Save and connect" kind="secondary" icon="lan-connect" onPress={() => void save()} busy={status === 'checking'} />
    </Card>
  );
}

/** The website, already signed in as this learner (a link that works once, for two minutes). */
async function openWebsite() {
  try {
    const { url } = await api.webSessionLink('/learn/');
    await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    await WebBrowser.openBrowserAsync(`${apiUrl()}/learn/`);
  }
}

export default function MeScreen() {
  const c = useColours();
  const { user, signOut } = useSession();
  const { lang, setLang } = useCourse();
  const { voice } = useSettings();
  const { learned, grammar } = useProgress();
  const game = useGame();
  const [reminder, setReminder] = useState<ReminderSettings | null>(null);
  const [saved, setSaved] = useState(downloadedBytes);
  useEffect(() => void reminderSettings().then(setReminder), []);

  const toggleReminder = async (enabled: boolean) => {
    if (!reminder) return;
    const next = { ...reminder, enabled };
    if (!(await saveReminderSettings(next))) {
      Alert.alert('Notifications are off', 'Allow notifications for Zema German in your phone settings to get reminders.');
      return;
    }
    setReminder(next);
    await scheduleReminders(game.streak, game.practisedToday);
  };

  return (
    <Screen edges={[]}>

      <Card raised>
        <View style={styles.row}>
          <Badge icon={user ? 'account' : 'account-outline'} colour={c.brandInk} background={c.brand} size={52} />
          <View style={styles.grow}>
            <Text variant="heading">{user ? user.name : 'Guest learner'}</Text>
            <Text variant="caption" colour="muted">{user ? `@${user.username} · syncs with the website` : 'Progress is saved on this phone only'}</Text>
          </View>
        </View>
        {user && <SyncLine />}
        {user && <Button label="Open the website, signed in" kind="secondary" icon="open-in-new" onPress={openWebsite} />}
        {user ? (
          <Button label="Sign out" kind="ghost" icon="logout" onPress={signOut} />
        ) : (
          <Button label="Sign in or create an account" icon="account-plus-outline" onPress={() => router.push('/sign-in')} />
        )}
      </Card>

      <Card style={styles.stats}>
        <View style={styles.stat} accessible accessibilityLabel={`${game.streak}-day streak`}>
          <Tally size="compact" />
          <Text variant="heading">{game.streak}</Text>
          <Text variant="caption" colour="muted">day streak</Text>
        </View>
        <Stat icon="lightning-bolt" colour={c.xp} value={game.totalXp} label="total XP" />
        <Stat icon="cards-outline" colour={c.goldBright} value={learned.length} label="words" />
        <Stat icon="school-outline" colour={c.brand} value={Object.values(grammar).filter(s => s >= PASS_MARK).length} label="lessons" />
      </Card>

      <Card>
        <Setting title="Daily goal" detail={DAILY_GOALS.find(g => g.xp === game.dailyGoal)?.time ?? `${game.dailyGoal} XP a day`}>
          <Segmented label="Daily goal" value={game.dailyGoal} options={DAILY_GOALS.map(g => [g.xp, g.name] as [number, string])} onChange={setDailyGoal} />
        </Setting>
        <Setting title="Explanations in">
          <Segmented<Lang> label="Explanations in" value={lang} options={[['en', 'English'], ['am', 'አማርኛ']]} onChange={setLang} />
        </Setting>
        <Setting title="Voice">
          <Segmented<Voice> label="Voice" value={voice} options={[['katja', 'Selam'], ['conrad', 'Dawit']]} onChange={v => settings.set({ voice: v })} />
        </Setting>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.grow}>
            <Text variant="subheading">Daily reminder</Text>
            <Text variant="caption" colour="muted">
              {reminder ? `${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')}` : ''} · not on days you have practised
            </Text>
          </View>
          <Switch accessibilityLabel="Daily reminder" value={!!reminder?.enabled} onValueChange={toggleReminder} trackColor={{ true: c.brand, false: c.surface2 }} />
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Offline recordings</Text>
        <Text variant="caption" colour="muted">{(saved / 1024 / 1024).toFixed(1)} MB on this phone. Save a unit from any of its word lists.</Text>
        {saved > 0 && (
          <Button
            label="Delete saved recordings"
            kind="danger"
            icon="delete-outline"
            onPress={() => {
              deleteDownloads();
              setSaved(0);
            }}
          />
        )}
      </Card>

      {isTestBuild && <TestServer />}

      <Button label="Watch the introduction again" kind="ghost" icon="play-circle-outline" onPress={() => settings.set({ onboarded: false })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, gap: 2 },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  setting: { gap: space.sm, marginBottom: space.sm },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: space.xs, gap: space.xs },
  segmentItem: { flex: 1, borderRadius: radius.sm, paddingVertical: space.sm, minHeight: 40, justifyContent: 'center', overflow: 'hidden' },
  centre: { textAlign: 'center' },
  sync: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md },
  input: { minHeight: 48, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.md },
});
