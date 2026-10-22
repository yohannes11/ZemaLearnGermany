import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { duration, useColours } from '@/ui/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring that fills as today's XP approaches the daily goal; anything can sit in its middle. */
export function GoalRing({ value, size = 96, stroke = 10, colour, children }: { value: number; size?: number; stroke?: number; colour?: string; children?: ReactNode }) {
  const c = useColours();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const share = Math.min(1, Math.max(0, value));
  const progress = useSharedValue(0);
  useEffect(() => progress.set(withTiming(share, { duration: duration.celebrate })), [share, progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.get()) }));
  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surface2} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colour ?? c.xp}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={props}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ centre: { alignItems: 'center', justifyContent: 'center' } });
