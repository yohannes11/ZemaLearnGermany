import { router } from 'expo-router';
import { SectionList, StyleSheet, View } from 'react-native';

import type { Lesson, Unit } from '@/core/api/types';
import { useCourse } from '@/core/course';
import { StatChips } from '@/features/gamification/stat-chips';
import { KIND_LOOK, kindName, lessonKind, PASS_MARK } from '@/features/lessons/kinds';
import { useProgress } from '@/features/progress/store';
import { CourseGate } from '@/ui/course-gate';
import { Badge, Card, Icon, ProgressBar, Text } from '@/ui/primitives';
import { space, useColours } from '@/ui/theme';

type Row = { kind: 'listening'; unit: Unit } | { kind: 'lesson'; lesson: Lesson; unit: Unit };

/** Learning modules: each unit's grammar lessons, reading texts, unit test and listening practice. */
function Lessons() {
  const c = useColours();
  const { bundle, t } = useCourse();
  const { grammar } = useProgress();
  if (!bundle) return null;

  const passed = (lesson: Lesson) => (grammar[lesson.key] ?? -1) >= (lesson.custom === 'review' ? 9 : PASS_MARK);
  const sections = bundle.course.units.map(unit => ({
    unit,
    data: [...unit.grammar.map(lesson => ({ kind: 'lesson', lesson, unit }) as Row), { kind: 'listening', unit } as Row],
  }));
  const all = bundle.course.units.flatMap(u => u.grammar);
  const done = all.filter(passed).length;

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <SectionList
        sections={sections}
        keyExtractor={row => (row.kind === 'lesson' ? row.lesson.key : `listening-${row.unit.id}`)}
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <StatChips />
            <Text variant="caption" colour="muted">{done} of {all.length} lessons completed</Text>
            <ProgressBar value={done / all.length} colour={c.brand} />
          </View>
        }
        renderSectionHeader={({ section: { unit } }) => {
          const unitDone = unit.grammar.filter(passed).length;
          return (
            <View style={styles.unitHeader}>
              <Text variant="overline" colour="brand">{t(unit.label ?? `Unit ${unit.id}`)} · {unitDone}/{unit.grammar.length}</Text>
              <Text variant="heading">{t(unit.title)}</Text>
            </View>
          );
        }}
        renderItem={({ item: row }) => {
          if (row.kind === 'listening') {
            return (
              <Card onPress={() => router.push({ pathname: '/session/listening', params: { unit: String(row.unit.id) } })} accessibilityHint="Starts listening practice">
                <View style={styles.row}>
                  <Badge icon="headphones" colour={c.brandInk} background={c.brand} />
                  <View style={styles.grow}>
                    <Text variant="bodyStrong">Listening practice</Text>
                    <Text variant="caption" colour="muted">Hear it, pick what was said</Text>
                  </View>
                  <Icon name="chevron-right" colour={c.subtle} />
                </View>
              </Card>
            );
          }
          const { lesson } = row;
          const look = KIND_LOOK[lessonKind(lesson)];
          const name = kindName(lesson, row.unit, t);
          const best = grammar[lesson.key];
          const complete = passed(lesson);
          return (
            <Card
              onPress={() => router.push({ pathname: '/lessons/[key]', params: { key: lesson.key } })}
              accessibilityLabel={`${name}: ${t(lesson.title)}${complete ? ', completed' : best !== undefined ? `, best score ${best}` : ''}`}>
              <View style={styles.row}>
                <Badge icon={complete ? 'check-bold' : look.icon} colour={complete ? c.brandInk : c.brand} background={complete ? c.green : c.brandSoft} />
                <View style={styles.grow}>
                  <Text variant="bodyStrong">{t(lesson.title)}</Text>
                  <Text variant="caption" colour="muted">
                    {name}
                    {best !== undefined ? ` · best ${best}` : ''}
                  </Text>
                </View>
                <Icon name="chevron-right" colour={c.subtle} />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

export default function LessonsScreen() {
  return (
    <CourseGate>
      <Lessons />
    </CourseGate>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  list: { padding: space.md, paddingBottom: space.xxl * 2, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { gap: space.md, marginBottom: space.sm },
  unitHeader: { marginTop: space.lg, marginBottom: space.sm, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, gap: 2 },
});
