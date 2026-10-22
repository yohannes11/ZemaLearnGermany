import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Lesson } from '@/core/api/types';
import { useCourse } from '@/core/course';
import { KIND_LOOK, kindName, lessonKind, PASS_MARK } from '@/features/lessons/kinds';
import { useProgress } from '@/features/progress/store';
import { CourseGate } from '@/ui/course-gate';
import { Badge, Button, Card, Icon, ProgressBar, Text } from '@/ui/primitives';
import { space, useColours } from '@/ui/theme';

/**
 * One unit, opened from the course map on Home: its vocabulary sections (gold, into Words) and its lessons
 * (emerald, into Lessons). It only links into the two tabs, as Home does.
 */
function UnitPage() {
  const c = useColours();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bundle, t } = useCourse();
  const { learned, grammar } = useProgress();
  const unit = bundle?.course.units.find(u => String(u.id) === id);

  if (!unit) {
    return (
      <View style={[styles.empty, { backgroundColor: c.bg }]}>
        <Text>This unit is no longer in the course.</Text>
        <Button label="Back" kind="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const known = new Set(learned);
  const words = new Set(unit.sections.flatMap(s => s.words.map(w => w.german)));
  const wordsDone = [...words].filter(g => known.has(g)).length;
  const passed = (lesson: Lesson) => (grammar[lesson.key] ?? -1) >= (lesson.custom === 'review' ? 9 : PASS_MARK);
  const lessonsDone = unit.grammar.filter(passed).length;
  const name = t(unit.label ?? `Unit ${unit.id}`);

  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.page} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.head}>
          <Text variant="overline" colour="brand">{name}</Text>
          <Text variant="title">{t(unit.title)}</Text>
        </View>

        <View style={styles.group}>
          <View style={styles.between}>
            <Text variant="heading">Words</Text>
            <Text variant="caption" colour="muted">{wordsDone} of {words.size} learned</Text>
          </View>
          <ProgressBar value={wordsDone / words.size} colour={c.goldBright} />
          {unit.sections.map(section => {
            const done = section.words.filter(w => known.has(w.german)).length;
            const complete = done === section.words.length;
            return (
              <Card
                key={section.key}
                accent={c.goldBright}
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
          })}
        </View>

        <View style={styles.group}>
          <View style={styles.between}>
            <Text variant="heading">Lessons</Text>
            <Text variant="caption" colour="muted">{lessonsDone} of {unit.grammar.length} done</Text>
          </View>
          <ProgressBar value={unit.grammar.length ? lessonsDone / unit.grammar.length : 0} colour={c.brand} />
          {unit.grammar.map(lesson => {
            const look = KIND_LOOK[lessonKind(lesson)];
            const complete = passed(lesson);
            const best = grammar[lesson.key];
            return (
              <Card
                key={lesson.key}
                accent={c.brand}
                onPress={() => router.push({ pathname: '/lessons/[key]', params: { key: lesson.key } })}
                accessibilityLabel={`${kindName(lesson, unit, t)}: ${t(lesson.title)}${complete ? ', completed' : best !== undefined ? `, best score ${best}` : ''}`}>
                <View style={styles.row}>
                  <Badge icon={complete ? 'check-bold' : look.icon} colour={complete ? c.brandInk : c.brand} background={complete ? c.green : c.brandSoft} />
                  <View style={styles.grow}>
                    <Text variant="bodyStrong">{t(lesson.title)}</Text>
                    <Text variant="caption" colour="muted">{kindName(lesson, unit, t)}{best !== undefined ? ` · best ${best}` : ''}</Text>
                  </View>
                  <Icon name="chevron-right" colour={c.subtle} />
                </View>
              </Card>
            );
          })}
          <Card accent={c.brand} onPress={() => router.push({ pathname: '/session/listening', params: { unit: String(unit.id) } })} accessibilityHint="Starts listening practice">
            <View style={styles.row}>
              <Badge icon="headphones" colour={c.brandInk} background={c.brand} />
              <View style={styles.grow}>
                <Text variant="bodyStrong">Listening practice</Text>
                <Text variant="caption" colour="muted">Hear it, pick what was said</Text>
              </View>
              <Icon name="chevron-right" colour={c.subtle} />
            </View>
          </Card>
        </View>
      </ScrollView>
    </>
  );
}

// Opened from a link the course may still be loading: wait for it rather than call the unit missing.
export default function UnitScreen() {
  return (
    <CourseGate>
      <UnitPage />
    </CourseGate>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.md, gap: space.lg, paddingBottom: space.xxl * 2, maxWidth: 720, width: '100%', alignSelf: 'center' },
  head: { gap: space.xs },
  group: { gap: space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, gap: space.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
});
