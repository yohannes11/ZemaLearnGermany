import { StyleSheet, View } from 'react-native';

import { Chip } from '@/ui/primitives';
import { radius, space, useColours } from '@/ui/theme';

import { useGame } from './hooks';
import { Tally } from './tally';

/** The streak (as a tally), XP and level, always in view at the top of the main tabs. */
export function StatChips() {
  const c = useColours();
  const { totalXp, level, tally } = useGame();
  return (
    <View style={styles.row}>
      <View style={[styles.tally, { backgroundColor: tally.todayMet ? c.flameSoft : c.surface2 }]}>
        <Tally size="compact" />
      </View>
      <Chip icon="lightning-bolt" value={totalXp} colour={c.xp} background={c.goldSoft} label={`${totalXp} XP`} />
      <Chip icon="shield-star" value={level.level} colour={c.brand} background={c.brandSoft} label={`Level ${level.level}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' },
  tally: { borderRadius: radius.pill, paddingHorizontal: space.sm, minHeight: 32, justifyContent: 'center' },
});
