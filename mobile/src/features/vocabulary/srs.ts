import type { Course, Word } from '@/core/api/types';
import { record, syncState, useSyncState } from '@/core/sync/engine';
import { dayKey } from '@/features/progress/streak';

/**
 * Spaced repetition (a Leitner system): each word sits in a box, and each box waits longer before its next
 * review. A right answer moves a word up a box, a wrong one sends it back to the start, due again today.
 * Review schedules sync with the account (the latest review of a word wins), so reviews follow the learner.
 */

/** Days to wait after reaching each box. */
const INTERVALS = [0, 1, 2, 4, 8, 16, 32];
export const REVIEW_SESSION_SIZE = 20;

type Entry = { box: number; due: string };

/** Review schedules by word, synced with the account like the rest of the progress. */
export const useSrs = () => ({ words: useSyncState().srs as Record<string, Entry> });

function addDays(day: string, days: number) {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

export function grade(german: string, right: boolean) {
  const box = right ? Math.min((syncState().srs[german]?.box ?? 0) + 1, INTERVALS.length - 1) : 0;
  record({ kind: 'review', german, box, due: addDays(dayKey(), INTERVALS[box]) });
}

/**
 * The words to review today, most overdue first. Learned words with no review history (learned on the website,
 * or before this app had reviews) count as due, so everything learned gets revisited.
 */
export function dueWords(course: Course, learned: string[], words: Record<string, Entry>, today = dayKey()): Word[] {
  const known = new Set(learned);
  const all = course.units.flatMap(u => u.sections.flatMap(s => s.words));
  const unique = [...new Map(all.map(w => [w.german, w])).values()];
  return unique
    .filter(w => (words[w.german] ? words[w.german].due <= today : known.has(w.german)))
    .sort((a, b) => (words[a.german]?.due ?? '').localeCompare(words[b.german]?.due ?? ''));
}

/** When the next review comes up, for the "all caught up" message. */
export function nextDue(words: Record<string, Entry>, today = dayKey()) {
  const upcoming = Object.values(words).map(e => e.due).filter(due => due > today).sort();
  return upcoming[0] ?? null;
}

/** A review day as people say it: "today", "tomorrow", else the weekday and date ("Mon, 13 Oct"). */
export function describeDay(day: string, today = dayKey()) {
  if (day <= today) return 'today';
  if (day === addDays(today, 1)) return 'tomorrow';
  const [y, m, d] = day.split('-').map(Number);
  return `on ${new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
}
