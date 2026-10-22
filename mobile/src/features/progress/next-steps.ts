import type { Course, Lesson, Section, Unit } from '@/core/api/types';
import { PASS_MARK } from '@/features/lessons/kinds';

/** The first section, in course order, that still has words to learn. */
export function nextSection(course: Course, learned: string[]): { unit: Unit; section: Section; left: number } | null {
  const known = new Set(learned);
  for (const unit of course.units) {
    for (const section of unit.sections) {
      const left = section.words.filter(w => !known.has(w.german)).length;
      if (left > 0) return { unit, section, left };
    }
  }
  return null;
}

/** The first lesson, in course order, not yet completed (unit tests have a higher pass mark on the website). */
export function nextLesson(course: Course, grammar: Record<string, number>): { unit: Unit; lesson: Lesson } | null {
  for (const unit of course.units) {
    for (const lesson of unit.grammar) {
      const passMark = lesson.custom === 'review' ? 9 : PASS_MARK;
      if ((grammar[lesson.key] ?? -1) < passMark) return { unit, lesson };
    }
  }
  return null;
}
