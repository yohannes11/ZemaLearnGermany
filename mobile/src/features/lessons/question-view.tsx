import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, SlideInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { play, type Voice } from '@/core/offline/audio';
import { Button, Icon, Text } from '@/ui/primitives';
import { RichText } from '@/ui/rich-text';
import { radius, space, type, useColours, useRipple } from '@/ui/theme';

import { checkOrder, checkTyped } from './answer-check';
import { shuffle } from './kinds';
import type { ChoiceQuestion, OrderQuestion, Question, WriteQuestion } from './questions';

/** How the learner answered: right or not, what they gave, and a note (e.g. "Watch the umlauts"). */
export type Result = { right: boolean; given: string; note?: string };

type Props = { question: Question; voice: Voice; result: Result | null; onResult: (result: Result) => void; onNext: () => void; last: boolean };

const haptic = (right: boolean) =>
  void Haptics.notificationAsync(right ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);

function Option({ label, state, onPress, disabled }: { label: string; state: 'idle' | 'right' | 'wrong'; onPress: () => void; disabled: boolean }) {
  const c = useColours();
  const rippleConfig = useRipple();
  const shake = useSharedValue(0);
  useEffect(() => {
    if (state === 'wrong') shake.set(withSequence(...[8, -8, 6, -6, 0].map(x => withTiming(x, { duration: 50 }))));
  }, [state, shake]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  const look = {
    idle: { backgroundColor: c.surface, borderColor: c.border, borderBottomColor: c.borderStrong },
    right: { backgroundColor: c.greenSoft, borderColor: c.green, borderBottomColor: c.green },
    wrong: { backgroundColor: c.redSoft, borderColor: c.red, borderBottomColor: c.red },
  }[state];
  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: state !== 'idle', disabled }}
        accessibilityLabel={state === 'idle' ? label : `${label}, ${state === 'right' ? 'correct' : 'wrong'}`}
        disabled={disabled}
        onPress={onPress}
        android_ripple={rippleConfig}
        style={({ pressed }) => [styles.option, look, styles.clip, pressed && { transform: [{ translateY: 2 }] }]}>
        <Text variant="bodyStrong" style={styles.grow}>{label}</Text>
        {state === 'right' && <Icon name="check-circle" colour={c.green} />}
        {state === 'wrong' && <Icon name="close-circle" colour={c.red} />}
      </Pressable>
    </Animated.View>
  );
}

function Choices({ question, result, onResult }: { question: ChoiceQuestion; result: Result | null; onResult: (r: Result) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.stack}>
      {question.options.map(option => (
        <Option
          key={option}
          label={option}
          disabled={!!result}
          state={!result ? 'idle' : option === question.answer ? 'right' : option === result.given ? 'wrong' : 'idle'}
          onPress={() => {
            const right = option === question.answer;
            haptic(right);
            onResult({ right, given: option });
          }}
        />
      ))}
    </View>
  );
}

