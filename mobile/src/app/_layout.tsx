import { Newsreader_500Medium, Newsreader_600SemiBold, Newsreader_700Bold } from '@expo-google-fonts/newsreader';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CourseProvider } from '@/core/course';
import { SessionProvider } from '@/core/session';
import { settings, useSettings } from '@/core/settings';
import { useGame } from '@/features/gamification/hooks';
import { loadSync } from '@/core/sync/engine';
import { scheduleReminders } from '@/features/reminders/reminders';
import { serif, useColours } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

/** Keeps the streak reminders in step with practice: none today once the learner has practised. */
function ReminderKeeper() {
  const { streak, practisedToday } = useGame();
  useEffect(() => {
    void scheduleReminders(streak, practisedToday);
  }, [streak, practisedToday]);
  return null;
}

function Navigation() {
  const c = useColours();
  const { onboarded } = useSettings();
  return (
    <Stack
      screenOptions={{
        headerTintColor: c.brand,
        headerTitleStyle: { color: c.text },
        headerStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
      }}>
      {/* The app itself, once the introduction is done. */}
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Practice sessions cover the tabs: one task at a time, and a close button is the only way out. */}
        <Stack.Screen name="session/cards" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="session/quiz" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="session/listening" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="sign-in" options={{ title: 'Your account', presentation: 'modal' }} />
        {/* A unit, opened from the course map on Home: its word sections and lessons, linking into both tabs. */}
        <Stack.Screen name="unit/[id]" options={{ title: '' }} />
      </Stack.Protected>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColours();
  const [stateLoaded, setStateLoaded] = useState(false);

  useEffect(() => {
    // Everything saved on the phone, before the first screen: no flash of an empty app.
    void Promise.all([settings.load(), loadSync()]).then(() => setStateLoaded(true));
  }, []);

  // The serif for titles and German words; everything else is the system font, which needs no loading. A font
  // that fails to load falls back to the system font rather than holding the app on the splash screen.
  const [fontsLoaded, fontError] = useFonts({
    [serif.medium]: Newsreader_500Medium,
    [serif.semibold]: Newsreader_600SemiBold,
    [serif.bold]: Newsreader_700Bold,
  });
  const ready = stateLoaded && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: c.brand, background: c.bg, card: c.surface, text: c.text, border: c.border } };
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <SessionProvider>
          <CourseProvider>
            <ReminderKeeper />
            {/* Light or dark status bar icons, following the app's light or dark mode, edge to edge. */}
            <StatusBar style="auto" />
            <Navigation />
          </CourseProvider>
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
