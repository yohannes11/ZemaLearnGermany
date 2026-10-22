import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import type { Unit } from '@/core/api/types';
import { downloadedCount, downloadUnit } from '@/core/offline/audio';
import { useSettings } from '@/core/settings';
import { Button, Icon, ProgressBar, Text } from '@/ui/primitives';
import { radius, space, useColours } from '@/ui/theme';

/** Saves a unit's recordings on the phone, so its words and exercises play without a connection. */
export function OfflineCard({ unit }: { unit: Unit }) {
  const c = useColours();
  const { voice } = useSettings();
  const [count, setCount] = useState(() => downloadedCount(unit, voice));
  const [busy, setBusy] = useState(false);
  const ready = count.total > 0 && count.done === count.total;

  const save = async () => {
    setBusy(true);
    try {
      await downloadUnit(unit, voice, (done, total) => setCount({ done, total }));
    } catch {
      Alert.alert('Download paused', 'Check your connection and try again. Saved recordings are kept.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: ready ? c.greenSoft : c.surface2 }]}>
      <View style={styles.row}>
        <Icon name={ready ? 'cloud-check-outline' : 'cloud-download-outline'} colour={ready ? c.green : c.muted} />
        <Text variant="label" colour={ready ? 'green' : 'muted'} style={styles.grow}>
          {ready ? 'Recordings saved for offline use' : busy ? `Saving ${count.done} of ${count.total}…` : 'Save this unit for offline use'}
        </Text>
        {!ready && <Button label={busy ? 'Saving' : 'Save'} kind="secondary" busy={busy} onPress={save} style={styles.button} />}
      </View>
      {busy && <ProgressBar value={count.total ? count.done / count.total : 0} colour={c.green} height={6} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.sm + 4, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  button: { minHeight: 40, paddingHorizontal: space.md },
});
