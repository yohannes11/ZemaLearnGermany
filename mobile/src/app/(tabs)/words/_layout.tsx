import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useColours } from '@/ui/theme';

/**
 * A tab's own stack, with the platform's own header: a large title that shrinks into the bar as the list scrolls
 * (iOS), or a Material top app bar (Android). Going back stays within the tab.
 */
export default function SectionStack() {
  const c = useColours();
  return (
    <Stack
      screenOptions={{
        headerTintColor: c.brand,
        headerTitleStyle: { color: c.text },
        headerStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: c.bg },
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Words',
          headerLargeTitle: Platform.OS === 'ios',
          headerLargeTitleShadowVisible: false,
          headerLargeStyle: { backgroundColor: c.bg },
          headerLargeTitleStyle: { color: c.text },
        }}
      />
    </Stack>
  );
}
