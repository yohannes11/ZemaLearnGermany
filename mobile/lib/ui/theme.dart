import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

import '../core/settings.dart';
import 'tokens.dart';

/// The palette of zema.css (tokens.dart, synced from the website) plus the app's own game colours.
class Palette {
  const Palette(this.t, {required this.xp, required this.dark});
  final Tokens t;

  /// XP and achievements, in the brand's gold.
  final Color xp;
  final bool dark;

  Color get bg => t.bg;
  Color get surface => t.surface;
  Color get surface2 => t.surface2;
  Color get border => t.border;
  Color get borderStrong => t.borderStrong;
  Color get text => t.text;
  Color get muted => t.muted;
  Color get subtle => t.subtle;
  Color get brand => t.brand;
  Color get brandDeep => t.brandDeep;
  Color get brandSoft => t.brandSoft;
  Color get brandInk => t.brandInk;
  Color get gold => t.gold;
  Color get goldBright => t.goldBright;
  Color get goldSoft => t.goldSoft;
  Color get flame => t.flame;
  Color get flameSoft => t.flameSoft;
  Color get freeze => t.freeze;
  Color get green => t.green;
  Color get greenSoft => t.greenSoft;
  Color get red => t.red;
  Color get redSoft => t.redSoft;
  Color get onImage => Colors.white;

  static const light = Palette(lightTokens, xp: Color(0xFFD97706), dark: false);
  static const darkMode = Palette(darkTokens, xp: Color(0xFFF0B545), dark: true);
}

extension PaletteOf on BuildContext {
  /// The palette for the app's light or dark mode: `context.c.brand`.
  Palette get c => Theme.of(this).brightness == Brightness.dark ? Palette.darkMode : Palette.light;
}

/// The 8px grid of zema.css (4px for fine adjustments).
abstract final class Space {
  static const xs = 4.0, sm = 8.0, md = 16.0, lg = 24.0, xl = 32.0, xxl = 48.0;
}

/// zema.css's radius scale: tighter corners than the usual soft boxes.
abstract final class Radii {
  static const xs = 4.0, sm = 6.0, md = 10.0, lg = 14.0, xl = 20.0, pill = 999.0;
}

/// zema.css's motion: quick and settled.
abstract final class Motion {
  static const fast = Duration(milliseconds: 120);
  static const base = Duration(milliseconds: 200);
  static const slow = Duration(milliseconds: 300);
  static const celebrate = Duration(milliseconds: 900);
  static const ease = Cubic(0.2, 0.7, 0.2, 1);
}

/// The website's serif (Newsreader, bundled in assets/fonts) for titles, headings and German words; everything
/// you operate stays in the system font (Roboto on Android, SF Pro on iOS), as on the website.
const serif = 'Newsreader';

enum TextRole { display, title, heading, subheading, body, bodyStrong, label, caption, overline, german }

/// The type scale: Material 3's sizes, with the serif for the reading roles.
TextStyle textStyle(TextRole role) => switch (role) {
      TextRole.display => const TextStyle(fontFamily: serif, fontSize: 32, height: 40 / 32, fontWeight: FontWeight.w500, letterSpacing: -0.5),
      TextRole.title => const TextStyle(fontFamily: serif, fontSize: 28, height: 36 / 28, fontWeight: FontWeight.w500, letterSpacing: -0.4),
      TextRole.heading => const TextStyle(fontFamily: serif, fontSize: 22, height: 28 / 22, fontWeight: FontWeight.w600),
      TextRole.subheading => const TextStyle(fontSize: 16, height: 24 / 16, fontWeight: FontWeight.w500, letterSpacing: 0.15),
      TextRole.body => const TextStyle(fontSize: 16, height: 24 / 16, fontWeight: FontWeight.w400, letterSpacing: 0.3),
      TextRole.bodyStrong => const TextStyle(fontSize: 16, height: 24 / 16, fontWeight: FontWeight.w600, letterSpacing: 0.15),
      TextRole.label => const TextStyle(fontSize: 14, height: 20 / 14, fontWeight: FontWeight.w600, letterSpacing: 0.1),
      TextRole.caption => const TextStyle(fontSize: 14, height: 20 / 14, fontWeight: FontWeight.w400, letterSpacing: 0.25),
      TextRole.overline => const TextStyle(fontSize: 11.5, height: 16 / 11.5, fontWeight: FontWeight.w600, letterSpacing: 0.6),
      TextRole.german => const TextStyle(fontFamily: serif, fontSize: 34, height: 42 / 34, fontWeight: FontWeight.w500, letterSpacing: -0.5),
    };

ThemeData buildTheme(Brightness brightness) {
  final p = brightness == Brightness.dark ? Palette.darkMode : Palette.light;
  final scheme = ColorScheme.fromSeed(
    seedColor: p.brand,
    brightness: brightness,
    primary: p.brand,
    onPrimary: p.brandInk,
    secondary: p.goldBright,
    surface: p.bg,
    onSurface: p.text,
    error: p.red,
    outline: p.borderStrong,
    outlineVariant: p.border,
  );
  return ThemeData(
    colorScheme: scheme,
    brightness: brightness,
    scaffoldBackgroundColor: p.bg,
    canvasColor: p.bg,
    dividerColor: p.border,
    appBarTheme: AppBarTheme(
      backgroundColor: p.bg,
      foregroundColor: p.text,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: textStyle(TextRole.heading).copyWith(color: p.text),
      iconTheme: IconThemeData(color: p.brand),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.surface,
      indicatorColor: p.brandSoft,
      surfaceTintColor: Colors.transparent,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? p.brand : p.subtle)),
      labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => textStyle(TextRole.label).copyWith(fontSize: 12, color: s.contains(WidgetState.selected) ? p.brand : p.subtle)),
    ),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: p.bg, surfaceTintColor: Colors.transparent, showDragHandle: true),
    dialogTheme: DialogThemeData(backgroundColor: p.surface, surfaceTintColor: Colors.transparent),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? p.brandInk : null),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? p.brand : null),
    ),
    textSelectionTheme: TextSelectionThemeData(cursorColor: p.brand, selectionHandleColor: p.brand),
    snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: p.text),
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    }),
  );
}

ThemeMode themeMode(Appearance appearance) => switch (appearance) {
      Appearance.system => ThemeMode.system,
      Appearance.light => ThemeMode.light,
      Appearance.dark => ThemeMode.dark,
    };

/// Depth, in two steps: resting cards and floating things (the flashcard, sheets). A shadow tinted with the
/// brand's green ink, as zema.css --shadow.
List<BoxShadow> elevation(BuildContext context, int level) {
  final dark = context.c.dark;
  return [
    BoxShadow(
      color: (dark ? Colors.black : const Color(0xFF0F1F17)).withValues(alpha: dark ? 0.4 : (level == 1 ? 0.08 : 0.16)),
      blurRadius: level == 1 ? 8 : 20,
      offset: Offset(0, level == 1 ? 2 : 8),
    ),
  ];
}
