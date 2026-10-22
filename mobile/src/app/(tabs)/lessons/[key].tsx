import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiUrl } from '@/core/config';
import { useCourse } from '@/core/course';
import { kindName, PASS_MARK, QUIZ_SIZE, scoredInApp } from '@/features/lessons/kinds';
import { LessonContent } from '@/features/lessons/lesson-content';
import { useProgress } from '@/features/progress/store';
import { useSyncState } from '@/core/sync/engine';
import { Button, Card, Text } from '@/ui/primitives';
import { space, useColours } from '@/ui/theme';

/** A lesson: its explanation to read, then its exercise, always one tap away at the bottom. */
export default function LessonScreen() {
  const c = useColours();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { lesson: findLesson, t } = useCourse();
  const { grammar } = useProgress();
  const { session } = useSyncState();
  const found = findLesson(key);

  if (!found) {
    return (
      <View style={[styles.empty, { backgroundColor: c.bg }]}>
        <Text>This lesson is no longer in the course.</Text>
        <Button label="Back to Lessons" kind="secondary" onPress={() => router.back()} />
      </View>
    );
  }
  const { lesson, unit } = found;
  const name = kindName(lesson, unit, t);
  const best = grammar[lesson.key];
  const inApp = scoredInApp(lesson);
  // This lesson's exercise left open here or on another device: continue it at that question.
  const open = session && session.kind === 'quiz' && session.ref === lesson.key && !session.done && session.position < session.items.length ? session : null;

  return (
    // No bottom inset: the tab bar below already keeps clear of the system bar.
    <SafeAreaView edges={[]} style={[styles.page, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: name }} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <Text variant="overline" colour="brand">{t(unit.label ?? `Unit ${unit.id}`)} · {name}</Text>
        <Text variant="title">{t(lesson.title)}</Text>
        {best !== undefined && <Text variant="caption" colour="muted">Best score: {best} · {PASS_MARK} of {QUIZ_SIZE} completes it</Text>}
        <LessonContent lesson={lesson} />
        {lesson.custom ? (
          <Card>
            <Text variant="subheading">On the website for now</Text>
            <Text variant="caption" colour="muted">This exercise is built by the web course. Your score there syncs back to the app.</Text>
            <Button label="Open the web course" kind="secondary" icon="open-in-new" onPress={() => WebBrowser.openBrowserAsync(`${apiUrl()}/learn/`)} />
          </Card>
        ) : null}
      </ScrollView>
      {inApp && (
        <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.border }]}>
          {open && (
            <Button
              label={`Continue · question ${open.position + 1} of ${open.items.length}`}
              icon="play-circle"
              kind="gold"
              onPress={() => router.push({ pathname: '/session/quiz', params: { lesson: lesson.key, resume: '1' } })}
            />
          )}
          <Button
            label={open ? 'Start over' : `Start exercise · ${Math.min(QUIZ_SIZE, lesson.quiz?.items.length ?? 0)} questions`}
            icon={open ? 'restart' : 'play'}
            kind={open ? 'secondary' : 'primary'}
            onPress={() => router.push({ pathname: '/session/quiz', params: { lesson: lesson.key } })}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl, maxWidth: 720, width: '100%', alignSelf: 'center' },
  footer: { padding: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
});
