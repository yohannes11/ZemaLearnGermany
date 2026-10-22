import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Word } from '@/core/api/types';
import { Text } from '@/ui/primitives';
import { duration, elevation, radius, space, useColours } from '@/ui/theme';

import { WordPicture } from './word-picture';

const FLY_MS = 220;

type Props = { word: Word; meaning: string; onAnswer: (knewIt: boolean) => void };

/**
 * A flashcard: tap to turn it over, swipe right for "I knew it", left for "Again". The gestures run on the UI
 * thread, so the card follows the finger at full frame rate. Buttons below do the same for anyone not swiping.
 */
export function SwipeCard({ word, meaning, onAnswer }: Props) {
  const c = useColours();
  const isDark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();
  const threshold = width * 0.28;
  const x = useSharedValue(0);
  const turn = useSharedValue(0);
  const [turned, setTurned] = useState(false);

  const flip = () => {
    void Haptics.selectionAsync();
    setTurned(t => !t);
    turn.set(withTiming(turned ? 0 : 1, { duration: duration.slow }));
  };
  const answer = (knewIt: boolean) => onAnswer(knewIt);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate(event => x.set(event.translationX))
    .onEnd(event => {
      const fling = Math.abs(event.velocityX) > 800;
      if (Math.abs(event.translationX) > threshold || (fling && Math.abs(event.translationX) > 40)) {
        const right = event.translationX > 0;
        x.set(withTiming(right ? width * 1.5 : -width * 1.5, { duration: FLY_MS }, () => scheduleOnRN(answer, right)));
      } else {
        x.set(withSpring(0, { damping: 16, stiffness: 180 }));
      }
    });
  const tap = Gesture.Tap().onEnd(() => scheduleOnRN(flip));

  const card = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { rotate: `${interpolate(x.get(), [-width, width], [-14, 14])}deg` }],
  }));
  const front = useAnimatedStyle(() => ({
    opacity: turn.get() < 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(turn.get(), [0, 1], [0, 180])}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: turn.get() >= 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${interpolate(turn.get(), [0, 1], [180, 360])}deg` }],
  }));
  const knewStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [0, threshold], [0, 1], 'clamp') }));
  const againStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-threshold, 0], [1, 0], 'clamp') }));

  const face = [styles.face, { backgroundColor: c.surface, borderColor: c.border }, elevation(2, isDark)];
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        style={[styles.area, card]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={turned ? `${word.german}: ${meaning}` : word.german}
        accessibilityHint={turned ? 'Double tap to turn back' : 'Double tap to see the meaning'}
        onAccessibilityTap={flip}>
        <Animated.View style={[face, front]}>
          <WordPicture codes={word.pic} size={72} />
          <Text variant="german" style={styles.centre}>{word.german}</Text>
          <Text variant="caption" colour="subtle">Tap to turn · swipe to answer</Text>
        </Animated.View>
        <Animated.View style={[face, { backgroundColor: c.brandSoft, borderColor: c.brand }, back]}>
          <Text variant="title" style={styles.centre}>{meaning}</Text>
          <Text variant="bodyStrong" colour="muted" style={styles.centre}>{word.german}</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampLeft, { borderColor: c.green }, knewStamp]}>
          <Text variant="overline" style={{ color: c.green }}>Knew it</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampRight, { borderColor: c.flame }, againStamp]}>
          <Text variant="overline" style={{ color: c.flame }}>Again</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * The next card, waiting underneath the one being answered, so a swipe reveals it at once (and its picture is
 * already loaded). It is only a picture of the card: it takes no touches and is hidden from screen readers.
 */
export function NextCard({ word }: { word: Word }) {
  const c = useColours();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.face, styles.next, { backgroundColor: c.surface, borderColor: c.border }]}>
      <WordPicture codes={word.pic} size={72} />
      <Text variant="german" style={styles.centre}>{word.german}</Text>
    </View>
  );
}

/** The space a card takes, so the session can lay out around it. */
export function CardSlot({ children }: { children: ReactNode }) {
  return <View style={styles.slot}>{children}</View>;
}

const styles = StyleSheet.create({
  slot: { flex: 1, minHeight: 300 },
  area: { flex: 1 },
  face: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    gap: space.md,
    backfaceVisibility: 'hidden',
  },
  centre: { textAlign: 'center' },
  next: { transform: [{ scale: 0.95 }, { translateY: 14 }], opacity: 0.9 },
  stamp: { position: 'absolute', top: space.lg, borderWidth: 3, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
  stampLeft: { left: space.lg, transform: [{ rotate: '-12deg' }] },
  stampRight: { right: space.lg, transform: [{ rotate: '12deg' }] },
});