function Tile({ text, onPress, disabled, lines }: { text: string; onPress: () => void; disabled: boolean; lines: boolean }) {
  const c = useColours();
  const rippleConfig = useRipple();
  return (
    <Animated.View layout={LinearTransition.duration(180)} entering={FadeIn.duration(150)} style={lines && styles.lineTile}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        android_ripple={rippleConfig}
        onPress={() => {
          void Haptics.selectionAsync();
          onPress();
        }}
        style={({ pressed }) => [styles.tile, styles.clip, { backgroundColor: c.surface, borderColor: c.border, borderBottomColor: c.borderStrong }, pressed && { transform: [{ translateY: 2 }] }]}>
        <Text variant="bodyStrong">{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Word tiles (or dialogue lines) tapped into order; tapping a placed tile sends it back. */
function Order({ question, result, onResult }: { question: OrderQuestion; result: Result | null; onResult: (r: Result) => void }) {
  const c = useColours();
  // Each tile keeps its place in the bank by index, so repeated words stay separate tiles.
  const [bank] = useState(() => {
    // Shuffled, but never already in the right order (as on the website).
    let order = shuffle(question.tiles.map((_, i) => i));
    for (let n = 0; n < 5 && order.every((v, i) => v === i); n++) order = shuffle(order);
    return order;
  });
  const [placed, setPlaced] = useState<number[]>([]);
  const left = bank.filter(i => !placed.includes(i));
  const given = placed.map(i => question.tiles[i]);
  const state = result ? (result.right ? c.green : c.red) : c.border;
  return (
    <View style={styles.stack}>
      <View
        accessibilityLabel={`Your answer: ${given.join(' ') || 'empty'}`}
        style={[styles.line, question.lines && styles.lineStack, { borderColor: state, backgroundColor: result ? (result.right ? c.greenSoft : c.redSoft) : c.surface2 }]}>
        {placed.length === 0 && <Text colour="subtle">{question.lines ? 'Tap the lines below in the right order.' : 'Tap the words below in the right order.'}</Text>}
        {placed.map(i => (
          <Tile key={i} text={question.tiles[i]} lines={question.lines} disabled={!!result} onPress={() => setPlaced(p => p.filter(x => x !== i))} />
        ))}
      </View>
      <View style={[styles.bank, question.lines && styles.lineStack]}>
        {left.map(i => (
          <Tile key={i} text={question.tiles[i]} lines={question.lines} disabled={!!result} onPress={() => setPlaced(p => [...p, i])} />
        ))}
      </View>
      {!result && (
        <View style={styles.row}>
          <Button label="Start again" kind="secondary" style={styles.grow} onPress={() => setPlaced([])} disabled={!placed.length} />
          <Button
            label="Check"
            style={styles.grow}
            disabled={left.length > 0}
            onPress={() => {
              const right = checkOrder(given, question.answer, question.alts, question.tiles, question.lines);
              haptic(right);
              onResult({ right, given: given.join(' ') });
            }}
          />
        </View>
      )}
    </View>
  );
}

/** A typed answer, with ä ö ü ß keys for German, checked like on the website. */
function Write({ question, result, onResult }: { question: WriteQuestion; result: Result | null; onResult: (r: Result) => void }) {
  const c = useColours();
  const rippleConfig = useRipple();
  const [value, setValue] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const submit = () => {
    if (!value.trim() || result) return;
    const verdict = checkTyped(value, [question.answer, ...question.alts], question.toGerman);
    const right = verdict.verdict !== 'wrong';
    haptic(right);
    onResult({ right, given: value, note: verdict.note || undefined });
  };
  const insert = (letter: string) => {
    setValue(v => v.slice(0, selection.start) + letter + v.slice(selection.end));
    setSelection(s => ({ start: s.start + 1, end: s.start + 1 }));
  };
  return (
    <View style={styles.stack}>
      {question.text ? <Text variant="heading">{question.text}</Text> : null}
      <TextInput
        accessibilityLabel="Your answer"
        value={value}
        onChangeText={setValue}
        onSelectionChange={e => setSelection(e.nativeEvent.selection)}
        editable={!result}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="Type your answer…"
        placeholderTextColor={c.subtle}
        returnKeyType="done"
        onSubmitEditing={submit}
        style={[
          styles.input,
          type.bodyStrong,
          { color: c.text, backgroundColor: c.surface, borderColor: result ? (result.right ? c.green : c.red) : c.borderStrong },
        ]}
      />
      {question.toGerman && !result && (
        <View style={styles.row} accessibilityLabel="German letters">
          {['ä', 'ö', 'ü', 'ß'].map(letter => (
            <Pressable key={letter} accessibilityRole="button" accessibilityLabel={`Insert ${letter}`} onPress={() => insert(letter)} android_ripple={rippleConfig} style={({ pressed }) => [styles.key, styles.clip, { backgroundColor: c.surface2, opacity: pressed && !rippleConfig ? 0.6 : 1 }]}>
              <Text variant="bodyStrong">{letter}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!result && <Button label="Check" onPress={submit} disabled={!value.trim()} />}
    </View>
  );
}

/** One question of any kind: listen if needed, answer, see at once whether it was right, then continue. */
export function QuestionView({ question, voice, result, onResult, onNext, last }: Props) {
  const c = useColours();

  useEffect(() => {
    if (question.listen && question.say) play(question.say, voice);
  }, [question, voice]);

  const answered = (r: Result) => {
    onResult(r);
    if (!question.listen && question.say) play(question.say, voice);
  };

  return (
    <View style={styles.page}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.top}>
        <RichText variant="heading">{question.prompt}</RichText>
        {question.listen && question.say ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play again"
            onPress={() => question.say && play(question.say, voice)}
            style={[styles.speaker, { backgroundColor: c.brand, borderBottomColor: c.brandDeep }]}>
            <Icon name="volume-high" size={44} colour={c.brandInk} />
          </Pressable>
        ) : null}
        {question.type === 'choice' && question.gap ? (
          <Text variant="title">
            {question.gap.before}
            <Text variant="title" style={{ color: result ? (result.right ? c.green : c.red) : c.brand }}>
              {result ? ` ${question.answer} ` : ' ____ '}
            </Text>
            {question.gap.after}
          </Text>
        ) : null}
        {question.hint ? <RichText variant="caption" colour="muted">{question.hint}</RichText> : null}
      </Animated.View>

      {question.type === 'choice' && <Choices question={question} result={result} onResult={answered} />}
      {question.type === 'order' && <Order question={question} result={result} onResult={answered} />}
      {question.type === 'write' && <Write question={question} result={result} onResult={answered} />}

      {result && (
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          accessibilityLiveRegion="polite"
          style={[styles.feedback, { backgroundColor: result.right ? c.greenSoft : c.redSoft, borderColor: result.right ? c.green : c.red }]}>
          <View style={styles.feedbackTitle}>
            <Icon name={result.right ? 'check-decagram' : 'information'} colour={result.right ? c.green : c.red} />
            <Text variant="heading" style={{ color: result.right ? c.green : c.red }}>{result.right ? 'Richtig!' : 'Not quite'}</Text>
          </View>
          {(!result.right || question.type !== 'choice') && (
            <Text variant="bodyStrong">{question.shown ?? question.answer}</Text>
          )}
          {result.note || question.why ? <RichText>{result.note || question.why || ''}</RichText> : null}
          <Button label={last ? 'See results' : 'Continue'} kind={result.right ? 'primary' : 'danger'} onPress={onNext} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: space.lg },
  top: { gap: space.md },
  stack: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
  speaker: { alignSelf: 'center', width: 112, height: 112, borderRadius: radius.xl, borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center' },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1.5, borderBottomWidth: 4, borderRadius: radius.lg, paddingHorizontal: space.md },
  line: { minHeight: 64, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed' },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lineStack: { flexDirection: 'column', alignItems: 'stretch' },
  lineTile: { alignSelf: 'stretch' },
  tile: { paddingHorizontal: space.md, paddingVertical: space.sm + 2, borderRadius: radius.md, borderWidth: 1.5, borderBottomWidth: 4 },
  input: { minHeight: 56, borderWidth: 2, borderRadius: radius.lg, paddingHorizontal: space.md },
  key: { width: 52, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  feedback: { marginTop: 'auto', gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1.5 },
  feedbackTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  clip: { overflow: 'hidden' },
});
