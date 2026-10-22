import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useCourse } from '@/core/course';
import { openSession } from '@/core/sync/engine';
import { XP } from '@/features/gamification/xp';
import { lessonQuestions } from '@/features/lessons/questions';
import { QuizSession } from '@/features/lessons/quiz-session';

/** A lesson's exercise (?lesson=key), new or (?resume=1) continued where it was left, on any device. */
export default function QuizRoute() {
  const { lesson: key, resume } = useLocalSearchParams<{ lesson: string; resume?: string }>();
  const { lesson: findLesson, t, bundle } = useCourse();
  const found = findLesson(key);
  const [quiz] = useState(() => {
    if (!found) return null;
    const saved = resume ? openSession() : null;
    const continuing = saved?.kind === 'quiz' && saved.ref === key ? saved : null;
    const { items, questions } = lessonQuestions(found.lesson, t, bundle?.amharic ?? null, continuing?.items.map(Number));
    return { items, questions, answers: continuing ? continuing.answers.slice(0, continuing.position) : [] };
  });
  return (
    <QuizSession
      questions={quiz?.questions ?? []}
      title={found ? t(found.lesson.title) : ''}
      pointsPerAnswer={XP.answerRight}
      lesson={found && quiz ? { key: found.lesson.key, items: quiz.items, answers: quiz.answers } : undefined}
    />
  );
}
