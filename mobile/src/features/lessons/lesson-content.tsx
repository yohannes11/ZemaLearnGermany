import { Pressable, StyleSheet, View } from 'react-native';

import type { Block, Lesson } from '@/core/api/types';
import { useCourse } from '@/core/course';
import { hasClip, play } from '@/core/offline/audio';
import { useSettings } from '@/core/settings';
import { Card, Icon, Text } from '@/ui/primitives';
import { RichText } from '@/ui/rich-text';
import { radius, space, useColours } from '@/ui/theme';

/** German that plays its recording when tapped. */
function Spoken({ german }: { german: string }) {
  const c = useColours();
  const { voice } = useSettings();
  const audible = hasClip(german);
  return (
    <Pressable
      disabled={!audible}
      accessibilityRole={audible ? 'button' : 'text'}
      accessibilityHint={audible ? 'Plays the recording' : undefined}
      onPress={() => play(german, voice)}
      style={styles.spoken}>
      {audible && <Icon name="volume-high" size={18} colour={c.brand} />}
      <Text variant="bodyStrong" style={{ color: audible ? c.brand : c.text, flexShrink: 1 }}>{german}</Text>
    </Pressable>
  );
}

function LessonBlock({ block }: { block: Block }) {
  const c = useColours();
  const { t } = useCourse();
  const { voice } = useSettings();
  const table = block.table;
  return (
    <Card>
      {block.step ? <Text variant="overline" colour="brand">{t(block.step)}</Text> : null}
      {block.title ? <Text variant="heading">{t(block.title)}</Text> : null}
      {block.text ? <RichText>{t(block.text)}</RichText> : null}
      {block.reading?.map(paragraph => <Text key={paragraph} style={styles.reading}>{paragraph}</Text>)}
      {block.examples?.map(([german, meaning]) => (
        <View key={german} style={styles.example}>
          <Spoken german={german} />
          <RichText variant="caption" colour="muted">{t(meaning)}</RichText>
        </View>
      ))}
      {table && (
        <View style={[styles.table, { borderColor: c.border }]}>
          <View style={[styles.row, { backgroundColor: c.surface2 }]}>
            {table.head.map(cell => <Text key={cell} variant="label" style={styles.cell}>{t(cell)}</Text>)}
          </View>
          {table.rows.map((row, r) => {
            const said = table.say?.[r];
            return (
              <Pressable
                key={row.join('|')}
                disabled={!said}
                accessibilityRole={said ? 'button' : undefined}
                accessibilityLabel={row.join(', ')}
                onPress={() => said && play(said, voice)}
                style={({ pressed }) => [styles.row, { borderTopColor: c.border, backgroundColor: pressed ? c.brandSoft : 'transparent' }]}>
                {row.map((cell, i) => (
                  <Text key={i} variant={i === table.highlight ? 'bodyStrong' : 'body'} style={[styles.cell, i === table.highlight && { color: c.brand }]}>
                    {cell}
                  </Text>
                ))}
              </Pressable>
            );
          })}
        </View>
      )}
      {block.glossary?.length ? (
        <View style={styles.glossary}>
          {block.glossary.map(([german, meaning]) => (
            <Text key={german} variant="caption">
              <Text variant="label">{german}</Text> · {t(meaning)}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** A lesson's explanation: its introduction, blocks (text, examples, tables, reading) and rules. */
export function LessonContent({ lesson }: { lesson: Lesson }) {
  const { t } = useCourse();
  return (
    <>
      {lesson.intro?.map(line => <RichText key={line}>{t(line)}</RichText>)}
      {lesson.blocks?.map((block, i) => <LessonBlock key={i} block={block} />)}
      {lesson.rules?.length ? (
        <Card>
          <Text variant="heading">Rules to remember</Text>
          {lesson.rules.map(([rule, example]) => (
            <View key={rule} style={styles.rule}>
              <RichText variant="bodyStrong">{t(rule)}</RichText>
              <RichText colour="muted">{t(example)}</RichText>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  spoken: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  example: { gap: 2 },
  reading: { lineHeight: 26 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', paddingVertical: space.sm, paddingHorizontal: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'transparent' },
  cell: { flex: 1 },
  glossary: { gap: space.xs },
  rule: { gap: 2 },
});
