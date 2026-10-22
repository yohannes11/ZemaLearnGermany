import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';

import { useColours } from '@/ui/theme';

const PIECES = 42;
const FALL_MS = 2200;

type Piece = { x: number; drift: number; spin: number; size: number; colour: string; round: boolean };

/** A fixed pseudo-random number in [0, 1) for piece `i`: the same on every render, different per piece. */
function scatter(i: number, salt: number) {
  const n = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function ConfettiPiece({ piece, height, progress }: { piece: Piece; height: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = progress.get();
    return {
      opacity: t < 0.85 ? 1 : (1 - t) / 0.15,
      transform: [
        { translateX: piece.x + piece.drift * t },
        { translateY: -40 + (height + 80) * t },
        { rotate: `${piece.spin * t}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.size, height: piece.round ? piece.size : piece.size * 0.45, borderRadius: piece.round ? piece.size / 2 : 2, backgroundColor: piece.colour },
        style,
      ]}
    />
  );
}

/** A burst of falling confetti in the brand's colours. Nothing at all when the phone asks for reduced motion. */
export function Confetti({ play }: { play: boolean }) {
  const c = useColours();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const pieces = useMemo<Piece[]>(() => {
    const colours = [c.brand, c.goldBright, c.xp, c.flame, c.brandDeep, '#ffffff'];
    return Array.from({ length: PIECES }, (_, i) => ({
      x: scatter(i, 1) * width,
      drift: (scatter(i, 2) - 0.5) * 160,
      spin: (scatter(i, 3) - 0.5) * 900,
      size: 7 + scatter(i, 4) * 7,
      colour: colours[i % colours.length],
      round: i % 3 === 0,
    }));
  }, [c, width]);

  useEffect(() => {
    if (play && !reduced) progress.set(withDelay(80, withTiming(1, { duration: FALL_MS, easing: Easing.out(Easing.quad) })));
  }, [play, reduced, progress]);

  if (reduced || !play) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} height={height} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ piece: { position: 'absolute', top: 0, left: 0 } });
