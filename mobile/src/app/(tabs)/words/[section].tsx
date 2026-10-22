import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { useCourse } from '@/core/course';
import { useProgress } from '@/features/progress/store';
import { OfflineCard } from '@/features/vocabulary/offline-card';
import { WordRow } from '@/features/vocabulary/word-row';
import { Button, ProgressBar, Text } from '@/ui/primitives';
import { space, useColours } from '@/ui/theme';

/** One vocabulary section: every word with its picture and recording, and flashcards for the lot. */
export default function SectionScreen() {
  const c = useColours();
  const { section: key } = useLocalSearchParams<{ section: string }>();
  const { bundle, t, meaning } = useCourse();
  const { learned } = useProgress();
  const unit = bundle?.course.units.find(u => u.sections.some(s => s.key === key));
  const section = unit?.sections.find(s => s.key === key);

  if (!unit || !section) {
    return (
      <View style={[styles.empty, { backgroundColor: c.bg }]}>
        <Text>This section is no longer in the course.</Text>
        <Button label="Back to Words" kind="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const known = new Set(learned);
  const done = section.words.filter(w => known.has(w.german)).length;
  const left = section.words.length - done;

  return (
    <>
      <Stack.Screen options={{ title: t(section.title) }} />
      <FlatList
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        data={section.words}
        keyExtractor={word => word.german}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="overline" colour="xp">{t(unit.label ?? `Unit ${unit.id}`)} · {t(unit.title)}</Text>
            <View style={styles.between}>
              <Text variant="caption" colour="muted">{done} of {section.words.length} learned</Text>
            </View>
            <ProgressBar value={done / section.words.length} colour={c.goldBright} />
            <Button
              label={left > 0 ? `Learn ${left} new ${left === 1 ? 'word' : 'words'}` : 'Practise all words again'}
              kind="gold"
              icon="cards-outline"
              onPress={() => router.push({ pathname: '/session/cards', params: { section: section.key } })}
            />
            <OfflineCard unit={unit} />
          </View>
        }
        renderItem={({ item }) => <WordRow word={item} meaning={meaning(item)} learned={known.has(item.german)} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.md, paddingBottom: space.xxl * 2, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { gap: space.md, marginBottom: space.md },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
});
