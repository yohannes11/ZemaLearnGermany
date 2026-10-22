import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useCourse } from '@/core/course';
import { useSession } from '@/core/session';
import { GoalRing } from '@/features/gamification/goal-ring';
import { useGame } from '@/features/gamification/hooks';
import { StatChips } from '@/features/gamification/stat-chips';
import { Tally } from '@/features/gamification/tally';
import { CourseMap } from '@/features/progress/course-map';
import { nextLesson, nextSection } from '@/features/progress/next-steps';
import { ResumeCard } from '@/features/progress/resume-card';
import { useProgress } from '@/features/progress/store';
import { dueWords, useSrs } from '@/features/vocabulary/srs';
import { CourseGate } from '@/ui/course-gate';
import { Badge, Button, Card, Icon, ProgressBar, SectionHeader, Text } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { space, useColours } from '@/ui/theme';

function greeting() {
  const hour = new Date().getHours();
  return hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
}

function Home() {
  const c = useColours();
  const { bundle, t } = useCourse();
  const { user } = useSession();
  const { learned, grammar } = useProgress();
  const { words } = useSrs();
  const game = useGame();
  if (!bundle) return null;

  const section = nextSection(bundle.course, learned);
  const lesson = nextLesson(bundle.course, grammar);
  const due = dueWords(bundle.course, learned, words).length;
  const goalMet = game.todayXp >= game.dailyGoal;

  return (
    <Screen>
      {/* The course as a map across the top of Home, as on the website: tap a town to open its unit. */}
      <CourseMap />

      <View style={styles.header}>
        <Text variant="title">{user ? `${greeting()}, ${user.name.split(' ')[0]}!` : `${greeting()}!`}</Text>
        <StatChips />
      </View>

      <Animated.View entering={FadeInDown.duration(300)}>
        <Card raised style={styles.goal}>
          <View style={styles.goalTop}>
            <GoalRing value={game.todayXp / game.dailyGoal} size={92}>
              <Icon name={goalMet ? 'check-bold' : 'lightning-bolt'} size={30} colour={c.xp} />
            </GoalRing>
            <View style={styles.grow}>
              <Text variant="overline" colour="muted">Today</Text>
              <Text variant="heading">{goalMet ? 'Daily goal reached!' : `${game.todayXp} of ${game.dailyGoal} XP`}</Text>
              <Text variant="caption" colour="muted">
                {goalMet
                  ? `Today is struck off. ${game.streak}-day streak.`
                  : game.practisedToday
                    ? `${game.dailyGoal - game.todayXp} XP more strikes off today.`
                    : game.streak > 0
                      ? `Practise today to keep your ${game.streak}-day streak.`
                      : game.tally.broken
                        ? 'Your streak was reset. Start a new one today.'
                        : 'Earn some XP to start a streak.'}
              </Text>
            </View>
          </View>
          <View style={styles.tallyRow}>
            <Tally feel />
            {game.freezes > 0 && (
              <View style={[styles.freeze, { backgroundColor: c.surface2 }]} accessible accessibilityLabel={`${game.freezes} streak ${game.freezes === 1 ? 'freeze' : 'freezes'}: a missed day won't break your streak`}>
                <Icon name="snowflake" size={16} colour={c.freeze} />
                <Text variant="label" style={{ color: c.freeze }}>{game.freezes}</Text>
              </View>
            )}
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(300)}>
        <Card style={styles.level}>
          <Badge icon="shield-star" colour={c.brandInk} background={c.brand} />
          <View style={styles.grow}>
            <View style={styles.between}>
              <Text variant="subheading">Level {game.level.level}</Text>
              <Text variant="caption" colour="muted">{game.level.toNext} XP to level {game.level.level + 1}</Text>
            </View>
            <ProgressBar value={game.level.share} colour={c.brand} />
          </View>
        </Card>
      </Animated.View>

      <SectionHeader title="Continue" />

      <ResumeCard />

      {due > 0 && (
        <Animated.View entering={FadeInDown.delay(140).duration(300)}>
          <Card accent={c.goldBright} onPress={() => router.push({ pathname: '/session/cards', params: { review: '1' } })} accessibilityHint="Starts a review session">
            <View style={styles.row}>
              <Badge icon="brain" colour={c.xp} background={c.goldSoft} />
              <View style={styles.grow}>
                <Text variant="overline" colour="xp">Review</Text>
                <Text variant="subheading">{due} {due === 1 ? 'word is' : 'words are'} due</Text>
                <Text variant="caption" colour="muted">Review now, before they fade.</Text>
              </View>
              <Icon name="chevron-right" colour={c.subtle} />
            </View>
          </Card>
        </Animated.View>
      )}

      {section && (
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Card accent={c.goldBright} onPress={() => router.push({ pathname: '/session/cards', params: { section: section.section.key } })} accessibilityHint="Starts flashcards">
            <View style={styles.row}>
              <Badge icon="cards-outline" colour={c.xp} background={c.goldSoft} />
              <View style={styles.grow}>
                <Text variant="overline" colour="xp">New words · {t(section.unit.label ?? `Unit ${section.unit.id}`)}</Text>
                <Text variant="subheading">{t(section.section.title)}</Text>
                <Text variant="caption" colour="muted">{section.left} words to learn</Text>
              </View>
              <Icon name="chevron-right" colour={c.subtle} />
            </View>
          </Card>
        </Animated.View>
      )}

      {lesson && (
        <Animated.View entering={FadeInDown.delay(260).duration(300)}>
          <Card accent={c.brand} onPress={() => router.push({ pathname: '/lessons/[key]', params: { key: lesson.lesson.key } })} accessibilityHint="Opens the lesson">
            <View style={styles.row}>
              <Badge icon="school-outline" colour={c.brand} background={c.brandSoft} />
              <View style={styles.grow}>
                <Text variant="overline" colour="brand">Next lesson · {t(lesson.unit.label ?? `Unit ${lesson.unit.id}`)}</Text>
                <Text variant="subheading">{t(lesson.lesson.title)}</Text>
              </View>
              <Icon name="chevron-right" colour={c.subtle} />
            </View>
          </Card>
        </Animated.View>
      )}

      {!user && (
        <Card>
          <Text variant="subheading">Keep your streak on every device</Text>
          <Text variant="caption" colour="muted">A free account saves your words, scores and XP, here and on the website.</Text>
          <Button label="Sign in or sign up" kind="secondary" icon="account-plus-outline" onPress={() => router.push('/sign-in')} />
        </Card>
      )}
    </Screen>
  );
}

export default function HomeScreen() {
  return (
    <CourseGate>
      <Home />
    </CourseGate>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md },
  goal: { gap: space.md },
  tallyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  freeze: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: 999 },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  level: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.xs, flexWrap: 'wrap', gap: space.xs },
  grow: { flex: 1, gap: 2 },
});
