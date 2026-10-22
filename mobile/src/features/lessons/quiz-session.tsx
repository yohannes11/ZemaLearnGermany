import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/core/settings';
import { record, sessionDefaults } from '@/core/sync/engine';
import { Celebration } from '@/features/gamification/celebration';
import { useGame } from '@/features/gamification/hooks';
import { XP } from '@/features/gamification/xp';
import { awardXp, recordScore } from '@/features/progress/store';
import { SessionHeader } from '@/features/session-header';
import { space, useColours } from '@/ui/theme';

import { PASS_MARK } from './kinds';
import { QuestionView, type Result } from './question-view';
import type { Question } from './questions';

type Props = {
  questions: Question[];
  title: string;
  pointsPerAnswer: number;
  /**
   * A lesson exercise: its key, the quiz item numbers asked, and where to start (answers already given, from this
   * or another device). Its place is saved after every question, so it can be continued anywhere, and its score
   * counts like the website's (6 of 8 completes it).
   */
  lesson?: { key: string; items: number[]; answers: boolean[] };
};

export function QuizSession({ questions, title, pointsPerAnswer, lesson }: Props) {
  const c = useColours();
  const { voice } = useSettings();
  const game = useGame();
  const [levelBefore] = useState(game.level.level);
  const [answers, setAnswers] = useState<boolean[]>(() => lesson?.answers.slice(0, questions.length) ?? []);
  const [result, setResult] = useState<Result | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [finished, setFinished] = useState(false);

  const position = answers.length - (result ? 1 : 0);
  const right = answers.filter(Boolean).length;

  const save = (given: boolean[], done: boolean) => {
    if (!lesson) return;
    record({
      kind: 'session',
      session: done ? null : { kind: 'quiz', ref: lesson.key, items: lesson.items, answers: given, position: given.length, ...sessionDefaults() },
    });
  };

  // Opening the exercise saves where it starts, so another device can offer it at once.
  useEffect(() => {
    if (lesson && questions.length) save(lesson.answers.slice(0, questions.length), false);
    // Only when it opens: later saves follow each question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const question = questions[position];

  if (finished || !question) {
    const passed = lesson ? right >= PASS_MARK : right >= questions.length / 2;
    return (
      <Celebration
        title={questions.length === 0 ? 'Nothing here yet' : passed ? (right === questions.length ? 'Perfekt!' : 'Geschafft!') : 'Weiter üben!'}
        message={
          questions.length === 0
            ? 'This exercise needs recordings. Connect to the internet or download the unit.'
            : lesson
              ? passed
                ? `You completed ${title}.`
                : `${PASS_MARK} of ${questions.length} completes it. You are close: try again.`
              : `You practised ${title}.`
        }
        xpGained={xpEarned}
        levelBefore={levelBefore}
        success={questions.length > 0 && passed}
        stats={[
          { icon: 'check-circle-outline', label: 'right', value: `${right}/${questions.length}` },
          { icon: 'target', label: lesson ? 'to pass' : 'questions', value: lesson ? PASS_MARK : questions.length },
        ]}
        onContinue={() => router.back()}
      />
    );
  }

  const answer = (r: Result) => {
    setResult(r);
    setAnswers(a => [...a, r.right]);
    if (r.right) {
      awardXp(pointsPerAnswer);
      setXpEarned(x => x + pointsPerAnswer);
    }
  };

  const next = () => {
    setResult(null);
    if (answers.length < questions.length) {
      save(answers, false);
      return;
    }
    if (lesson) {
      recordScore(lesson.key, right);
      const bonus = (right >= PASS_MARK ? XP.lessonPassed : 0) + (right === questions.length ? XP.perfect : 0);
      awardXp(bonus);
      setXpEarned(x => x + bonus);
      save(answers, true);
    }
    setFinished(true);
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: c.bg }]}>
      <SessionHeader done={answers.length} total={questions.length} />
      <QuestionView
        key={position}
        question={question}
        voice={voice}
        result={result}
        onResult={answer}
        onNext={next}
        last={answers.length === questions.length}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, padding: space.md, gap: space.lg } });
