import { StyleSheet, View } from 'react-native';

import type { Word } from '@/core/api/types';
import { hasClip, play } from '@/core/offline/audio';
import { useSettings } from '@/core/settings';
import { Icon, IconButton, Text } from '@/ui/primitives';
import { radius, space, useColours } from '@/ui/theme';

import { WordPicture } from './word-picture';

/** A word in a list: its picture, the German, its meaning, whether it is learned, and a play button. */
export function WordRow({ word, meaning, learned }: { word: Word; meaning: string; learned: boolean }) {
  const c = useColours();
  const { voice } = useSettings();
  return (
    <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]} accessible={false}>
      <View style={[styles.picture, { backgroundColor: c.surface2 }]}>
        {word.pic?.length ? <WordPicture codes={word.pic.slice(0, 1)} size={28} /> : <Icon name="alphabetical-variant" colour={c.subtle} />}
      </View>
      <View style={styles.text} accessible accessibilityLabel={`${word.german}, ${meaning}${learned ? ', learned' : ''}`}>
        <Text variant="bodyStrong">{word.german}</Text>
        <Text variant="caption" colour="muted">{meaning}</Text>
      </View>
      {learned && <Icon name="check-circle" size={20} colour={c.green} />}
      {hasClip(word.german) && <IconButton icon="volume-high" label={`Listen to ${word.german}`} onPress={() => play(word.german, voice)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm + 4, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  picture: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
