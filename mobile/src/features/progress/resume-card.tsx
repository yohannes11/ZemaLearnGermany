import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useCourse } from '@/core/course';
import { deviceId, useSyncState } from '@/core/sync/engine';
import { Badge, Card, Icon, ProgressBar, Text } from '@/ui/primitives';
import { space, useColours } from '@/ui/theme';

/**
 * "Continue where you stopped": the exercise left open on this or any other device (the website included), at
 * the exact question. It comes from the account, so it appears here moments after it was left elsewhere.
 */
export function ResumeCard() {
  const c = useColours();
  const { session } = useSyncState();
  const { lesson, bundle, t } = useCourse();
  if (!session || session.done || session.position >= session.items.length || !bundle) return null;

  let title: string | null = null;
  if (session.kind === 'quiz') {
    const found = lesson(session.ref);
    if (found && !found.lesson.custom) title = t(found.lesson.title);
  } else if (session.kind === 'cards') {
    const section = bundle.course.units.flatMap(u => u.sections).find(s => s.key === session.ref);
    title = section ? t(section.title) : session.ref === 'review' ? 'Review' : null;
  }
  if (!title) return null;

  const where = session.device === deviceId() ? 'here' : session.platform === 'web' ? 'on the website' : 'on your other phone';
  const open = () =>
    session.kind === 'quiz'
      ? router.push({ pathname: '/session/quiz', params: { lesson: session.ref, resume: '1' } })
      : router.push({ pathname: '/session/cards', params: { resume: '1' } });

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Card raised accent={c.brand} onPress={open} accessibilityHint="Continues the exercise at the question where you stopped">
        <View style={styles.row}>
          <Badge icon={session.platform === 'web' ? 'monitor-arrow-down' : 'cellphone-arrow-down'} colour={c.brandInk} background={c.brand} />
          <View style={styles.grow}>
            <Text variant="overline" colour="brand">Continue where you stopped {where}</Text>
            <Text variant="subheading">{title}</Text>
            <Text variant="caption" colour="muted">
              {session.kind === 'quiz' ? 'Question' : 'Card'} {session.position + 1} of {session.items.length}
            </Text>
          </View>
          <Icon name="play-circle" size={32} colour={c.brand} />
        </View>
        <ProgressBar value={session.position / session.items.length} colour={c.brand} height={6} />
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, gap: 2 },
});
