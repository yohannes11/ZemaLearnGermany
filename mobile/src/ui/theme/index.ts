import { Platform, useColorScheme } from 'react-native';

import { dark, light, type ColourName } from './tokens';

export type Colours = Record<ColourName, string> & {
  /** XP and achievements, in the brand's gold. */
  xp: string;
  /** Text on photographs. */
  onImage: string;
};

// The streak's flame and freeze come from zema.css with the other tokens; these two are the app's own.
const game = {
  light: { xp: '#d97706', onImage: '#ffffff' },
  dark: { xp: '#f0b545', onImage: '#ffffff' },
};

/** The 8px grid of zema.css (4px for fine adjustments). */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
/** zema.css's radius scale: tighter corners than the usual soft boxes. */
export const radius = { xs: 4, sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;
/** zema.css's motion: quick and settled. */
export const duration = { fast: 120, base: 200, slow: 300, celebrate: 900 } as const;

/**
 * The serif of the website (Newsreader), loaded in app/_layout.tsx. Each weight is its own family, because Android
 * does not pick weights of a font loaded at runtime from fontWeight.
 */
export const serif = { medium: 'Newsreader-Medium', semibold: 'Newsreader-SemiBold', bold: 'Newsreader-Bold' } as const;

/**
 * The type scale in each platform's own system font and sizes: SF Pro with Apple's text styles on iOS (Human
 * Interface Guidelines), Roboto with Material 3's type scale on Android. Same roles on both, so screens stay the
 * same; each platform reads the way its own apps do, and text scales with the learner's font-size setting.
 * As on the website, titles, headings and German words are set in the serif; everything you operate stays in the
 * system font.
 */
const iosType = {
  display: { fontSize: 34, lineHeight: 41, fontFamily: serif.medium, letterSpacing: -0.6 }, // Large Title
  title: { fontSize: 28, lineHeight: 34, fontFamily: serif.medium, letterSpacing: -0.4 }, // Title 1
  heading: { fontSize: 21, lineHeight: 26, fontFamily: serif.semibold }, // Title 3
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '600' }, // Headline
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' }, // Body
  bodyStrong: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' }, // Subheadline, emphasized
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' }, // Footnote
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' }, // Caption 1
  german: { fontSize: 36, lineHeight: 42, fontFamily: serif.medium, letterSpacing: -0.6 },
} as const;

const androidType = {
  display: { fontSize: 32, lineHeight: 40, fontFamily: serif.medium, letterSpacing: -0.5 }, // Headline Large (emphasized)
  title: { fontSize: 28, lineHeight: 36, fontFamily: serif.medium, letterSpacing: -0.4 }, // Headline Medium (emphasized)
  heading: { fontSize: 22, lineHeight: 28, fontFamily: serif.semibold }, // Title Large
  subheading: { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 }, // Title Medium
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.5 }, // Body Large
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 }, // Label Large
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.25 }, // Body Medium
  overline: { fontSize: 11, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' }, // Label Small
  german: { fontSize: 34, lineHeight: 42, fontFamily: serif.medium, letterSpacing: -0.5 },
} as const;

export const type = Platform.OS === 'ios' ? iosType : androidType;
export type TypeRole = keyof typeof type;

/** The palette for the device's light or dark setting. */
export function useColours(): Colours {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { ...(scheme === 'dark' ? dark : light), ...game[scheme] };
}

/**
 * Android's touch ripple: the Material state layer (the text colour at 12%), drawn inside the shape. iOS has no
 * ripple; its controls dim or settle instead (ui/primitives).
 */
export function ripple(isDark: boolean, borderless = false) {
  if (Platform.OS !== 'android') return undefined;
  return { color: isDark ? 'rgba(235, 242, 237, 0.12)' : 'rgba(15, 31, 23, 0.12)', borderless, foreground: true };
}

/** The ripple for the current light or dark mode (Android only; undefined on iOS). */
export function useRipple(borderless = false) {
  return ripple(useColorScheme() === 'dark', borderless);
}

/**
 * Depth, in three steps used the same way everywhere: 0 flat (outlined), 1 resting cards, 2 floating (the
 * flashcard, sheets). A shadow tinted with the brand's green ink on iOS (as zema.css --shadow); elevation on Android.
 */
export function elevation(level: 1 | 2, isDark: boolean) {
  return {
    shadowColor: isDark ? '#000000' : '#0f1f17',
    shadowOpacity: isDark ? 0.4 : level === 1 ? 0.08 : 0.16,
    shadowRadius: level === 1 ? 8 : 20,
    shadowOffset: { width: 0, height: level === 1 ? 2 : 8 },
    elevation: level === 1 ? 2 : 6,
  };
}
