import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconButton, ProgressBar, Text } from '@/ui/primitives';
import { space, useColours } from '@/ui/theme';

/** The top of every practice session: a way out, how far along it is, and the count. */
export function SessionHeader({ done, total, colour }: { done: number; total: number; colour?: string }) {
  const c = useColours();
  return (
    <View style={styles.row}>
      <IconButton icon="close" label="End session" colour={c.muted} onPress={() => router.back()} />
      <View style={styles.bar}>
        <ProgressBar value={total ? done / total : 0} colour={colour} height={12} />
      </View>
      <Text variant="label" colour="muted" accessibilityLabel={`${done} of ${total} done`}>
        {done}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bar: { flex: 1 },
});
