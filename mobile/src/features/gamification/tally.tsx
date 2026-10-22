import * as Haptics from 'expo-haptics';
import * as tally from '@shared/tally';
import type { Layout, Timeline } from '@shared/tally';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { settings, useSettings } from '@/core/settings';
import { Text } from '@/ui/primitives';
import { useColours, type Colours } from '@/ui/theme';

import { useGame } from './hooks';

/**
 * The stick-strikeout streak tally, drawn from the layout shared with the website (web/static/core/js/tally.js):
 * the same sticks, bundles, colours and timing on both. A day that reached its goal strikes itself out once on
 * this device (also when that happened offline or on another device, the next time the tally is shown).
 */

const AnimatedLine = Animated.createAnimatedComponent(Line);
const ease = Easing.bezier(...tally.MOTION.ease);
const MAX_REMEMBERED = 60;

/** A strikeout; when `fresh` as it first appears, it draws itself (decided once, on mount). */
function Strike({ x1, y1, x2, y2, colour, width, delay, fresh }: { x1: number; y1: number; x2: number; y2: number; colour: string; width: number; delay: number; fresh: boolean }) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const [start] = useState(() => ({ animate: fresh, delay }));
  const drawn = useSharedValue(start.animate ? 0 : 1);
  useEffect(() => {
    if (start.animate) drawn.set(withDelay(start.delay, withTiming(1, { duration: tally.MOTION.strikeMs, easing: ease })));
  }, [start, drawn]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.get()) }));
  return (
    <AnimatedLine x1={x1} y1={y1} x2={x2} y2={y2} stroke={colour} strokeWidth={width} strokeLinecap="round" strokeDasharray={length} animatedProps={props} />
  );
}

/** Today's stick, before the goal: it glows softly to say "this one is waiting for you". */
function TodayGlow({ x, y1, y2, colour, width, still }: { x: number; y1: number; y2: number; colour: string; width: number; still: boolean }) {
  const glow = useSharedValue(0.35);
  useEffect(() => {
    if (!still) glow.set(withRepeat(withSequence(withTiming(0.7, { duration: tally.MOTION.glowMs / 2 }), withTiming(0.2, { duration: tally.MOTION.glowMs / 2 })), -1));
  }, [still, glow]);
  const props = useAnimatedProps(() => ({ strokeOpacity: glow.get() }));
  return <AnimatedLine x1={x} y1={y1} x2={x} y2={y2} stroke={colour} strokeWidth={width * 3} strokeLinecap="round" animatedProps={props} />;
}

function colourOf(c: Colours, name: string) {
  return (c as Record<string, string>)[name] ?? c.text;
}

/** What the tally says, for screen readers (it is a picture otherwise). */
export function describeTally(t: Timeline) {
  const met = t.marks.filter(m => m.state === 'met').length;
  return [
    t.streak > 0 ? `${t.streak}-day streak` : 'No streak yet',
    met ? `daily goal reached on ${met} ${met === 1 ? 'day' : 'days'}` : null,
    t.todayMet ? 'today’s goal reached' : `today ${t.todayXp} of ${t.goal} XP`,
    t.freezes ? `${t.freezes} streak ${t.freezes === 1 ? 'freeze' : 'freezes'}` : null,
    t.broken ? 'the last streak was broken' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

type Props = { size?: 'full' | 'compact'; model?: Timeline; /** Haptics when a strike draws (only one tally on screen should). */ feel?: boolean };

export function Tally({ size = 'full', model, feel = false }: Props) {
  const c = useColours();
  const game = useGame();
  const t = model ?? game.tally;
  const reduced = useReducedMotion();
  const { struck } = useSettings();
  const layout: Layout = useMemo(() => tally.layout(t, size), [t, size]);
  // Strikes this device hasn't drawn yet: they draw now, and are remembered so they draw only once.
  const unseen = layout.strikes.filter(strike => !struck.includes(strike.day)).map(strike => strike.day);
  const unseenKey = unseen.join();

  useEffect(() => {
    if (!unseen.length) return;
    settings.set(({ struck: seen }) => ({ struck: [...new Set([...seen, ...unseen])].slice(-MAX_REMEMBERED) }));
    if (feel && !reduced) {
      const delay = tally.MOTION.strikeMs + (unseen.length - 1) * tally.MOTION.strikeStaggerMs;
      const timer = setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), delay * 0.8);
      return () => clearTimeout(timer);
    }
    // Only when new strikes appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseenKey]);

  const { size: s } = layout;
  let order = 0;
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={describeTally(t)}>
      {layout.hidden > 0 && (
        <Text variant={size === 'compact' ? 'caption' : 'label'} colour="muted" style={styles.hidden}>
          +{layout.hidden}
        </Text>
      )}
      <Svg width={layout.width} height={layout.height}>
        {layout.bands.map(b => (
          <Line key={`band-${b.x1}`} x1={b.x1} y1={b.y} x2={b.x2} y2={b.y} stroke={colourOf(c, tally.COLOURS.band)} strokeWidth={s.stroke} strokeLinecap="round" />
        ))}
        {layout.sticks.map(stick =>
          stick.state === 'today' ? (
            <TodayGlow key={`glow-${stick.day}`} x={stick.x} y1={stick.y1} y2={stick.y2} colour={colourOf(c, tally.COLOURS.today)} width={s.stroke} still={reduced} />
          ) : null,
        )}
        {layout.sticks.map(stick => (
          <Line
            key={stick.day}
            x1={stick.x}
            y1={stick.y1}
            x2={stick.x}
            y2={stick.y2}
            stroke={colourOf(c, stick.state === 'kept' || stick.state === 'met' ? tally.COLOURS.stick : tally.COLOURS[stick.state])}
            strokeWidth={s.stroke}
            strokeLinecap="round"
            strokeDasharray={stick.state === 'missed' ? `${s.stroke} ${s.stroke * 1.4}` : undefined}
          />
        ))}
        {layout.strikes.map(strike => {
          const fresh = !reduced && unseen.includes(strike.day);
          return (
            <Strike
              key={`strike-${strike.day}`}
              {...strike}
              colour={colourOf(c, tally.COLOURS.strike)}
              width={s.strike}
              fresh={fresh}
              delay={fresh ? order++ * tally.MOTION.strikeStaggerMs : 0}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  hidden: { marginRight: 2 },
});
