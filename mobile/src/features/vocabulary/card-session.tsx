import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Word } from '@/core/api/types';
import { useCourse } from '@/core/course';
import { hasClip, play } from '@/core/offline/audio';
import { useSettings } from '@/core/settings';
import { record, sessionDefaults } from '@/core/sync/engine';
import { Celebration } from '@/features/gamification/celebration';
import { useGame } from '@/features/gamification/hooks';
import { XP } from '@/features/gamification/xp';
import { awardXp, setLearned, useProgress } from '@/features/progress/store';
import { SessionHeader } from '@/features/session-header';
import { Button, IconButton } from '@/ui/primitives';
import { space, useColours } from '@/ui/theme';

import { grade } from './srs';
import { CardSlot, NextCard, SwipeCard } from './swipe-card';

type Props = {
  deck: Word[];
  title: string;
  /** The section key, or "review": saved with the position, so the deck can be continued on any device. */
  sessionRef: string;
  /** Answers already given, when continuing. */
  answers?: boolean[];
};

/** A run through a deck of flashcards, then the celebration. Every answer is saved as it is given. */
export function CardSession({ deck, title, sessionRef, answers: earlier = [] }: Props) {
  const c = useColours();
  const { meaning } = useCourse();
  const { voice } = useSettings();
  const { learned } = useProgress();
  const game = useGame();
  // Fixed when the session starts, so the celebration can compare.
  const [start] = useState(() => ({ level: game.level.level, learned: new Set(learned) }));
  const [position, setPosition] = useState(Math.min(earlier.length, deck.length));
  const [given, setGiven] = useState<boolean[]>(earlier.slice(0, deck.length));
  // The card being answered: a swipe finishing after a button press must not answer the next card too.
  const current = useRef(Math.min(earlier.length, deck.length));
  const [tally, setTally] = useState(() => ({
    knew: earlier.filter(Boolean).length,
    again: earlier.filter(a => !a).length,
    xp: 0,
  }));

  const save = (answers: boolean[]) => {
    const done = answers.length >= deck.length;
    record({
      kind: 'session',
      session: done ? null : { kind: 'cards', ref: sessionRef, items: deck.map(w => w.german), answers, position: answers.length, ...sessionDefaults() },
    });
  };
  // Opening the deck saves where it starts; each answer saves again.
  useEffect(() => {
    if (deck.length) save(given);
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const word = deck[position];
  useEffect(() => {
    if (word) play(word.german, voice);
  }, [word, voice]);

  if (!word) {
    const success = tally.knew >= tally.again;
    return (
      <Celebration
        title={deck.length === 0 ? 'Nothing to practise' : success ? 'Ausgezeichnet!' : 'Gut gemacht!'}
        message={deck.length === 0 ? 'Learn some words first, then come back.' : `You finished ${title}.`}
        xpGained={tally.xp}
        levelBefore={start.level}
        success={deck.length > 0 && success}
        stats={[
          { icon: 'check-circle-outline', label: 'knew it', value: tally.knew },
          { icon: 'refresh', label: 'to practise', value: tally.again },
        ]}
        onContinue={() => router.back()}
      />
    );
  }

  const answer = (knewIt: boolean, at = position) => {
    if (at !== current.current) return;
    current.current = at + 1;
    const wasNew = !start.learned.has(word.german);
    const points = knewIt ? (wasNew ? XP.newWord : XP.reviewRight) : XP.reviewWrong;
    grade(word.german, knewIt);
    setLearned(word.german, knewIt);
    awardXp(points);
    setTally(t => ({ knew: t.knew + (knewIt ? 1 : 0), again: t.again + (knewIt ? 0 : 1), xp: t.xp + points }));
    const answers = [...given, knewIt];
    setGiven(answers);
    save(answers);
    setPosition(p => p + 1);
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: c.bg }]}>
      <SessionHeader done={position} total={deck.length} colour={c.goldBright} />
      <CardSlot>
        {deck[position + 1] && <NextCard key={`next-${position}`} word={deck[position + 1]} />}
        <SwipeCard key={`${position}-${word.german}`} word={word} meaning={meaning(word)} onAnswer={knewIt => answer(knewIt, position)} />
      </CardSlot>
      <View style={styles.row}>
        <Button label="Again" kind="secondary" icon="refresh" style={styles.grow} onPress={() => answer(false)} />
        {hasClip(word.german) && <IconButton icon="volume-high" label={`Listen to ${word.german}`} onPress={() => play(word.german, voice)} />}
        <Button label="I knew it" icon="check" style={styles.grow} onPress={() => answer(true)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: space.md, gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
});
