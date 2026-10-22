import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text as NativeText,
  useColorScheme,
  View,
  type StyleProp,
  type TextProps as NativeTextProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { duration, elevation, radius, ripple, space, type, useColours, type Colours, type TypeRole } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 22, colour }: { name: IconName; size?: number; colour?: string }) {
  const c = useColours();
  return <MaterialCommunityIcons name={name} size={size} color={colour ?? c.text} accessible={false} />;
}

type TextProps = Omit<NativeTextProps, 'role'> & { variant?: TypeRole; colour?: keyof Colours; children: ReactNode };

/** Every text in the app: a variant from the type scale (ui/theme) and a palette colour. */
export function Text({ variant = 'body', colour = 'text', style, ...props }: TextProps) {
  const c = useColours();
  const header = variant === 'display' || variant === 'title' || variant === 'heading';
  return (
    <NativeText
      accessibilityRole={header ? 'header' : undefined}
      maxFontSizeMultiplier={1.6}
      {...props}
      style={[type[variant], { color: c[colour] }, style]}
    />
  );
}

const IOS = Platform.OS === 'ios';

/**
 * Press feedback, per platform: on iOS a quick settle under the finger (as cards and tiles do in Apple's apps);
 * on Android the Material ripple does the job, so nothing moves.
 */
function usePressScale(pressedScale = 0.97) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  if (!IOS) return { style: undefined, onPressIn: undefined, onPressOut: undefined };
  return {
    style,
    onPressIn: () => scale.set(withTiming(pressedScale, { duration: duration.fast })),
    onPressOut: () => scale.set(withSpring(1, { damping: 18, stiffness: 260 })),
  };
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** A coloured stripe on the left: the section's colour (vocabulary gold, lessons emerald). */
  accent?: string;
  raised?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function Card({ children, onPress, style, accent, raised, accessibilityLabel, accessibilityHint }: CardProps) {
  const c = useColours();
  const isDark = useColorScheme() === 'dark';
  const press = usePressScale(0.98);
  return (
    <AnimatedPressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPressIn={onPress ? press.onPressIn : undefined}
      onPressOut={onPress ? press.onPressOut : undefined}
      android_ripple={onPress ? ripple(isDark) : undefined}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      style={[
        styles.card,
        // Resting cards are outlined; raised ones float on their shadow (iOS) or elevation (Android) alone.
        { backgroundColor: c.surface, borderColor: raised ? 'transparent' : c.border },
        raised && elevation(1, isDark),
        !IOS && styles.clip,
        accent !== undefined && { borderLeftWidth: 4, borderLeftColor: accent },
        press.style,
        style,
      ]}>
      {children}
    </AnimatedPressable>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/** A chunky, game-like button: a solid face over a darker base that it presses into. */
export function Button({ label, onPress, kind = 'primary', icon, busy, disabled, style, accessibilityHint }: ButtonProps) {
  const c = useColours();
  const press = usePressScale(0.97);
  const palette = {
    primary: { face: c.brand, base: c.brandDeep, ink: c.brandInk },
    gold: { face: c.goldBright, base: c.gold, ink: '#1f1300' },
    secondary: { face: c.surface, base: c.borderStrong, ink: c.text },
    ghost: { face: 'transparent', base: 'transparent', ink: c.brand },
    danger: { face: c.redSoft, base: c.red, ink: c.red },
  }[kind];
  const off = disabled || busy;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      android_ripple={ripple(kind === 'primary' || kind === 'gold')}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.button,
        !IOS && styles.clip,
        {
          backgroundColor: palette.face,
          borderBottomColor: palette.base,
          borderColor: kind === 'secondary' ? c.border : 'transparent',
          opacity: off && !busy ? 0.45 : 1,
        },
        kind === 'ghost' && styles.ghost,
        press.style,
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={palette.ink} />
      ) : (
        <View style={styles.buttonRow}>
          {icon && <Icon name={icon} size={20} colour={palette.ink} />}
          <NativeText maxFontSizeMultiplier={1.4} style={[type.label, styles.buttonLabel, { color: palette.ink }]}>
            {label}
          </NativeText>
        </View>
      )}
    </AnimatedPressable>
  );
}

export function IconButton({ icon, label, onPress, colour }: { icon: IconName; label: string; onPress: () => void; colour?: string }) {
  const c = useColours();
  const press = usePressScale(0.9);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      android_ripple={ripple(false, true)}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.iconButton, { backgroundColor: c.surface2 }, press.style]}>
      <Icon name={icon} colour={colour ?? c.brand} />
    </AnimatedPressable>
  );
}

/** A small stat in a pill: the streak, the XP, a count. */
export function Chip({ icon, value, colour, background, label }: { icon: IconName; value: string | number; colour: string; background: string; label: string }) {
  return (
    <View accessible accessibilityLabel={label} style={[styles.chip, { backgroundColor: background }]}>
      <Icon name={icon} size={18} colour={colour} />
      <NativeText style={[type.label, { color: colour }]}>{value}</NativeText>
    </View>
  );
}

/** A thin bar that fills smoothly as progress is made. */
export function ProgressBar({ value, colour, height = 8 }: { value: number; colour?: string; height?: number }) {
  const c = useColours();
  const share = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const width = useSharedValue(share);
  useEffect(() => width.set(withTiming(share, { duration: duration.slow })), [share, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
      style={[styles.track, { height, backgroundColor: c.surface2 }]}>
      <Animated.View style={[styles.fill, { backgroundColor: colour ?? c.brand }, fill]} />
    </View>
  );
}

export function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="heading">{title}</Text>
      {detail ? <Text variant="caption" colour="muted">{detail}</Text> : null}
    </View>
  );
}

/** A round badge with an icon, for list rows and section headers. */
export function Badge({ icon, colour, background, size = 44 }: { icon: IconName; colour: string; background: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} colour={colour} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: space.sm },
  button: {
    minHeight: 52,
    borderRadius: IOS ? radius.md + 2 : radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 4,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { borderBottomWidth: 0, minHeight: 44 },
  // Android clips the ripple to the shape.
  clip: { overflow: 'hidden' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttonLabel: { fontSize: 16, letterSpacing: 0.3 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm + 2, paddingVertical: space.xs + 2, borderRadius: radius.pill },
  track: { borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.sm },
});
