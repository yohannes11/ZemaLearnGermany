import { router } from 'expo-router';
import { SectionList, StyleSheet, View } from 'react-native';

import { useCourse } from '@/core/course';
import { StatChips } from '@/features/gamification/stat-chips';
import { useProgress } from '@/features/progress/store';
import { describeDay, dueWords, nextDue, REVIEW_SESSION_SIZE, useSrs } from '@/features/vocabulary/srs';
import { CourseGate } from '@/ui/course-gate';
import { Badge, Button, Card, Icon, ProgressBar, Text } from '@/ui/primitives';
import { space, useColours } from '@/ui/theme';

/** Vocabulary training: today's review, then every vocabulary section of the course, unit by unit. */
function Words() {
  const c = useColours();
  const { bundle, t } = useCourse();
  const { learned } = useProgress();
  const { words } = useSrs();
  if (!bundle) return null;

  const known = new Set(learned);
  const due = dueWords(bundle.course, learned, words).length;
  const upcoming = nextDue(words);
  const all = bundle.course.units.flatMap(u => u.sections.flatMap(s => s.words));
  const total = new Set(all.map(w => w.german)).size;
  const sections = bundle.course.units.map(unit => ({ unit, data: unit.sections }));

  const header = (
    <View style={styles.header}>
      <StatChips />
      <Card raised accent={c.goldBright}>
        <View style={styles.row}>
          <Badge icon="brain" colour={c.xp} background={c.goldSoft} size={52} />
          <View style={styles.grow}>
            <Text variant="overline" colour="xp">Smart review</Text>
            <Text variant="heading">{due > 0 ? `${due} ${due === 1 ? 'word' : 'words'} due` : 'All caught up'}</Text>
            <Text variant="caption" colour="muted">
              {due > 0
                ? `Up to ${REVIEW_SESSION_SIZE} per session, the most overdue first.`
                : upcoming
                  ? `Next review ${describeDay(upcoming)}.`
                  : 'Learn some words and they will come back here for review.'}
            </Text>
          </View>
        </View>
        {due > 0 && <Button label="Start review" kind="gold" icon="play" onPress={() => router.push({ pathname: '/session/cards', params: { review: '1' } })} />}
      </Card>
      <View style={styles.between}>
        <Text variant="caption" colour="muted">{known.size} of {total} words learned</Text>
      </View>
      <ProgressBar value={known.size / total} colour={c.goldBright} />
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <SectionList
        sections={sections}
        keyExtractor={section => section.key}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { unit } }) => (
          <View style={styles.unitHeader}>
            <Text variant="overline" colour="xp">{t(unit.label ?? `Unit ${unit.id}`)}</Text>
            <Text variant="heading">{t(unit.title)}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item: section }) => {
          const done = section.words.filter(w => known.has(w.german)).length;
          const complete = done === section.words.length;
          return (
            <Card
              onPress={() => router.push({ pathname: '/words/[section]', params: { section: section.key } })}
              accessibilityLabel={`${t(section.title)}, ${done} of ${section.words.length} learned`}>
              <View style={styles.row}>
                <View style={styles.grow}>
                  <Text variant="bodyStrong">{t(section.title)}</Text>
                  <ProgressBar value={done / section.words.length} colour={complete ? c.green : c.goldBright} height={6} />
                </View>
                <Text variant="label" colour={complete ? 'green' : 'muted'}>{complete ? '✓' : `${done}/${section.words.length}`}</Text>
                <Icon name="chevron-right" colour={c.subtle} />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

export default function WordsScreen() {
  return (
    <CourseGate>
      <Words />
    </CourseGate>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  list: { padding: space.md, paddingBottom: space.xxl * 2, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { gap: space.md, marginBottom: space.sm },
  unitHeader: { marginTop: space.lg, marginBottom: space.sm, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  grow: { flex: 1, gap: space.xs },
});
