import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useCourse } from '@/core/course';
import { XP } from '@/features/gamification/xp';
import { listeningQuestions } from '@/features/lessons/questions';
import { QuizSession } from '@/features/lessons/quiz-session';

/** Listening practice for a unit (?unit=id). */
export default function ListeningRoute() {
  const { unit: id } = useLocalSearchParams<{ unit: string }>();
  const { unit: findUnit, meaning, t } = useCourse();
  const unit = findUnit(Number(id));
  const [questions] = useState(() => (unit ? listeningQuestions(unit, meaning) : []));
  return <QuizSession questions={questions} title={unit ? `listening for ${t(unit.title)}` : ''} pointsPerAnswer={XP.reviewRight} />;
}
