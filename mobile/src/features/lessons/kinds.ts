import type { Lesson } from '@/core/api/types';
import type { IconName } from '@/ui/primitives';

/** What a lesson is, for its badge and grouping in the Lessons tab. */
export type LessonKind = 'grammar' | 'reading' | 'test' | 'trainer';

export function lessonKind(lesson: Lesson): LessonKind {
  if (lesson.custom === 'review') return 'test';
  if (lesson.custom) return 'trainer';
  if (lesson.blocks?.some(block => block.reading)) return 'reading';
  return 'grammar';
}

export const KIND_LOOK: Record<LessonKind, { icon: IconName; name: string }> = {
  grammar: { icon: 'puzzle-outline', name: 'Grammar' },
  reading: { icon: 'book-open-page-variant-outline', name: 'Reading' },
  test: { icon: 'trophy-outline', name: 'Unit test' },
  trainer: { icon: 'dumbbell', name: 'Trainer' },
};

/** As on the website (course.js): a lesson quiz is 8 random items, and 6 right completes it. */
export const QUIZ_SIZE = 8;
export const PASS_MARK = 6;

export function shuffle<T>(items: readonly T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** The name shown for a lesson's kind; a unit can name its own lessons (the Start unit's are "Pronunciation"). */
export function kindName(lesson: Lesson, unit: { lessonsLabel?: string }, t: (text: string) => string) {
  const kind = lessonKind(lesson);
  return kind === 'grammar' && unit.lessonsLabel ? t(unit.lessonsLabel) : KIND_LOOK[kind].name;
}

/** Whether the app runs this lesson's exercise (unit tests and trainers are built by the website). */
export function scoredInApp(lesson: Lesson) {
  return !lesson.custom && (lesson.quiz?.items.length ?? 0) > 0;
}
