import { record, syncState, useSyncState } from '@/core/sync/engine';

/**
 * The learner's progress, as the rest of the app sees it. Every change is an operation for the sync engine
 * (core/sync), which shows it at once and sends it to the account; other devices' changes arrive the same way.
 */

export function useProgress() {
  const { learned, grammar, days, xp } = useSyncState();
  return { learned, grammar, days, xp };
}

export function setLearned(german: string, learned: boolean) {
  if (syncState().learned.includes(german) === learned) return;
  record({ kind: 'word', german, learned });
}

/** A lesson score; only a new best is worth sending (the server keeps the best anyway). */
export function recordScore(lesson: string, score: number) {
  const best = syncState().grammar[lesson];
  if (best === undefined || score > best) record({ kind: 'score', lesson, score });
}

/** XP for something the learner just did; any XP also makes today a practised day. */
export function awardXp(amount: number) {
  if (amount > 0) record({ kind: 'xp', amount });
}

/** The daily goal, in XP. Synced: every device judges each day by the goal in force that day. */
export function setDailyGoal(xp: number) {
  record({ kind: 'goal', xp });
}
