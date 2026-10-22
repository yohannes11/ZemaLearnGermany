import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useCourse } from '@/core/course';

import { Badge, Button, Text } from './primitives';
import { space, useColours } from './theme';

/** Shows its children once the course is on the phone; before that, loading or what to do when offline. */
export function CourseGate({ children }: { children: ReactNode }) {
  const c = useColours();
  const { bundle, error, refresh } = useCourse();
  if (bundle) return children;
  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      {error ? (
        <>
          <Badge icon="wifi-off" colour={c.muted} background={c.surface2} size={72} />
          <Text variant="heading" style={styles.centre}>The course downloads once</Text>
          <Text colour="muted" style={styles.centre}>Connect to the internet to get it. After that it works offline.</Text>
          <Button label="Try again" icon="refresh" onPress={() => void refresh()} />
        </>
      ) : (
        <ActivityIndicator size="large" color={c.brand} accessibilityLabel="Loading the course" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  centre: { textAlign: 'center' },
});
