import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Icon, Text, type IconName } from '@/ui/primitives';
import { duration, radius, space, useColours } from '@/ui/theme';

import { Confetti } from './confetti';
import { GoalRing } from './goal-ring';
import { useGame } from './hooks';
import { Tally } from './tally';

type Stat = { icon: IconName; label: string; value: string | number };

type Props = {
  title: string;
  message: string;
  xpGained: number;
  /** The level before this session, to announce a level-up. */
  levelBefore: number;
  stats: Stat[];
  /** A celebration only for a real success; a tough session gets encouragement without confetti. */
  success: boolean;
  onContinue: () => void;
};

/** Counts up to `target` over the celebration's length, so XP visibly lands. */
function useCountUp(target: number) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration.celebrate);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);
  return value;
}

/** The end of every session: what was earned, the streak, the goal, and a level-up when it happens. */
export function Celebration({ title, message, xpGained, levelBefore, stats, success, onContinue }: Props) {
  const c = useColours();
  const game = useGame();
  const shownXp = useCountUp(xpGained);
  const levelledUp = game.level.level > levelBefore;

  useEffect(() => {
    void Haptics.notificationAsync(success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  }, [success]);

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: c.bg }]}>
      <Confetti play={success} />
      <View style={styles.body}>
        <Animated.View entering={ZoomIn.springify().damping(14)}>
          <Badge icon={success ? 'trophy' : 'arm-flex'} colour={success ? c.xp : c.brand} background={success ? c.goldSoft : c.brandSoft} size={112} />
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(120)} style={styles.centre}>
          <Text variant="title" style={styles.centreText}>{title}</Text>
          <Text colour="muted" style={styles.centreText}>{message}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(240)} style={[styles.xp, { backgroundColor: c.goldSoft }]}>
          <Icon name="lightning-bolt" size={28} colour={c.xp} />
          <Text variant="title" style={{ color: c.xp }} accessibilityLabel={`${xpGained} XP earned`}>+{shownXp} XP</Text>
        </Animated.View>

        {levelledUp && (
          <Animated.View entering={ZoomIn.delay(500)} style={[styles.banner, { backgroundColor: c.brand }]}>
            <Icon name="shield-star" colour={c.brandInk} />
            <Text variant="subheading" style={{ color: c.brandInk }}>Level {game.level.level} reached!</Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(360)} style={styles.stats}>
          {stats.map(stat => (
            <View key={stat.label} style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]} accessible accessibilityLabel={`${stat.label}: ${stat.value}`}>
              <Icon name={stat.icon} colour={c.brand} />
              <Text variant="heading">{stat.value}</Text>
              <Text variant="caption" colour="muted">{stat.label}</Text>
            </View>
          ))}
          <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]} accessible accessibilityLabel={`Daily goal: ${game.todayXp} of ${game.dailyGoal} XP`}>
            <GoalRing value={game.todayXp / game.dailyGoal} size={44} stroke={6} />
            <Text variant="label">{Math.min(game.todayXp, game.dailyGoal)}/{game.dailyGoal}</Text>
            <Text variant="caption" colour="muted">daily goal</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(480)} style={styles.streak}>
          <Tally feel />
          <Text variant="label" colour={game.tally.todayMet ? 'flame' : 'muted'}>
            {game.tally.todayMet ? `Today struck off · ${game.streak}-day streak` : `${game.streak}-day streak`}
          </Text>
        </Animated.View>
      </View>
      <Button label="Continue" onPress={onContinue} style={styles.button} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: space.md },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  centre: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  centreText: { textAlign: 'center' },
  xp: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  stats: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', gap: space.xs, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  streak: { alignItems: 'center', gap: space.xs },
  button: { alignSelf: 'stretch' },
});
